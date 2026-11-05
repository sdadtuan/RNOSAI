export class QuoteError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(status: number, code: string, details: Record<string, unknown> = {}, message = code) {
    super(message);
    this.name = 'QuoteError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
