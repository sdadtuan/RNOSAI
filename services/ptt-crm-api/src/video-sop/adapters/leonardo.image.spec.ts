import { LeonardoImageGen } from './leonardo.image';

describe('LeonardoImageGen HTTP mapping', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('maps 429 to rate_limit without parsing JSON', async () => {
    const json = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      status: 429,
      ok: false,
      json,
    } as unknown as Response);

    const gen = new LeonardoImageGen('key');
    await expect(gen.generate({ prompt: 'x', width: 1, height: 1 })).rejects.toMatchObject({
      error_class: 'rate_limit',
    });
    expect(json).not.toHaveBeenCalled();
  });
});
