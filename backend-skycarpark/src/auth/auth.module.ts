// src/auth/auth.module.ts
// Registers Passport in session mode and provides the LINE strategy + session
// serializer. AuthenticatedGuard is exported so other modules (e.g. bookings)
// can protect their private routes with the same "isLoggedIn" check.
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { LineStrategy, SessionSerializer } from '../config/passport';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import { LineAuthGuard } from './guards/line-auth.guard';

@Module({
  imports: [
    PassportModule.register({ session: true, defaultStrategy: 'line' }),
  ],
  controllers: [AuthController],
  providers: [LineStrategy, SessionSerializer, AuthenticatedGuard, LineAuthGuard],
  exports: [AuthenticatedGuard],
})
export class AuthModule {}
