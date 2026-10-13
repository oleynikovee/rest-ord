import { randomUUID } from 'node:crypto';
import type { PromoCode, PromoCodeInput, PromoKind } from '../../domain/models.js';
import { PromoRepository, type VersionedWrite } from '../../domain/ports.js';
import type { PgDatabase } from './pg-database.js';

export interface PromoRow {
  id: string;
  code: string;
  description: string;
  kind: PromoKind;
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number | null;
  per_user_limit: number | null;
  used_count: number;
  starts_at: Date | null;
  expires_at: Date | null;
  active: boolean;
  version: number;
}

const toPromo = (row: PromoRow): PromoCode => ({
  id: row.id,
  code: row.code,
  description: row.description,
  kind: row.kind,
  value: row.value,
  minOrderAmount: row.min_order_amount,
  maxDiscount: row.max_discount,
  usageLimit: row.usage_limit,
  perUserLimit: row.per_user_limit,
  usedCount: row.used_count,
  startsAt: row.starts_at?.toISOString() ?? null,
  expiresAt: row.expires_at?.toISOString() ?? null,
  active: row.active,
  version: row.version,
});

const params = (input: PromoCodeInput): unknown[] => [
  input.code,
  input.description,
  input.kind,
  input.value,
  input.minOrderAmount,
  input.maxDiscount,
  input.usageLimit,
  input.perUserLimit,
  input.startsAt,
  input.expiresAt,
  input.active,
];

export class PgPromoRepository extends PromoRepository {
  constructor(private readonly db: PgDatabase) {
    super();
  }

  async list(): Promise<PromoCode[]> {
    const { rows } = await this.db.pool.query<PromoRow>('SELECT * FROM promo_codes ORDER BY code');
    return rows.map(toPromo);
  }

  async findByCode(code: string): Promise<PromoCode | null> {
    const { rows } = await this.db.pool.query<PromoRow>('SELECT * FROM promo_codes WHERE code = $1', [code]);
    return rows[0] ? toPromo(rows[0]) : null;
  }

  async countRedemptions(promoId: string, userId: string): Promise<number> {
    const { rows } = await this.db.pool.query<{ count: string }>(
      'SELECT count(*) FROM promo_redemptions WHERE promo_id = $1 AND user_id = $2',
      [promoId, userId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async create(input: PromoCodeInput): Promise<PromoCode | null> {
    const { rows } = await this.db.pool.query<PromoRow>(
      `INSERT INTO promo_codes
         (id, code, description, kind, value, min_order_amount, max_discount,
          usage_limit, per_user_limit, starts_at, expires_at, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (code) DO NOTHING
       RETURNING *`,
      [randomUUID(), ...params(input)],
    );
    return rows[0] ? toPromo(rows[0]) : null;
  }

  async update(
    id: string,
    input: PromoCodeInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<PromoCode>> {
    const { rows } = await this.db.pool.query<PromoRow>(
      `UPDATE promo_codes
       SET code = $2, description = $3, kind = $4, value = $5, min_order_amount = $6,
           max_discount = $7, usage_limit = $8, per_user_limit = $9, starts_at = $10,
           expires_at = $11, active = $12, version = version + 1
       WHERE id = $1 AND version = $13
       RETURNING *`,
      [id, ...params(input), expectedVersion],
    );
    if (rows[0]) return { status: 'ok', value: toPromo(rows[0]) };
    const current = await this.db.pool.query<PromoRow>('SELECT * FROM promo_codes WHERE id = $1', [id]);
    return current.rows[0] ? { status: 'conflict', current: toPromo(current.rows[0]) } : { status: 'not_found' };
  }
}
