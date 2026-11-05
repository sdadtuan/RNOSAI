import { HttpException } from '@nestjs/common';

export function amThrow(status: number, body: Record<string, unknown>): never {
  throw Object.assign(new HttpException(body, status), body);
}
