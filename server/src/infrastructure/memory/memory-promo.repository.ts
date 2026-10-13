import { randomUUID } from 'node:crypto';
import type { PromoCode, PromoCodeInput, PromoRedemption } from '../../domain/models.js';
import { PromoRepository, type VersionedWrite } from '../../domain/ports.js';

export class MemoryPromoRepository extends PromoRepository {
  private readonly promos = new Map<string, PromoCode>();
  private readonly redemptions: PromoRedemption[] = [];

  async list(): Promise<PromoCode[]> {
    return [...this.promos.values()].map((p) => ({ ...p })).sort((a, b) => a.code.localeCompare(b.code));
  }

  async findByCode(code: string): Promise<PromoCode | null> {
    for (const promo of this.promos.values()) if (promo.code === code) return { ...promo };
    return null;
  }

  async countRedemptions(promoId: string, userId: string): Promise<number> {
    return this.redemptions.filter((r) => r.promoId === promoId && r.userId === userId).length;
  }

  async create(input: PromoCodeInput): Promise<PromoCode | null> {
    if (await this.findByCode(input.code)) return null;
    const promo: PromoCode = { ...input, id: randomUUID(), usedCount: 0, version: 1 };
    this.promos.set(promo.id, promo);
    return { ...promo };
  }

  async update(
    id: string,
    input: PromoCodeInput,
    expectedVersion: number,
  ): Promise<VersionedWrite<PromoCode>> {
    const current = this.promos.get(id);
    if (!current) return { status: 'not_found' };
    if (current.version !== expectedVersion) return { status: 'conflict', current: { ...current } };
    const next: PromoCode = { ...current, ...input, version: current.version + 1 };
    this.promos.set(id, next);
    return { status: 'ok', value: { ...next } };
  }

  redeem({ promoId, userId }: PromoRedemption): 'ok' | 'exhausted' | 'already_used' {
    const promo = this.promos.get(promoId);
    if (!promo || (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit)) return 'exhausted';
    const used = this.redemptions.filter((r) => r.promoId === promoId && r.userId === userId).length;
    if (promo.perUserLimit !== null && used >= promo.perUserLimit) return 'already_used';
    promo.usedCount++;
    this.redemptions.push({ promoId, userId });
    return 'ok';
  }
}
