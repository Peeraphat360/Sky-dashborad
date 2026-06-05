// ─────────────────────────────────────────────────────────────────────────────
// src/auth/auth.controller.ts
// LINE Login routes. The actual OAuth dance is handled by LineAuthGuard /
// passport-line-auth; these handlers just kick it off, land the callback, expose
// the current session, and log out. NONE of them write to the database — the
// LINE id + display name live only in the session until a booking is confirmed.
// ─────────────────────────────────────────────────────────────────────────────

import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LineAuthGuard } from './guards/line-auth.guard';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import type { LineSessionUser } from '../config/passport';

@Controller('auth')
export class AuthController {
  // GET /auth/line — the "Log in with LINE" button points here. The guard
  // redirects the browser to LINE's consent screen.
  @Get('line')
  @UseGuards(LineAuthGuard)
  login(): void {
    /* handled by LineAuthGuard → redirect to LINE */
  }

  // GET /auth/line/callback — LINE redirects back here. LineAuthGuard validates
  // the profile and establishes the session, then we bounce to the frontend.
  @Get('line/callback')
  @UseGuards(LineAuthGuard)
  callback(@Res() res: Response): void {
    const frontend = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    res.redirect(`${frontend}/book`);
  }

  // GET /auth/me — frontend calls this (with credentials) to know if the customer
  // is logged in and to render their LINE display name. 401 if not authenticated.
  @Get('me')
  @UseGuards(AuthenticatedGuard)
  me(@Req() req: Request): LineSessionUser {
    return req.user as LineSessionUser;
  }

  // POST /auth/logout — clears the session. No DB rows are involved, so logging
  // out without booking leaves zero trace of the LINE user, per requirements.
  @Post('logout')
  logout(@Req() req: Request, @Res() res: Response): void {
    req.logout((err) => {
      if (err) {
        res.status(500).json({ message: 'Logout failed' });
        return;
      }
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.status(200).json({ message: 'Logged out' });
      });
    });
  }
}
