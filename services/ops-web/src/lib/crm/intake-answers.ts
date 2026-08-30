import { mergeBantChecklistPatch, type BantChecklistState } from '@/lib/crm/intake-bant-checklist';
import { buildDiscoveryAnswersPatch, type DiscoveryChecklistState } from '@/lib/crm/intake-discovery';
import { buildRedFlagsPatch, type IntakeRedFlagsState } from '@/lib/crm/intake-red-flags';
import {
  mergeQualifyCheckedPatch,
  mergeWinIntelPatch,
  type WinIntelState,
} from '@/lib/crm/intake-win-intel';

export function buildIntakeAnswersPatch(input: {
  existing: Record<string, unknown> | undefined;
  need: string;
  discovery: DiscoveryChecklistState;
  redFlags: IntakeRedFlagsState;
  winIntel: WinIntelState;
  qualifyChecked?: Record<string, boolean>;
  bantChecklist?: BantChecklistState;
}): Record<string, unknown> {
  const withDiscovery = buildDiscoveryAnswersPatch(input.existing, input.need, input.discovery);
  const withFlags = buildRedFlagsPatch(withDiscovery, input.redFlags);
  const withQualify = mergeQualifyCheckedPatch(withFlags, input.qualifyChecked ?? {});
  const withBant = mergeBantChecklistPatch(withQualify, input.bantChecklist ?? {});
  return mergeWinIntelPatch(withBant, input.winIntel);
}
