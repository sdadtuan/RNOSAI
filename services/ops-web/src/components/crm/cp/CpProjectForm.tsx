'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  createCpProject,
  getCpProjectLookups,
  type CpProjectInput,
  type CpProjectLookups,
} from '@/lib/crm/cp-api';
import {
  formatLifecycleOption,
  formatStaffOption,
  industryFromClient,
  parseMemberStaffIds,
} from '@/lib/crm/cp-project-form.util';

function optional(form: FormData, key: string): string | null {
  return String(form.get(key) ?? '').trim() || null;
}

const EMPTY_LOOKUPS: CpProjectLookups = { clients: [], staff: [], lifecycles: [] };

export function CpProjectForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [lookups, setLookups] = useState<CpProjectLookups>(EMPTY_LOOKUPS);
  const [clientId, setClientId] = useState('');
  const [industry, setIndustry] = useState('');

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    void getCpProjectLookups(token)
      .then(setLookups)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Không tải được danh mục khách / owner');
      });
  }, []);

  const selectedClient = useMemo(
    () => lookups.clients.find((row) => row.id === clientId) ?? null,
    [clientId, lookups.clients],
  );

  function onClientChange(value: string) {
    setClientId(value);
    const next = lookups.clients.find((row) => row.id === value);
    setIndustry(industryFromClient(next));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    const form = new FormData(event.currentTarget);
    const credit = optional(form, 'credit_budget');
    const memberStaffIds = parseMemberStaffIds(form.getAll('member_staff_ids').map(String));
    const input: CpProjectInput = {
      name: String(form.get('name') ?? '').trim(),
      agency_client_id: String(form.get('agency_client_id') ?? '').trim(),
      owner_staff_id: Number(form.get('owner_staff_id')),
      lifecycle_id: optional(form, 'lifecycle_id'),
      industry: industry.trim() || null,
      objective: optional(form, 'objective'),
      start_at: optional(form, 'start_at'),
      due_at: optional(form, 'due_at'),
      status: 'draft',
      credit_budget: credit == null ? null : Number(credit),
      cost_center: optional(form, 'cost_center'),
      tags: String(form.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
      member_staff_ids: memberStaffIds,
    };
    setSubmitting(true);
    setError('');
    try {
      const project = await createCpProject(token, input);
      router.push(`/crm/creative-os/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được project');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cp-overview">
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Tạo project</p>
          <h1>Tạo project</h1>
          <p className="cp-muted">PRJ-02 · khách agency_client bắt buộc. Không tạo khách ma.</p>
        </div>
        <div className="cp-overview__actions">
          <Link className="cp-btn" href="/crm/creative-os/projects">Hủy</Link>
          <button className="cp-btn cp-btn--primary" form="cp-prj-02" type="submit" disabled={submitting}>
            {submitting ? 'Đang tạo…' : 'Tạo project'}
          </button>
        </div>
      </header>

      {error ? <section className="cp-card cp-card--error"><p>{error}</p></section> : null}

      <form id="cp-prj-02" className="cp-overview" onSubmit={submit}>
        <div className="cp-overview-grid">
          <section className="cp-card cp-filters">
            <label><span>Tên *</span><input name="name" required /></label>
            <label>
              <span>Khách (agency_client) *</span>
              <select
                name="agency_client_id"
                required
                value={clientId}
                onChange={(event) => onClientChange(event.target.value)}
              >
                <option value="">Chọn khách</option>
                {lookups.clients.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Lifecycle (tùy chọn)</span>
              <select name="lifecycle_id" defaultValue="">
                <option value="">Không gắn lifecycle</option>
                {lookups.lifecycles.map((row) => (
                  <option key={row.id} value={row.id}>{formatLifecycleOption(row)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Ngành</span>
              <input
                name="industry"
                value={industry}
                onChange={(event) => setIndustry(event.target.value)}
                placeholder={selectedClient ? '' : 'Chọn khách để copy ngành'}
              />
            </label>
            <label><span>Mục tiêu</span><textarea name="objective" rows={4} /></label>
          </section>
          <section className="cp-card cp-filters">
            <label>
              <span>Bắt đầu / Hạn</span>
              <div className="cp-form-2">
                <input name="start_at" type="date" />
                <input name="due_at" type="date" />
              </div>
            </label>
            <label>
              <span>Owner *</span>
              <select name="owner_staff_id" required defaultValue="">
                <option value="">Chọn owner</option>
                {lookups.staff.map((row) => (
                  <option key={row.id} value={row.id}>{formatStaffOption(row)}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Team (project member)</span>
              <select name="member_staff_ids" multiple size={5}>
                {lookups.staff.map((row) => (
                  <option key={row.id} value={row.id}>{formatStaffOption(row)}</option>
                ))}
              </select>
            </label>
            <label><span>Credit budget</span><input name="credit_budget" type="number" min="0" /></label>
            <label><span>Cost center</span><input name="cost_center" /></label>
            <label><span>Tags</span><input name="tags" placeholder="q3, always-on, ai-video" /></label>
          </section>
        </div>
        <p className="cp-note">Không tạo khách ma. AM 360 là SoR. Campaign = lifecycle, không bảng campaign 2.</p>
      </form>
    </div>
  );
}
