// src/bookings/booking.module.ts
import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule], // provides AuthenticatedGuard for the /bookings/confirm route
  controllers: [BookingController],
  providers: [BookingService],
})
export class BookingModule {}
