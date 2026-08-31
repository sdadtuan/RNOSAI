import { BadRequestException, HttpException } from '@nestjs/common';
import { extractHttpErrorMessage } from './http-error.util';

describe('extractHttpErrorMessage', () => {
  it('reads string BadRequestException body', () => {
    const err = new BadRequestException('Thiếu staff id');
    expect(extractHttpErrorMessage(err)).toBe('Thiếu staff id');
  });

  it('reads object BadRequestException body', () => {
    const err = new BadRequestException({ error: 'Gate blocked', message: 'Hoàn thành task Lead' });
    expect(extractHttpErrorMessage(err)).toBe('Hoàn thành task Lead');
  });

  it('does not return generic Bad Request Exception', () => {
    const err = new BadRequestException({ error: 'Thiếu staff id' });
    expect(extractHttpErrorMessage(err)).toBe('Thiếu staff id');
  });

  it('reads plain Error', () => {
    expect(extractHttpErrorMessage(new Error('Lead đã được giao Solution.'))).toBe(
      'Lead đã được giao Solution.',
    );
  });

  it('re-throws HttpException unchanged via controller pattern', () => {
    const err = new HttpException({ error: 'x', message: 'y' }, 400);
    expect(extractHttpErrorMessage(err)).toBe('y');
  });
});
