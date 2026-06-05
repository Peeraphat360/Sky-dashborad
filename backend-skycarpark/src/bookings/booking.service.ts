import { Injectable, Inject, ConflictException } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import type { Database } from '../database/index';
import { eq, and, desc } from 'drizzle-orm';
import { bookings, parkingSlots, parkingZones, users } from '../database/schema';
import type { LineSessionUser } from '../config/passport';
import type { ConfirmBookingDto } from './dto/confirm-booking.dto';

@Injectable()
export class BookingService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The ONLY place a LINE customer is written to the database.
   *
   * Triggered when an authenticated customer confirms a booking. In one
   * transaction we:
   *   1) UPSERT the users row keyed on line_id (insert on first booking, refresh
   *      the display name on later ones),
   *   2) reserve the slot (AVAILABLE → RESERVED, failing if already taken),
   *   3) insert the CONFIRMED booking owned by that user.
   *
   * If the customer never reaches this endpoint (closes the tab / logs out),
   * nothing about them is persisted — their LINE profile only ever lived in the
   * session.
   *
   * Runs against the direct DATABASE_URL connection (postgres role), which
   * bypasses RLS, so the slot+booking writes the anon client must do via
   * SECURITY DEFINER RPCs are safe to do directly here — wrapped in a
   * transaction so booking and slot state never desync.
   */
  async confirmLineBooking(lineUser: LineSessionUser, dto: ConfirmBookingDto) {
    return await this.db.transaction(async (tx) => {
      // 1) UPSERT user by LINE id.
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.lineId, lineUser.lineId))
        .limit(1);

      let userId: string;
      if (existing) {
        userId = existing.id;
        await tx
          .update(users)
          .set({ lineDisplayName: lineUser.displayName, name: lineUser.displayName })
          .where(eq(users.id, userId));
      } else {
        const [created] = await tx
          .insert(users)
          .values({
            name:            lineUser.displayName,
            role:            'CUSTOMER',
            lineId:          lineUser.lineId,
            lineDisplayName: lineUser.displayName,
            phone:           dto.customerPhone ?? null,
          })
          .returning({ id: users.id });
        userId = created.id;
      }

      // 2) Reserve the slot only if it is currently AVAILABLE (atomic guard
      //    against double-booking — mirrors create_walkin_booking's check).
      const reserved = await tx
        .update(parkingSlots)
        .set({ status: 'RESERVED' })
        .where(and(eq(parkingSlots.id, dto.slotId), eq(parkingSlots.status, 'AVAILABLE')))
        .returning({ id: parkingSlots.id });

      if (reserved.length === 0) {
        // Aborts the transaction → no user/booking written either.
        throw new ConflictException('SLOT_NOT_AVAILABLE');
      }

      // 3) Insert the confirmed booking.
      const [booking] = await tx
        .insert(bookings)
        .values({
          userId,
          slotId:          dto.slotId,
          startTime:       new Date(dto.startTime),
          endTime:         new Date(dto.endTime),
          status:          'CONFIRMED',
          customerName:    lineUser.displayName,
          customerPhone:   dto.customerPhone ?? null,
          vehiclePlate:    dto.vehiclePlate,
          vehicleProvince: dto.vehicleProvince ?? null,
          vehicleBrand:    dto.vehicleBrand ?? null,
          vehicleModel:    dto.vehicleModel ?? null,
          vehicleType:     dto.vehicleType ?? null,
          fee:             dto.fee ?? null,
          isWalkIn:        false,
          remarks:         dto.remarks ?? null,
        })
        .returning({ id: bookings.id, status: bookings.status });

      return { bookingId: booking.id, status: booking.status, userId };
    });
  }

  async findConfirmedByUser(userId: string) {
    return await this.db
      .select({
        bookingId:  bookings.id,
        status:     bookings.status,
        startTime:  bookings.startTime,
        slotNumber: parkingSlots.number,
        zoneName:   parkingZones.name,
        floor:      parkingZones.floor,
      })
      .from(bookings)
      .leftJoin(parkingSlots, eq(bookings.slotId, parkingSlots.id))
      .leftJoin(parkingZones, eq(parkingSlots.zoneId, parkingZones.id))
      .where(and(
        eq(bookings.userId, userId),
        eq(bookings.status, 'CONFIRMED')
      ))
      .orderBy(desc(bookings.createdAt))
      .limit(10);
  }
}
