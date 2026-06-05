// AuthenticatedGuard — the NestJS equivalent of an `isLoggedIn` middleware.
// Protects private endpoints (e.g. the booking-confirm route): allows the request
// through only when Passport has an authenticated session (req.isAuthenticated()).
// Unauthenticated requests get 401 so the frontend can redirect to the LINE login.
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.isAuthenticated?.()) return true;
    throw new UnauthorizedException('LINE login required');
  }
}
