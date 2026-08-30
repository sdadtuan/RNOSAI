export function confirmCopy(action: {
  action_id: string;
  preview_vi: string;
  params: Record<string, unknown>;
}): string {
  const preview = String(action.preview_vi ?? '').trim();
  if (preview) return preview;
  return `Xác nhận ${action.action_id}?`;
}
