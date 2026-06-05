// ─────────────────────────────────────────────────────────────────────────────
// src/config/passport.ts
// Passport LINE strategy + session serializer.
//
// LineStrategy   — wraps passport-line-auth, validates the OAuth callback and
//                  normalises the LINE profile into a LineSessionUser.
// SessionSerializer — tells Passport how to store / restore the LINE user
//                     in the express-session.
// LineSessionUser   — the shape of `req.user` while the customer is logged in.
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { PassportSerializer } from '@nestjs/passport';
import { Strategy, LineProfile } from 'passport-line-auth';

// ── Type shared across controllers / services ──────────────────────────────
export interface LineSessionUser {
  lineId: string;
  displayName: string;
  pictureUrl?: string;
}

// ── LINE OAuth Strategy ────────────────────────────────────────────────────
@Injectable()
export class LineStrategy extends PassportStrategy(Strategy, 'line') {
  constructor(private readonly config: ConfigService) {
    super({
      channelID:     config.get<string>('LINE_CHANNEL_ID', ''),
      channelSecret: config.get<string>('LINE_CHANNEL_SECRET', ''),
      callbackURL:   config.get<string>('LINE_CALLBACK_URL', 'http://localhost:3001/auth/line/callback'),
      scope:         ['profile', 'openid'],
    });
  }

  // Called after LINE returns the profile. We map it to our lean session shape.
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: LineProfile,
  ): LineSessionUser {
    return {
      lineId:      profile.id,
      displayName: profile.displayName,
      pictureUrl:  profile.pictureUrl,
    };
  }
}

// ── Session Serializer ─────────────────────────────────────────────────────
// Stores only the minimal LineSessionUser in the session — no DB lookup needed
// because the LINE customer isn't persisted until they actually confirm a booking.
@Injectable()
export class SessionSerializer extends PassportSerializer {
  serializeUser(
    user: LineSessionUser,
    done: (err: Error | null, user: LineSessionUser) => void,
  ): void {
    done(null, user);
  }

  deserializeUser(
    payload: LineSessionUser,
    done: (err: Error | null, user: LineSessionUser) => void,
  ): void {
    // The full object is already stored — just hand it back.
    done(null, payload);
  }
}
