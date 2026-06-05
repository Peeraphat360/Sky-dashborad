// Minimal type declarations for `passport-line-auth` (ships no @types).
// Only what we use: the Strategy constructor + the verify-callback profile shape.
declare module 'passport-line-auth' {
  import { Request } from 'express';

  export interface LineProfile {
    id: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
    provider: 'line';
    _raw?: string;
    _json?: Record<string, unknown>;
  }

  export interface StrategyOptions {
    channelID: string;
    channelSecret: string;
    callbackURL: string;
    scope?: string[] | string;
    botPrompt?: 'normal' | 'aggressive';
    uiLocales?: string;
    state?: boolean;
    passReqToCallback?: false;
  }

  export type VerifyCallback = (
    err: Error | null,
    user?: unknown,
    info?: unknown,
  ) => void;

  export type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    profile: LineProfile,
    done: VerifyCallback,
  ) => void;

  export class Strategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
    name: string;
    authenticate(req: Request, options?: object): void;
  }
}
