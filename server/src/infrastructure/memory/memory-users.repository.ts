import { randomUUID } from 'node:crypto';
import type { UserRecord } from '../../domain/models.js';
import { UsersRepository } from '../../domain/ports.js';

export class MemoryUsersRepository extends UsersRepository {
  private readonly users = new Map<string, UserRecord>();

  async findById(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === normalized) return { ...user };
    }
    return null;
  }

  async create(input: Omit<UserRecord, 'id'>): Promise<UserRecord | null> {
    if (await this.findByEmail(input.email)) return null;
    const user: UserRecord = { ...input, id: randomUUID(), email: input.email.toLowerCase() };
    this.users.set(user.id, user);
    return { ...user };
  }
}
