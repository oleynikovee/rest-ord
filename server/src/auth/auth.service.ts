import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../config.js';
import type { Role, User, UserRecord } from '../domain/models.js';
import { UsersRepository } from '../domain/ports.js';
import type { SessionPayload } from './auth.types.js';
import { hashPassword, verifyPassword } from './password.js';

/** Compared against when the email is unknown, so both cases take the same time. */
const DUMMY_HASH =
  'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==';

const DEMO_CUSTOMER = { email: 'guest@trattoria.local', password: 'guest12345', name: 'Demo guest' };

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Runs after storage is initialised: makes sure the demo accounts exist. */
  async onApplicationBootstrap(): Promise<void> {
    const { adminEmail, adminPassword, seedDemoCustomer } = this.config.auth;
    await this.ensureUser(adminEmail, adminPassword, 'Administrator', 'admin');
    if (seedDemoCustomer) {
      await this.ensureUser(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password, DEMO_CUSTOMER.name, 'customer');
    }
  }

  async register(email: string, name: string, password: string): Promise<User> {
    const created = await this.users.create({
      email,
      name,
      role: 'customer',
      passwordHash: await hashPassword(password),
    });
    if (!created) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'An account with this email already exists.',
      });
    }
    return toUser(created);
  }

  async login(email: string, password: string): Promise<User> {
    const user = await this.users.findByEmail(email);
    const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      // One message for both cases: do not reveal which emails are registered.
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }
    return toUser(user);
  }

  issueToken(user: User): Promise<string> {
    const payload: SessionPayload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    return this.jwt.signAsync(payload);
  }

  /** Returns the user of a valid, unexpired token, or `null`. Never throws. */
  async verifyToken(token: string): Promise<User | null> {
    try {
      const payload = await this.jwt.verifyAsync<SessionPayload>(token);
      return { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
    } catch {
      return null;
    }
  }

  private async ensureUser(
    email: string,
    password: string,
    name: string,
    role: Role,
  ): Promise<void> {
    if (await this.users.findByEmail(email)) return;
    await this.users.create({ email, name, role, passwordHash: await hashPassword(password) });
    this.logger.log(`Created ${role} account ${email}`);
  }
}

function toUser({ id, email, name, role }: UserRecord): User {
  return { id, email, name, role };
}
