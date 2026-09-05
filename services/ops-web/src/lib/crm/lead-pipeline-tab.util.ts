import { showPresalesForFlow, type LeadFlowKind } from '@/lib/crm/lead-flow-kind';
import type { PresalesFunnelStepKey } from '@/lib/crm/funnel-stepper.types';

export type LeadWorkspaceDesktopTab = 'pipeline' | 'contract' | 'consult' | 'lmp';

export type PipelineTabDefaultInput = {
  flowKind: LeadFlowKind;
  status: string;
  contractActive: boolean;
  hash: string;
  searchTab: string | null;
  showConsult: boolean;
  showLmp: boolean;
};

export function shouldShowPipelineTab(flowKind: LeadFlowKind): boolean {
  return showPresalesForFlow(flowKind);
}

export function pipelineStepQuery(step: PresalesFunnelStepKey): string {
  return `?tab=pipeline&step=${step}`;
}

export function mapLegacyHashToPipeline(
  hash: string,
  presalesStage?: string | null,
): { tab: 'pipeline'; step: PresalesFunnelStepKey } | null {
  const h = hash.startsWith('#') ? hash : hash ? `#${hash}` : '';
  if (h === '#funnel-b2') return { tab: 'pipeline', step: 'b2' };
  if (h === '#funnel-presales') {
    if (presalesStage === 'consult' || presalesStage === 'proposal') {
      return { tab: 'pipeline', step: presalesStage };
    }
    return { tab: 'pipeline', step: 'presales_lead' };
  }
  if (h === '#funnel-presales-r5') {
    return {
      tab: 'pipeline',
      step: presalesStage === 'proposal' ? 'proposal' : 'consult',
    };
  }
  return null;
}

const TABS: LeadWorkspaceDesktopTab[] = ['pipeline', 'contract', 'consult', 'lmp'];

export function defaultLeadWorkspaceTab(input: PipelineTabDefaultInput): LeadWorkspaceDesktopTab {
  const fromHash = mapLegacyHashToPipeline(input.hash);
  if (fromHash) return fromHash.tab;

  const requested = TABS.find((t) => t === input.searchTab);
  if (requested === 'consult' && input.showConsult) return 'consult';
  if (requested === 'lmp' && input.showLmp) return 'lmp';
  if (requested === 'contract') return 'contract';
  if (requested === 'pipeline' && shouldShowPipelineTab(input.flowKind)) return 'pipeline';

  if (!shouldShowPipelineTab(input.flowKind)) return 'contract';
  if (input.status === 'won' && input.contractActive) return 'contract';
  return 'pipeline';
}
