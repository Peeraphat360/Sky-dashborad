// src/bookings/booking.controller.ts
import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { BookingService } from './booking.service';
import { ConfirmBookingDto } from './dto/confirm-booking.dto';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import type { LineSessionUser } from '../config/passport';

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // GET /bookings/user/:userId
  @Get('user/:userId')
  findByUser(@Param('userId') userId: string) {
    return this.bookingService.findConfirmedByUser(userId);
  }

  // POST /bookings/confirm — the booking-confirmation endpoint. Protected by the
  // "isLoggedIn" guard: only an authenticated LINE customer reaches it, and this
  // is the moment their LINE id + display name are written to the database.
  @Post('confirm')
  @UseGuards(AuthenticatedGuard)
  confirm(@Req() req: Request, @Body() dto: ConfirmBookingDto) {
    return this.bookingService.confirmLineBooking(req.user as LineSessionUser, dto);
  }
}
