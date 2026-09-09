export type SkpiClassification =
  | 'COMMITTED_DELIVERABLE'
  | 'QUALITY_STANDARD'
  | 'OPTIMIZATION_TARGET'
  | 'PROJECTED_RESULT'
  | 'BUSINESS_OUTCOME'
  | 'INTERNAL_OPERATIONAL';

const WORDING: Record<SkpiClassification, string> = {
  COMMITTED_DELIVERABLE: 'Cam kết giao hàng',
  QUALITY_STANDARD: 'Tiêu chuẩn chất lượng',
  OPTIMIZATION_TARGET: 'Mục tiêu tối ưu',
  PROJECTED_RESULT: 'Kết quả dự kiến',
  BUSINESS_OUTCOME: 'Kết quả kinh doanh',
  INTERNAL_OPERATIONAL: 'Vận hành nội bộ',
};

export function clientWording(classification: SkpiClassification): string {
  return WORDING[classification] ?? classification;
}

export function isInternalOnly(classification: SkpiClassification): boolean {
  return classification === 'INTERNAL_OPERATIONAL';
}
