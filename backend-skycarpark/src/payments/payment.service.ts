import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import type { Database } from '../database/index';
import { payments } from '../database/schema';

@Injectable()
export class PaymentService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}
}
