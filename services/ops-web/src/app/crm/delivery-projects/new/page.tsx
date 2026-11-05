'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { DeliveryPageGate } from '@/components/delivery/DeliveryPageGate';
import { DeliveryWizardStepper } from '@/components/delivery/DeliveryWizardStepper';
import {
  WizardStep1Basic,
  defaultWizardStep1Values,
  type WizardStep1Values,
} from '@/components/delivery/WizardStep1Basic';
import { WizardStep2Scope } from '@/components/delivery/WizardStep2Scope';
import { WizardStep3Milestone } from '@/components/delivery/WizardStep3Milestone';
import { WizardBudgetStep } from '@/components/delivery/WizardBudgetStep';
import type { BudgetItemRow, ResourceRow } from '@/components/delivery/WizardBudgetStep';
import { WizardKpiStep } from '@/components/delivery/WizardKpiStep';
import { DictPickerOverlay } from '@/components/delivery/DictPickerOverlay';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import {
  createDeliveryProject,
  fetchDeliveryProject,
  fetchBudgetItems,
  fetchResources,
  saveDeliveryWizard,
  validateDeliveryDeps,
  type DeliveryDeliverableInput,
  type DeliveryMilestoneInput,
} from '@/lib/delivery-projects-api';
import { wizardFooter } from '@/lib/delivery-wizard.util';
import { hasCapability, normalizeCapabilities } from '@/lib/delivery-projects.util';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  type StoredStaffUser,
} from '@/lib/auth';
import { staffRefresh } from '@/lib/api';

function parseStep(raw: string | null): number {
  const n = Number(raw ?? '1');
  return n >= 1 && n <= 5 ? n : 1;
}

export default function DeliveryProjectNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');
  const step = parseStep(searchParams.get('step'));

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [step1, setStep1] = useState<WizardStep1Values>(() => defaultWizardStep1Values({}));
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [deliverables, setDeliverables] = useState<DeliveryDeliverableInput[]>([]);
  const [outOfScope, setOutOfScope] = useState('');
  const [assumptions, setAssumptions] = useState('');
  const [dismissedConflicts, setDismissedConflicts] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<DeliveryMilestoneInput[]>([]);
  const [depsText, setDepsText] = useState<Record<string, string>>({});
  const [contractBudget, setContractBudget] = useState('');
  const [contingency, setContingency] = useState('');
  const [budgetItems, setBudgetItems] = useState<BudgetItemRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [depError, setDepError] = useState('');
  const [toast, setToast] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [projectRow, setProjectRow] = useState<Awaited<ReturnType<typeof fetchDeliveryProject>> | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const canManageB2b = Boolean(user && hasCap(user, 'crm_b2b_projects', 'manage'));
  const canEditDelivery = Boolean(user && hasCap(user, 'crm_delivery_projects', 'edit'));

  useEffect(() => {
    if (!user) return;
    setStep1((prev) =>
      defaultWizardStep1Values({
        defaultLead: canManageB2b && !prev.capabilities.length,
        defaultDelivery: canEditDelivery && !prev.capabilities.length,
      }),
    );
  }, [user, canManageB2b, canEditDelivery]);

  useEffect(() => {
    if (!projectId) return;
    const token = getAccessToken();
    if (!token) return;
    void fetchDeliveryProject(token, projectId).then((row) => {
      const caps = normalizeCapabilities(row.capabilities);
      if (step >= 2 && !hasCapability(caps, 'delivery')) {
        router.replace('/crm/delivery-projects/new?step=1');
      }
      setStep1((prev) => ({
        ...prev,
        name: row.name,
        capabilities: caps,
        customer_id: row.customer_id != null ? String(row.customer_id) : '',
        project_type: row.project_type,
        priority: row.priority,
        pm_staff_id: row.pm_staff_id != null ? String(row.pm_staff_id) : '',
        am_staff_id: row.am_staff_id != null ? String(row.am_staff_id) : '',
        start_date: row.start_date ?? '',
        end_date: row.end_date ?? '',
        description: row.description,
        ingest_code: row.ingest_code ?? '',
      }));
      setProjectRow(row);
    });
  }, [projectId, router, step]);

  useEffect(() => {
    if (!projectId || step < 4) return;
    const token = getAccessToken();
    if (!token) return;
    void fetchBudgetItems(token, projectId).then((out) => {
      const header = out.header as {
        contract_budget?: string | null;
        contingency_amount?: string | null;
      } | null;
      if (header?.contract_budget) setContractBudget(header.contract_budget);
      if (header?.contingency_amount) setContingency(header.contingency_amount);
      setBudgetItems(
        out.items.map((i) => ({
          id: i.id,
          name: i.name,
          kind: i.kind,
          media_borne: i.media_borne,
          service_code: i.service_code,
          approved_budget: i.approved_budget,
          forecast: i.forecast,
          actual: i.actual,
        })),
      );
    });
    void fetchResources(token, projectId).then((out) => {
      setResources(
        out.items.map((r) => ({
          id: r.id,
          staff_id: r.staff_id,
          role_name: r.role_name,
          allocation_pct: r.allocation_pct,
          start_date: r.start_date,
          end_date: r.end_date,
        })),
      );
    });
  }, [projectId, step]);

  const ensureToken = useCallback(async (): Promise<string | null> => {
    let token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return null;
    }
    return token;
  }, [router]);

  async function createProject(): Promise<string | null> {
    const caps = normalizeCapabilities(step1.capabilities);
    if (!caps.length) {
      setError('Chọn ít nhất một năng lực');
      return null;
    }
    const token = await ensureToken();
    if (!token) return null;
    setBusy(true);
    setError('');
    try {
      const row = await createDeliveryProject(token, {
        name: step1.name.trim(),
        capabilities: caps,
        customer_id: step1.customer_id ? Number(step1.customer_id) : null,
        project_type: step1.project_type,
        priority: step1.priority,
        pm_staff_id: step1.pm_staff_id ? Number(step1.pm_staff_id) : null,
        am_staff_id: step1.am_staff_id ? Number(step1.am_staff_id) : null,
        start_date: step1.start_date || null,
        end_date: step1.end_date || null,
        description: step1.description,
        b2b: caps.includes('lead_ingest')
          ? {
              code: step1.ingest_code,
              name: step1.name.trim(),
              ai_call_enabled: step1.ai_call_enabled,
              manual_ingest_enabled: step1.manual_ingest_enabled,
            }
          : undefined,
      });
      return row.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo dự án thất bại');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function onStep1Primary() {
    const footer = wizardFooter(normalizeCapabilities(step1.capabilities));
    const id = projectId ?? (await createProject());
    if (!id) return;
    if (footer.primary === 'continue_scope') {
      router.push(`/crm/delivery-projects/new?id=${encodeURIComponent(id)}&step=2`);
      return;
    }
    router.push('/crm/delivery-projects');
  }

  async function onStep2Continue() {
    const token = await ensureToken();
    if (!token || !projectId) return;
    setBusy(true);
    setError('');
    try {
      await saveDeliveryWizard(token, projectId, {
        step: 2,
        services: selectedServices,
        deliverables,
        state_json: { out_of_scope: outOfScope, assumptions, dismissed_conflicts: dismissedConflicts },
      });
      router.push(`/crm/delivery-projects/new?id=${encodeURIComponent(projectId)}&step=3`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu phạm vi thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onStep3Continue() {
    const token = await ensureToken();
    if (!token || !projectId) return;
    const deps: Array<{ from: string; to: string }> = [];
    for (const m of milestones) {
      for (const to of (depsText[m.code] ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
        deps.push({ from: m.code, to });
      }
    }
    setBusy(true);
    setError('');
    setDepError('');
    try {
      const validation = await validateDeliveryDeps(token, projectId, deps);
      if (validation.circular) {
        setDepError('Phụ thuộc vòng');
        return;
      }
      await saveDeliveryWizard(token, projectId, {
        step: 3,
        milestones,
        deps,
        state_json: { start_date: step1.start_date, end_date: step1.end_date },
      });
      router.push(`/crm/delivery-projects/new?id=${encodeURIComponent(projectId)}&step=4`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu milestone thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function onStep4Continue() {
    const token = await ensureToken();
    if (!token || !projectId) return;
    setBusy(true);
    setError('');
    try {
      await saveDeliveryWizard(token, projectId, {
        step: 4,
        contract_budget: contractBudget || null,
        contingency_amount: contingency || null,
        state_json: { budget_method: 'service_items' },
      });
      router.push(`/crm/delivery-projects/new?id=${encodeURIComponent(projectId)}&step=5`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu ngân sách thất bại');
    } finally {
      setBusy(false);
    }
  }

  function onStepClick(target: number) {
    if (target >= 4 && !projectId) {
      setToast('Lưu bước 1–3 trước');
      setTimeout(() => setToast(''), 4000);
      return;
    }
    if (projectId) {
      router.push(`/crm/delivery-projects/new?id=${encodeURIComponent(projectId)}&step=${target}`);
    } else if (target === 1) {
      router.push('/crm/delivery-projects/new?step=1');
    }
  }

  const showLaterSteps = wizardFooter(normalizeCapabilities(step1.capabilities)).showSteps2to5;

  return (
    <DeliveryPageGate>
      <KpiHubShell
        title="+ Tạo dự án"
        subtitle="Wizard Project Delivery — Wave B"
        breadcrumb={[
          { label: 'Project Delivery', href: '/crm/delivery-projects' },
          { label: 'Tạo mới' },
        ]}
        actions={
          <Link href="/crm/delivery-projects" className="kpi-hub-btn kpi-hub-btn--ghost">
            Hủy
          </Link>
        }
      >
        <div className="delivery-wizard">
          {toast ? <div className="delivery-toast">{toast}</div> : null}
          <DeliveryWizardStepper current={step} showLaterSteps={showLaterSteps} onStepClick={onStepClick} />

          {step === 1 ? (
            <WizardStep1Basic
              values={step1}
              onChange={setStep1}
              canManageB2b={canManageB2b}
              canEditDelivery={canEditDelivery}
              busy={busy}
              error={error}
              onCancel={() => router.push('/crm/delivery-projects')}
              onSaveDraft={() => void onStep1Primary()}
              onPrimary={() => void onStep1Primary()}
            />
          ) : null}

          {step === 2 ? (
            <WizardStep2Scope
              selectedServices={selectedServices}
              deliverables={deliverables}
              outOfScope={outOfScope}
              assumptions={assumptions}
              dismissedConflicts={dismissedConflicts}
              busy={busy}
              error={error}
              onChange={(patch) => {
                if (patch.selectedServices) setSelectedServices(patch.selectedServices);
                if (patch.deliverables) setDeliverables(patch.deliverables);
                if (patch.outOfScope != null) setOutOfScope(patch.outOfScope);
                if (patch.assumptions != null) setAssumptions(patch.assumptions);
                if (patch.dismissedConflicts) setDismissedConflicts(patch.dismissedConflicts);
              }}
              onBack={() => router.push(`/crm/delivery-projects/new?id=${projectId}&step=1`)}
              onContinue={() => void onStep2Continue()}
            />
          ) : null}

          {step === 3 ? (
            <WizardStep3Milestone
              startDate={step1.start_date}
              endDate={step1.end_date}
              milestones={milestones}
              depsText={depsText}
              busy={busy}
              error={error}
              depError={depError}
              onChange={(patch) => {
                if (patch.startDate != null) setStep1((s) => ({ ...s, start_date: patch.startDate! }));
                if (patch.endDate != null) setStep1((s) => ({ ...s, end_date: patch.endDate! }));
                if (patch.milestones) setMilestones(patch.milestones);
                if (patch.depsText) setDepsText(patch.depsText);
              }}
              onBack={() => router.push(`/crm/delivery-projects/new?id=${projectId}&step=2`)}
              onContinue={() => void onStep3Continue()}
            />
          ) : null}

          {step === 4 && projectId ? (
            <WizardBudgetStep
              projectId={projectId}
              projectCode={projectRow?.code}
              projectName={step1.name}
              serviceCodes={selectedServices}
              milestones={milestones}
              contractBudget={contractBudget}
              contingency={contingency}
              items={budgetItems}
              resources={resources}
              busy={busy}
              error={error}
              canEdit={canEditDelivery}
              token={getAccessToken() ?? ''}
              onChangeContract={setContractBudget}
              onChangeContingency={setContingency}
              onItemsChange={setBudgetItems}
              onResourcesChange={setResources}
              onBack={() => router.push(`/crm/delivery-projects/new?id=${projectId}&step=3`)}
              onContinue={() => void onStep4Continue()}
            />
          ) : null}

          {step === 5 && projectId && projectRow ? (
            <>
              <WizardKpiStep
                project={projectRow}
                token={getAccessToken() ?? ''}
                busy={busy}
                error={error}
                onBusyChange={setBusy}
                onError={setError}
                onOpenPicker={() => setPickerOpen(true)}
                onBack={() => onStepClick(4)}
                onSubmitted={() => router.push('/crm/delivery-projects')}
              />
              <DictPickerOverlay
                open={pickerOpen}
                projectId={projectId}
                projectLabel={`${projectRow.code ?? '—'} · ${projectRow.name}`}
                token={getAccessToken() ?? ''}
                onClose={() => setPickerOpen(false)}
                onAttached={() => {
                  setPickerOpen(false);
                  setToast(`Đã chọn KPI — đang gắn…`);
                  setTimeout(() => setToast(''), 3000);
                }}
              />
            </>
          ) : null}

          {step === 5 && (!projectId || !projectRow) ? (
            <div className="delivery-wizard-panel">
              <p className="delivery-empty-hint">Hoàn thành các bước trước để mở KPI & Xác nhận.</p>
            </div>
          ) : null}
        </div>
      </KpiHubShell>
    </DeliveryPageGate>
  );
}
