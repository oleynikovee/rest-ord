import { type ExecutionContext, HttpException, HttpStatus, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

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
