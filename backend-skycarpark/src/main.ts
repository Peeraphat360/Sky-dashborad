import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import passport from 'passport';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS with credentials so the browser sends/receives the session cookie
  // across the Vite dev origin → API origin.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Session middleware — must come before passport. The LINE profile of a
  // logged-in-but-not-yet-booked customer lives here (req.session), never in the
  // DB. For production swap MemoryStore for a Redis/Postgres-backed store.
  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? 'dev-only-session-secret-change-me',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 1 day
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    }),
  );

  // Passport session support → enables serializeUser / deserializeUser.
  app.use(passport.initialize());
  app.use(passport.session());

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
