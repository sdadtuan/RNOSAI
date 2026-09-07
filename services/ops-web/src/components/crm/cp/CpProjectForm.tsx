'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { createCpProject, type CpProjectInput } from '@/lib/crm/cp-api';

function optional(form: FormData, key: string): string | null {
  return String(form.get(key) ?? '').trim() || null;
}

export function CpProjectForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    const form = new FormData(event.currentTarget);
    const credit = optional(form, 'credit_budget');
    const input: CpProjectInput = {
      name: String(form.get('name') ?? '').trim(),
      agency_client_id: String(form.get('agency_client_id') ?? '').trim(),
      owner_staff_id: Number(form.get('owner_staff_id')),
      lifecycle_id: optional(form, 'lifecycle_id'),
      industry: optional(form, 'industry'),
      objective: optional(form, 'objective'),
      start_at: optional(form, 'start_at'),
      due_at: optional(form, 'due_at'),
      status: String(form.get('status') ?? 'draft'),
      credit_budget: credit == null ? null : Number(credit),
      cost_center: optional(form, 'cost_center'),
      tags: String(form.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean),
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
          <p className="cp-muted">Khách hàng, owner và tên project là bắt buộc.</p>
        </div>
        <Link className="cp-btn" href="/crm/creative-os/projects">Hủy</Link>
      </header>

      {error ? <section className="cp-card cp-card--error"><p>{error}</p></section> : null}

      <form className="cp-overview" onSubmit={submit}>
        <div className="cp-overview-grid">
          <section className="cp-card cp-filters">
            <label><span>Tên *</span><input name="name" required /></label>
            <label><span>Khách (agency_client) *</span><input name="agency_client_id" required /></label>
            <label><span>Lifecycle</span><input name="lifecycle_id" inputMode="numeric" /></label>
            <label><span>Ngành</span><input name="industry" /></label>
            <label><span>Mục tiêu</span><textarea name="objective" rows={4} /></label>
            <label>
              <span>Trạng thái</span>
              <select name="status" defaultValue="draft">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="at_risk">At Risk</option>
                <option value="in_review">In Review</option>
              </select>
            </label>
          </section>
          <section className="cp-card cp-filters">
            <label><span>Bắt đầu</span><input name="start_at" type="date" /></label>
            <label><span>Hạn</span><input name="due_at" type="date" /></label>
            <label><span>Owner *</span><input name="owner_staff_id" type="number" min="1" required /></label>
            <label><span>Members</span><input name="members" placeholder="Staff IDs hoặc tên thành viên" /></label>
            <label><span>Credit budget</span><input name="credit_budget" type="number" min="0" /></label>
            <label><span>Cost center</span><input name="cost_center" /></label>
            <label><span>Tags</span><input name="tags" placeholder="q3, always-on, ai-video" /></label>
          </section>
        </div>
        <button className="cp-btn cp-btn--primary" type="submit" disabled={submitting}>
          {submitting ? 'Đang tạo…' : 'Tạo project'}
        </button>
      </form>
    </div>
  );
}
