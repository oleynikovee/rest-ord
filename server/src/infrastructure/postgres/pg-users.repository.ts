import { randomUUID } from 'node:crypto';
import type { Role, UserRecord } from '../../domain/models.js';
import { UsersRepository } from '../../domain/ports.js';
import type { PgDatabase } from './pg-database.js';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  password_hash: string;
}

const toUser = (row: UserRow): UserRecord => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  passwordHash: row.password_hash,
});

export class PgUsersRepository extends UsersRepository {
  constructor(private readonly db: PgDatabase) {
    super();
  }

  async findById(id: string): Promise<UserRecord | null> {
    const { rows } = await this.db.pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const { rows } = await this.db.pool.query<UserRow>('SELECT * FROM users WHERE email = $1', [
      email.toLowerCase(),
    ]);
    return rows[0] ? toUser(rows[0]) : null;
  }

  async create(input: Omit<UserRecord, 'id'>): Promise<UserRecord | null> {
    const { rows } = await this.db.pool.query<UserRow>(
      `INSERT INTO users (id, email, name, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING
       RETURNING *`,
      [randomUUID(), input.email.toLowerCase(), input.name, input.role, input.passwordHash],
    );
    return rows[0] ? toUser(rows[0]) : null;
  }
}
