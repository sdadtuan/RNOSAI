import { deviceLabelFromUa } from './staff-device-label.util';

describe('deviceLabelFromUa', () => {
  it('parses Chrome macOS', () => {
    expect(
      deviceLabelFromUa(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ),
    ).toBe('Chrome · macOS');
  });

  it('parses Safari iPhone', () => {
    expect(
      deviceLabelFromUa(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari · iPhone');
  });

  it('unknown empty', () => {
    expect(deviceLabelFromUa('')).toBe('Không rõ');
  });
});
