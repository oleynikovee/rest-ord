import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorBody, Category, MenuChangeIssue, MenuItem } from './models';

/** A serialisable error that is safe to keep in the store and show to the user. */
export interface ApiError {
  status: number;
  code: string;
  message: string;
  issues?: MenuChangeIssue[];
  /** With 412 VERSION_CONFLICT: what the entity looks like now. */
  current?: Category | MenuItem;
}

type ErrorBody = Partial<ApiErrorBody>;

export function toApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: -1, code: 'UNKNOWN', message: 'Something went wrong. Please try again.' };
  }
  if (error.status === 0) {
    return {
      status: 0,
      code: 'NETWORK',
      message: 'No connection to the server. Check your connection and try again.',
    };
  }
  const body = (typeof error.error === 'object' && error.error ? error.error : {}) as ErrorBody;
  const message = Array.isArray(body.message) ? body.message.join('. ') : body.message;
  return {
    status: error.status,
    code: body.code ?? `HTTP_${error.status}`,
    message: message ?? defaultMessage(error.status),
    issues: body.issues,
    current: body.current,
  };
}

/** Errors worth retrying automatically with the same request (and idempotency key). */
export function isTransient(error: ApiError): boolean {
  return error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504;
}

function defaultMessage(status: number): string {
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 502 && status <= 504) return 'The server is temporarily unavailable.';
  if (status >= 500) return 'The server had a problem. Please try again in a moment.';
  return 'The request could not be completed.';
}
