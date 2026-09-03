'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createIwrReport,
  fetchIwrDirectory,
  fetchIwrReports,
  patchIwrReport,
  submitIwrReport,
  type IwrReportRow,
  type IwrStaffNode,
} from '@/lib/crm/iwr-api';
import { iwrIsoWeekLabel } from './iwr-format';

type IwrSendDrawerProps = {
  open: boolean;
  token: string;
  canWrite: boolean;
  onClose: () => void;
};

type Chip = { id: number; name: string; email?: string | null };

export function IwrSendDrawer({ open, token, canWrite, onClose }: IwrSendDrawerProps) {
  const router = useRouter();
  const week = iwrIsoWeekLabel();
  const [to, setTo] = useState<Chip[]>([]);
  const [cc, setCc] = useState<Chip[]>([]);
  const [toQ, setToQ] = useState('');
  const [ccQ, setCcQ] = useState('');
  const [toHits, setToHits] = useState<IwrStaffNode[]>([]);
  const [ccHits, setCcHits] = useState<IwrStaffNode[]>([]);
  const [title, setTitle] = useState(`Báo cáo tuần — ${week.label}`);
  const [body, setBody] = useState(
    'Kính gửi anh/chị,\n\nEm gửi báo cáo tuần. Xin anh/chị xem và phản hồi nếu cần bổ sung.\n\nTrân trọng.',
  );
  const [drafts, setDrafts] = useState<IwrReportRow[]>([]);
  const [draftId, setDraftId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !token) return;
    void fetchIwrReports(token, { status: 'draft' })
      .then((out) => {
        const items = out.items ?? [];
        setDrafts(items);
        const weekly = items.find((r) => r.template_code === 'weekly_work');
        if (weekly) {
          setDraftId(weekly.id);
          setTitle(weekly.title || `Báo cáo tuần — ${week.label}`);
        }
      })
      .catch(() => undefined);
  }, [open, token, week.label]);

  useEffect(() => {
    if (!token || toQ.trim().length < 1) {
      setToHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchIwrDirectory(token, toQ.trim(), 'to')
        .then((out) => setToHits(out.items ?? []))
        .catch(() => setToHits([]));
    }, 220);
    return () => window.clearTimeout(t);
  }, [token, toQ]);

  useEffect(() => {
    if (!token || ccQ.trim().length < 1) {
      setCcHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchIwrDirectory(token, ccQ.trim(), 'cc')
        .then((out) => setCcHits(out.items ?? []))
        .catch(() => setCcHits([]));
    }, 220);
    return () => window.clearTimeout(t);
  }, [token, ccQ]);

  if (!open) return null;

  async function send() {
    if (!canWrite || !token) return;
    setBusy(true);
    setErr('');
    try {
      let id = draftId;
      if (!id) {
        const created = await createIwrReport(token, { template_code: 'weekly_work' });
        id = created.id;
      }
      await patchIwrReport(token, id, {
        title,
        sections_json: { notes: { body } },
      });
      await submitIwrReport(token, id, {
        cc_staff_ids: cc.map((c) => c.id),
      });
      onClose();
      router.push(`/crm/internal-reports/${id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gửi báo cáo thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Đóng" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Gửi báo cáo</h2>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose} aria-label="Đóng drawer">
            ✕
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {err && <p className="text-sm text-red-600">{err}</p>}
          {drafts.length > 0 && (
            <label className="block text-xs font-medium text-slate-500">
              Báo cáo nháp
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
                value={draftId}
                onChange={(e) => {
                  setDraftId(e.target.value);
                  const row = drafts.find((d) => d.id === e.target.value);
                  if (row) setTitle(row.title);
                }}
              >
                <option value="">Tạo báo cáo tuần mới</option>
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          <ChipField
            label="To"
            q={toQ}
            onQ={setToQ}
            hits={toHits}
            chips={to}
            onAdd={(s) => {
              setTo((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, { id: s.id, name: s.name, email: s.email }]));
              setToQ('');
              setToHits([]);
            }}
            onRemove={(id) => setTo((prev) => prev.filter((x) => x.id !== id))}
          />
          <ChipField
            label="Cc"
            q={ccQ}
            onQ={setCcQ}
            hits={ccHits}
            chips={cc}
            onAdd={(s) => {
              setCc((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, { id: s.id, name: s.name, email: s.email }]));
              setCcQ('');
              setCcHits([]);
            }}
            onRemove={(id) => setCc((prev) => prev.filter((x) => x.id !== id))}
          />
          <label className="block text-xs font-medium text-slate-500">
            Tiêu đề
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Nội dung
            <textarea
              className="mt-1 min-h-[140px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <div className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
            Quyền truy cập: người nhận To/Cc và quản lý trực tiếp. Nội bộ — không gửi khách.
          </div>
        </div>
        <footer className="border-t px-5 py-4">
          <button
            type="button"
            disabled={busy || !canWrite}
            className="w-full rounded-xl bg-[#0052CC] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void send()}
          >
            {busy ? 'Đang gửi…' : 'Gửi ngay'}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function ChipField({
  label,
  q,
  onQ,
  hits,
  chips,
  onAdd,
  onRemove,
}: {
  label: string;
  q: string;
  onQ: (v: string) => void;
  hits: IwrStaffNode[];
  chips: Chip[];
  onAdd: (s: IwrStaffNode) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
      <div className="flex min-h-[42px] flex-wrap gap-1 rounded-lg border border-slate-200 px-2 py-1.5">
        {chips.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {c.name}
            <button type="button" className="text-slate-400" onClick={() => onRemove(c.id)} aria-label={`Xóa ${c.name}`}>
              ×
            </button>
          </span>
        ))}
        <input
          className="min-w-[120px] flex-1 px-1 py-0.5 text-sm outline-none"
          placeholder="Tìm người nhận…"
          value={q}
          onChange={(e) => onQ(e.target.value)}
        />
      </div>
      {hits.length > 0 && (
        <ul className="mt-1 max-h-36 overflow-auto rounded-lg border bg-white text-sm shadow">
          {hits.map((s) => (
            <li key={s.id}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => onAdd(s)}>
                {s.name}
                {s.email ? <span className="ml-2 text-xs text-slate-400">{s.email}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
