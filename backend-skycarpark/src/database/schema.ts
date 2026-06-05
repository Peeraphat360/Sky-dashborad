import {
  pgTable, pgEnum, text, timestamp,
  boolean, decimal, integer, uuid, varchar
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── Enums ────────────────────────────────────
export const roleEnum = pgEnum('role', [
  'SUPER_ADMIN', 'ADMIN', 'STAFF', 'CUSTOMER'
]);

export const slotStatusEnum = pgEnum('slot_status', [
  'AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'PROMPTPAY', 'STRIPE', 'QR'
]);

// ─── Car Models (Catalog) ──────────────────────
export const carModels = pgTable('car_models', {
  id:        uuid('id').primaryKey().defaultRandom(),
  brand:     text('brand').notNull(),
  model:     text('model').notNull(),
  type:      text('type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Users ────────────────────────────────────
// email/password are nullable: LINE customers authenticate via OAuth and have
// neither. line_id is the unique identity key for the UPSERT performed only when
// a LINE customer confirms a booking (see BookingService.confirmLineBooking).
export const users = pgTable('users', {
  id:              uuid('id').primaryKey().defaultRandom(),
  email:           text('email').unique(),
  password:        text('password'),
  name:            text('name').notNull(),
  phone:           text('phone'),
  role:            roleEnum('role').default('CUSTOMER').notNull(),
  lineId:          text('line_id').unique(),
  lineDisplayName: text('line_display_name'),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
});

// ─── Parking Zones ───────────────────────────
export const parkingZones = pgTable('parking_zones', {
  id:    uuid('id').primaryKey().defaultRandom(),
  name:  text('name').notNull(),   // A, B, C
  floor: integer('floor').notNull(),
});

// ─── Parking Slots ───────────────────────────
export const parkingSlots = pgTable('parking_slots', {
  id:     uuid('id').primaryKey().defaultRandom(),
  number: text('number').notNull(),  // A-001
  status: slotStatusEnum('status').default('AVAILABLE').notNull(),
  zoneId: uuid('zone_id').notNull().references(() => parkingZones.id),
});

// ─── Bookings ────────────────────────────────
export const bookings = pgTable('bookings', {
  id:               uuid('id').primaryKey().defaultRandom(),
  userId:           uuid('user_id').notNull().references(() => users.id),
  slotId:           uuid('slot_id').notNull().references(() => parkingSlots.id),
  startTime:        timestamp('start_time').notNull(),
  endTime:          timestamp('end_time').notNull(),
  status:           bookingStatusEnum('status').default('PENDING').notNull(),
  createdAt:        timestamp('created_at').defaultNow().notNull(),
  customerName:     text('customer_name'),
  customerPhone:    text('customer_phone'),
  customerAltPhone: text('customer_alt_phone'),
  vehiclePlate:     text('vehicle_plate'),
  vehicleProvince:  text('vehicle_province'),
  vehicleBrand:     text('vehicle_brand'),
  vehicleModel:     text('vehicle_model'),
  vehicleType:      text('vehicle_type'),
  fee:              integer('fee'),
  isWalkIn:         boolean('is_walk_in').default(false),
  remarks:          text('remarks'),
  couponCode:       varchar('coupon_code', { length: 50 }),
});

// ─── Payments ────────────────────────────────
export const payments = pgTable('payments', {
  id:        uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().unique().references(() => bookings.id),
  userId:    uuid('user_id').notNull().references(() => users.id),
  amount:    decimal('amount', { precision: 10, scale: 2 }).notNull(),
  method:    paymentMethodEnum('method').notNull(),
  status:    text('status').default('PENDING').notNull(),
  paidAt:    timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Notifications ───────────────────────────
export const notifications = pgTable('notifications', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id),
  title:     text('title').notNull(),
  message:   text('message').notNull(),
  isRead:    boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Audit Logs ──────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id:         uuid('id').primaryKey().defaultRandom(),
  userId:     uuid('user_id').references(() => users.id),
  action:     text('action').notNull(),    // CREATE_BOOKING
  tableName:  text('table_name').notNull(),
  recordId:   text('record_id'),
  oldValues:  text('old_values'),          // JSON string
  newValues:  text('new_values'),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
});

// ─── Relations (สำหรับ join query) ──────────
export const usersRelations = relations(users, ({ many }) => ({
  bookings:      many(bookings),
  payments:      many(payments),
  notifications: many(notifications),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user:    one(users,        { fields: [bookings.userId], references: [users.id] }),
  slot:    one(parkingSlots, { fields: [bookings.slotId], references: [parkingSlots.id] }),
  payment: one(payments,     { fields: [bookings.id],    references: [payments.bookingId] }),
}));

export const parkingSlotsRelations = relations(parkingSlots, ({ one, many }) => ({
  zone:     one(parkingZones, { fields: [parkingSlots.zoneId], references: [parkingZones.id] }),
  bookings: many(bookings),
}));