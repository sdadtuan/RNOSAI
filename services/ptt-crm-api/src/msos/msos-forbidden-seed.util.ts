import { UnprocessableEntityException } from '@nestjs/common';

const FORBIDDEN_MSOS_NAME = /sunlight|nova home|tâm an|tam an|admicro|adtima/i;

export function assertAllowedMsosName(name: string): void {
  if (FORBIDDEN_MSOS_NAME.test(name)) {
    throw new UnprocessableEntityException({ error: 'forbidden_demo_name' });
  }
}
