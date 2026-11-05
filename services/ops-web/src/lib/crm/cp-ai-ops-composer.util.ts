export const MAGNIFIC_COMPOSER_STEPS = [
  { id: 'context', label: '1. Kết nối' },
  { id: 'prompt', label: '2. Prompt' },
  { id: 'confirm', label: '3. Ước tính và xác nhận' },
] as const;

export const MAGNIFIC_HUMAN_ROUTE_COPY = 'Người chọn API hoặc MCP. Không tự đốt credit.';

export function magnificComposerEmptyCopy(disabled: boolean): string {
  return disabled ? '—' : '';
}
