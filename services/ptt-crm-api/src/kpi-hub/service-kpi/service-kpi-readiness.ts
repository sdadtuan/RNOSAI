import type { SkpiClassification } from './service-kpi-classification';

export type ReadinessLevel = 'pass' | 'warning' | 'blocking' | 'approval_required';

export type ReadinessInput = {
  classification: SkpiClassification;
  clientVisible: boolean;
  hasDefinition: boolean;
  hasQuantityOrTarget: boolean;
  hasDisclaimer: boolean;
  hasAssumption: boolean;
  hasScenario: boolean;
  hasDataSource: boolean;
  hasOwner: boolean;
  hasAcceptance?: boolean;
};

export type ReadinessResult = {
  level: ReadinessLevel;
  errors: Array<{ field: string; message: string }>;
};

export function validateReadiness(input: ReadinessInput): ReadinessResult {
  const errors: ReadinessResult['errors'] = [];

  if (!input.hasDefinition) {
    errors.push({ field: 'definition', message: 'Thiếu định nghĩa KPI' });
  }
  if (!input.hasOwner) {
    errors.push({ field: 'owner', message: 'Thiếu owner' });
  }
  if (!input.hasDataSource) {
    errors.push({ field: 'data_source', message: 'Thiếu nguồn dữ liệu' });
  }

  if (input.classification === 'INTERNAL_OPERATIONAL') {
    if (errors.length) return { level: 'blocking', errors };
    return { level: 'pass', errors: [] };
  }

  if (input.classification === 'COMMITTED_DELIVERABLE') {
    if (!input.hasQuantityOrTarget) {
      errors.push({ field: 'target', message: 'Cam kết giao hàng cần target/số lượng' });
    }
    if (!input.hasAcceptance) {
      errors.push({ field: 'acceptance', message: 'Thiếu tiêu chí nghiệm thu (warning)' });
    }
  }

  if (
    (input.classification === 'OPTIMIZATION_TARGET' || input.classification === 'PROJECTED_RESULT') &&
    input.clientVisible
  ) {
    if (!input.hasDisclaimer) {
      errors.push({ field: 'disclaimer', message: 'Client-visible cần disclaimer' });
    }
    if (!input.hasAssumption) {
      errors.push({ field: 'assumption', message: 'Client-visible cần assumption' });
    }
  }

  if (input.classification === 'PROJECTED_RESULT' && !input.hasScenario) {
    errors.push({ field: 'scenario', message: 'PROJECTED_RESULT cần scenario' });
  }

  if (input.classification === 'BUSINESS_OUTCOME' && input.clientVisible && !input.hasDisclaimer) {
    errors.push({ field: 'disclaimer', message: 'BUSINESS_OUTCOME client-visible cần disclaimer' });
  }

  const blockingFields = new Set(['definition', 'owner', 'data_source', 'target', 'disclaimer', 'assumption', 'scenario']);
  const hasBlocking = errors.some((e) => blockingFields.has(e.field));
  if (hasBlocking) return { level: 'blocking', errors };

  const hasWarning = errors.some((e) => e.field === 'acceptance');
  if (hasWarning) return { level: 'warning', errors };

  return { level: 'pass', errors: [] };
}
