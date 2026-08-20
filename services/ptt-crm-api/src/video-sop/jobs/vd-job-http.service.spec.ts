import { BadRequestException } from '@nestjs/common';
import { VdJobHttpService } from './vd-job-http.service';

function makeService() {
  const config = { contentMarketingVideoCinematicEnabled: true };
  const dispatcher = { enqueue: jest.fn() };
  const jobs = { listByProjectId: jest.fn(), getById: jest.fn() };
  const svc = new VdJobHttpService(config as never, dispatcher as never, jobs as never);
  return { svc, dispatcher };
}

describe('VdJobHttpService', () => {
  it('rejects null or undefined enqueue body with invalid_body', async () => {
    const { svc, dispatcher } = makeService();

    for (const body of [null, undefined]) {
      try {
        await svc.enqueue(1, body as never, 'key-1');
        throw new Error('expected invalid_body');
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getStatus()).toBe(400);
        expect((err as BadRequestException).getResponse()).toEqual(
          expect.objectContaining({ error: 'invalid_body' }),
        );
      }
    }

    expect(dispatcher.enqueue).not.toHaveBeenCalled();
  });
});
