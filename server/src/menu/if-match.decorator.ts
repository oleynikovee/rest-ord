import { type ExecutionContext, HttpException, HttpStatus, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

/**
 * The entity version the client based its change on, from `If-Match: "<version>"`
 * (quotes and the weak `W/` prefix are accepted). Required: without it a write would
 * silently overwrite someone else's change.
 */
export const IfMatchVersion = createParamDecorator((_: unknown, context: ExecutionContext): number => {
  const header = context.switchToHttp().getRequest<Request>().headers['if-match'];
  const match = /^(?:W\/)?"?(\d+)"?$/.exec((header ?? '').trim());
  if (!match) {
    throw new HttpException(
      {
        statusCode: HttpStatus.PRECONDITION_REQUIRED,
        code: 'VERSION_REQUIRED',
        message: 'Send the version you edited in the If-Match header.',
      },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }
  return Number(match[1]);
});
