import type { Request } from 'express';
import type { User } from '../domain/models.js';

export const SESSION_COOKIE = 'session';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: User['role'];
}
