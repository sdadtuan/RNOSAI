import { NotFoundException } from '@nestjs/common';

export function throwDisabled(): never {
  throw new NotFoundException({ error: 'media_os_disabled' });
}
