import { Module, Global } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export const DRIZZLE = 'DRIZZLE';

@Global()
@Module({
  providers: [{
    provide: DRIZZLE,
    useFactory: () => {
      const client = postgres(process.env.DATABASE_URL!);
      return drizzle(client, { schema });
    },
  }],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
