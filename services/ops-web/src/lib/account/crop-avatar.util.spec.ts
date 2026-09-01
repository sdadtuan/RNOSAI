import { centerSquareCropBox } from './crop-avatar.util';

describe('centerSquareCropBox', () => {
  it('center crop landscape', () => {
    expect(centerSquareCropBox(800, 400)).toEqual({ sx: 200, sy: 0, size: 400 });
  });
});
