// AuthGuard for the passport-line-auth ('line') strategy.
// Used on /auth/line (kicks off the redirect to LINE) and /auth/line/callback.
// Because PassportModule is registered with { session: true }, a successful
// authentication also calls request.logIn(), persisting the LINE profile in the
// session via SessionSerializer.serializeUser.
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LineAuthGuard extends AuthGuard('line') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = (await super.canActivate(context)) as boolean;
    // Establish the login session (req.logIn) for the callback request.
    const request = context.switchToHttp().getRequest();
    await super.logIn(request);
    return result;
  }
}
