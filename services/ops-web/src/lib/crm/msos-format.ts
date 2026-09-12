export function formatVnd(amount: number): string {
  return `₫${amount.toLocaleString('vi-VN')}`;
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

export function msosErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Lỗi không xác định';
}
