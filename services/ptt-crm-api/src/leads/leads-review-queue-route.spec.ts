import { Controller, Get, Module, Param, ParseIntPipe } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { NestFactory } from '@nestjs/core';
import { LeadsController } from './leads.controller';

const leadByIdPath = Reflect.getMetadata(PATH_METADATA, LeadsController.prototype.getLead) as string;

@Controller('api/v1/leads')
class IdFirstController {
  @Get(leadByIdPath)
  get(@Param('id', ParseIntPipe) id: number) {
    return { id };
  }
}

@Controller('api/v1/leads')
class ReviewQueueController {
  @Get('review-queue')
  list() {
    return { leads: [{ id: 900000010 }] };
  }
}

@Module({ controllers: [IdFirstController, ReviewQueueController] })
class RouteAppModule {}

describe('GET /api/v1/leads/review-queue', () => {
  it('is not captured by the numeric lead id route', async () => {
    const app = await NestFactory.create(RouteAppModule, { logger: false });
    await app.listen(0);
    const address = app.getHttpServer().address() as { port: number };
    try {
      const queue = await fetch(`http://127.0.0.1:${address.port}/api/v1/leads/review-queue`);
      expect(queue.status).toBe(200);
      await expect(queue.json()).resolves.toEqual({ leads: [{ id: 900000010 }] });

      const lead = await fetch(`http://127.0.0.1:${address.port}/api/v1/leads/900000010`);
      expect(lead.status).toBe(200);
      await expect(lead.json()).resolves.toEqual({ id: 900000010 });
    } finally {
      await app.close();
    }
  });
});
