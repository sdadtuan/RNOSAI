import { buildLoraJsonlLine, canStartLora, shouldExportTurn } from './sales-kit-learn-export.util';

describe('sales-kit-learn-export.util', () => {
  it('builds jsonl line', () => {
    const line = buildLoraJsonlLine({
      systemPrompt: 's',
      userContent: 'u',
      assistant: 'a',
    });
    expect(JSON.parse(line).messages).toHaveLength(3);
  });

  it('gates lora by enabled and min pairs', () => {
    expect(canStartLora({ enabled: false, pairs: 300, minPairs: 200 }).ok).toBe(false);
    expect(canStartLora({ enabled: true, pairs: 50, minPairs: 200 }).ok).toBe(false);
    expect(canStartLora({ enabled: true, pairs: 250, minPairs: 200 }).ok).toBe(true);
  });

  it('filters export turns', () => {
    expect(
      shouldExportTurn({ rating: 'up', stub_mode: false, reply_vi: 'ok' }),
    ).toBe(true);
    expect(
      shouldExportTurn({ rating: 'down', stub_mode: false, reply_vi: 'ok' }),
    ).toBe(false);
    expect(
      shouldExportTurn({ rating: 'up', stub_mode: true, reply_vi: 'ok' }),
    ).toBe(false);
  });
});
