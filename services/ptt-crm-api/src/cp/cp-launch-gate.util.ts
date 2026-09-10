export const CP_CREATIVE_VERSION_PREFIX = 'cp_version:';

export const CP_ADS_QC_TEMPLATES = new Set([
  're_lead_default',
]);

export type CpLaunchGateCheck = {
  check: string;
  result: string;
  reason?: string | null;
};

export function buildCpCreativeDescription(versionId: string): string {
  return `${CP_CREATIVE_VERSION_PREFIX}${versionId}`;
}

export function parseCpVersionIdFromDescription(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (text.startsWith(CP_CREATIVE_VERSION_PREFIX)) {
    const id = text.slice(CP_CREATIVE_VERSION_PREFIX.length).trim();
    return isUuid(id) ? id : null;
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const linked = String(parsed.cp_version_id ?? parsed.video_version_id ?? '').trim();
    return isUuid(linked) ? linked : null;
  } catch {
    return null;
  }
}

export function requiresCpQcForTemplate(templateId: string): boolean {
  return CP_ADS_QC_TEMPLATES.has(String(templateId ?? '').trim());
}

export function buildQcBlockedResponse(input: {
  qcStatus: string | null;
  checks?: CpLaunchGateCheck[];
}): Record<string, unknown> {
  return {
    error: 'qc_blocked',
    qc_status: input.qcStatus,
    checks: input.checks ?? [{
      check: 'qc_status',
      result: input.qcStatus ?? 'unknown',
    }],
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
