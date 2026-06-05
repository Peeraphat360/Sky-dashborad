// Payload the customer booking page POSTs to /bookings/confirm.
// The LINE id + display name are NOT here — they come from the authenticated
// session (req.user), so the client cannot spoof another customer's identity.
import { IsString, IsOptional, IsInt, IsISO8601, Min, IsUUID } from 'class-validator';

export class ConfirmBookingDto {
  @IsUUID()
  slotId!: string;

  @IsISO8601()
  startTime!: string;

  @IsISO8601()
  endTime!: string;

  @IsString()
  vehiclePlate!: string;

  @IsOptional() @IsString()
  vehicleProvince?: string;

  @IsOptional() @IsString()
  vehicleBrand?: string;

  @IsOptional() @IsString()
  vehicleModel?: string;

  @IsOptional() @IsString()
  vehicleType?: string;

  @IsOptional() @IsString()
  customerPhone?: string;

  @IsOptional() @IsInt() @Min(0)
  fee?: number;

  @IsOptional() @IsString()
  remarks?: string;
}
