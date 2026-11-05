export const REVIEW_RELEASE_SPLITS = [
  { value: 'reset_closer', label: 'Đặt lại theo tỷ lệ hoa hồng của dự án' },
  { value: 'keep_first_touch', label: 'Giữ tỷ lệ first-touch hiện có' },
  { value: 'no_split', label: 'Không cập nhật hoa hồng' },
] as const;

export type ReviewReleaseSplit = (typeof REVIEW_RELEASE_SPLITS)[number]['value'];

export const DEFAULT_REVIEW_RELEASE_SPLIT: ReviewReleaseSplit = 'reset_closer';

export function reviewReleaseSplitLabel(split: ReviewReleaseSplit): string {
  return REVIEW_RELEASE_SPLITS.find((row) => row.value === split)?.label ?? split;
}
