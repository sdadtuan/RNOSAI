import { fetchClientPlanSources } from './client-plan-source.util';

const PAGE = `<html><head><meta property="og:image" content="https://cdn.example/a.jpg"></head><body><p>đối thủ Studio B</p></body></html>`;

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

describe('fetchClientPlanSources', () => {
  it('keeps competitor text and the one og:image', async () => {
    const fetchImpl = jest.fn(async () => htmlResponse(PAGE));
    const result = await fetchClientPlanSources(['https://studio.example/'], fetchImpl);
    expect(result.text).toContain('đối thủ Studio B');
    expect(result.image_urls).toEqual(['https://cdn.example/a.jpg']);
    expect(result.fetched_urls).toEqual(['https://studio.example/']);
    expect(result.errors).toEqual([]);
  });

  it('returns an error for loopback and does not throw', async () => {
    const fetchImpl = jest.fn();
    const result = await fetchClientPlanSources(['http://127.0.0.1/'], fetchImpl);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.fetched_urls).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('resolves a relative image and ignores a non-http url', async () => {
    const fetchImpl = jest.fn(async () =>
      htmlResponse('<img src="/cover.jpg"><img src="data:image/gif;base64,aaaa">'),
    );
    const result = await fetchClientPlanSources(['https://studio.example/about', 'ftp://files.example/a'], fetchImpl);
    expect(result.image_urls).toEqual(['https://studio.example/cover.jpg']);
    expect(result.errors.some((line) => line.includes('ftp://files.example/a'))).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('caps text and image count', async () => {
    const imgs = Array.from({ length: 10 }, (_, i) => `<img src="https://cdn.example/${i}.jpg">`).join('');
    const fetchImpl = jest.fn(async () => htmlResponse(`<p>${'a'.repeat(20_000)}</p>${imgs}`));
    const result = await fetchClientPlanSources(['https://studio.example/'], fetchImpl);
    expect(result.text.length).toBeLessThanOrEqual(12_000);
    expect(result.image_urls).toHaveLength(8);
  });
});
