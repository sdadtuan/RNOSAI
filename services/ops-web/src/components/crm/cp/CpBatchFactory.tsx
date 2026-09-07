'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  CP_TEMPLATE_REQUIRED_VARS,
  createCpBatch,
  formatCpApiError,
  getCpBatch,
  getCpBatchErrorsCsv,
  listCpTemplates,
  retryCpBatchItem,
  runCpBatch,
  validateCpBatch,
  type CpBatchItem,
  type CpBatchJob,
  type CpScope,
  type CpTemplate,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

const STEPS = [
  { n: 1, label: '1 Template' },
  { n: 2, label: '2 Mapping' },
  { n: 3, label: '3 Variants' },
  { n: 4, label: '4 Review & Run' },
] as const;

function parseScope(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0] ?? '');
  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line);
    const row: Record<string, unknown> = { row_no: index + 1 };
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? '';
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function CpBatchFactory() {
  const searchParams = useSearchParams();
  const scope = parseScope(searchParams.get('scope'));
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState<CpTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [csv, setCsv] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>(
    Object.fromEntries(CP_TEMPLATE_REQUIRED_VARS.map((name) => [name, name])),
  );
  const [crmLifecycleId, setCrmLifecycleId] = useState('');
  const [ratio, setRatio] = useState('9:16');
  const [locale, setLocale] = useState('vi');
  const [batch, setBatch] = useState<CpBatchJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const selected = templates.find((item) => item.id === templateId) ?? null;
  const rows = useMemo(() => parseCsv(csv), [csv]);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const listed = await listCpTemplates(token);
      setTemplates(listed.items.filter((item) => item.status === 'published'));
    } catch (caught) {
      setTemplates([]);
      setError(formatCpApiError(caught, 'Không tải được mẫu'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAndValidate() {
    const token = getAccessToken();
    if (!token) return;
    setBusy('validate');
    setError('');
    try {
      const usesCrm = Object.values(mapping).some((value) => (
        /^(clients|service_lifecycle)\./.test(value)
      ));
      const source = usesCrm
        ? { type: 'crm', lifecycle_id: crmLifecycleId.trim() || undefined }
        : undefined;
      const created = await createCpBatch(token, {
        template_id: templateId,
        project_id: projectId || null,
        rows: rows.map((row) => ({ ...row, ratio, locale })),
        mapping,
        source,
      }, scope);
      const validated = await validateCpBatch(token, created.id, scope);
      setBatch(validated);
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không kiểm tra được batch'));
    } finally {
      setBusy('');
    }
  }

  async function run() {
    const token = getAccessToken();
    if (!token || !batch) return;
    setBusy('run');
    setError('');
    try {
      setBatch(await runCpBatch(token, batch.id, scope));
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không chạy được batch'));
    } finally {
      setBusy('');
    }
  }

  async function retry(rowNo: number | string) {
    const token = getAccessToken();
    if (!token || !batch) return;
    setBusy(`retry:${rowNo}`);
    setError('');
    try {
      await retryCpBatchItem(token, batch.id, rowNo, scope);
      setBatch(await getCpBatch(token, batch.id, scope));
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không retry được hàng'));
    } finally {
      setBusy('');
    }
  }

  async function downloadErrors() {
    const token = getAccessToken();
    if (!token || !batch) return;
    setBusy('csv');
    setError('');
    try {
      const text = await getCpBatchErrorsCsv(token, batch.id, scope);
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `batch-${batch.id}-errors.csv`;
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tải được errors.csv'));
    } finally {
      setBusy('');
    }
  }

  function onMapping(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = { ...mapping };
    for (const name of CP_TEMPLATE_REQUIRED_VARS) {
      next[name] = String(form.get(name) ?? name).trim() || name;
    }
    setMapping(next);
    setStep(3);
  }

  const items = batch?.items ?? [];

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Video AI</p>
          <h1>Tạo video hàng loạt</h1>
          <p className="cp-muted">Tối đa 50 hàng · retry từng hàng · không charge lại hàng thành công.</p>
        </div>
        <Link className="cp-btn" href={`/crm/creative-os/video/templates?scope=${scope}`}>Mẫu video</Link>
      </header>
      <nav className="cp-stepper" aria-label="Các bước batch">
        {STEPS.map((item) => (
          <button
            key={item.n}
            type="button"
            className={item.n === step ? 'cp-stepper__item is-on' : 'cp-stepper__item'}
            onClick={() => setStep(item.n)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {error ? <section className="cp-card cp-card--error"><p>{error}</p></section> : null}

      {step === 1 ? (
        <section className="cp-card">
          <div className="cp-card__head"><h2>Chọn template</h2></div>
          <form
            className="cp-form"
            onSubmit={(event) => {
              event.preventDefault();
              setStep(2);
            }}
          >
            <label className="cp-field">
              <span>Template đã xuất bản</span>
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} required>
                <option value="">{loading ? 'Đang tải…' : 'Chọn mẫu'}</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · v{dash(item.version)}</option>
                ))}
              </select>
            </label>
            <label className="cp-field">
              <span>Project ID</span>
              <input value={projectId} onChange={(event) => setProjectId(event.target.value)} required />
            </label>
            {selected ? (
              <p className="cp-muted">
                Biến: {CP_TEMPLATE_REQUIRED_VARS.map((name) => `{{${name}}}`).join(' ')}
              </p>
            ) : null}
            <button className="cp-btn cp-btn--primary" type="submit" disabled={!templateId || !projectId}>
              Tiếp tục mapping
            </button>
          </form>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="cp-card">
          <div className="cp-card__head"><h2>Mapping</h2></div>
          <form className="cp-form" onSubmit={onMapping}>
            <label className="cp-field">
              <span>CSV (tối đa 50 hàng)</span>
              <textarea
                rows={8}
                value={csv}
                onChange={(event) => setCsv(event.target.value)}
                placeholder="project_name,price_from,location,cta,hotline"
              />
            </label>
            <div className="cp-form-2">
              {CP_TEMPLATE_REQUIRED_VARS.map((name) => (
                <label key={name} className="cp-field">
                  <span>{`{{${name}}}`}</span>
                  <input name={name} defaultValue={mapping[name] ?? name} />
                </label>
              ))}
            </div>
            <label className="cp-field">
              <span>CRM lifecycle_id (allowlist clients + service_lifecycle)</span>
              <input value={crmLifecycleId} onChange={(event) => setCrmLifecycleId(event.target.value)} />
            </label>
            <p className="cp-muted">{rows.length ? `${rows.length} hàng CSV` : dash(null)}</p>
            <button className="cp-btn cp-btn--primary" type="submit">Tiếp tục variants</button>
          </form>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="cp-card">
          <div className="cp-card__head"><h2>Variants</h2></div>
          <form
            className="cp-form-2"
            onSubmit={(event) => {
              event.preventDefault();
              setStep(4);
            }}
          >
            <label className="cp-field">
              <span>Ratio</span>
              <select value={ratio} onChange={(event) => setRatio(event.target.value)}>
                <option>9:16</option>
                <option>16:9</option>
                <option>1:1</option>
                <option>4:5</option>
              </select>
            </label>
            <label className="cp-field">
              <span>Locale</span>
              <select value={locale} onChange={(event) => setLocale(event.target.value)}>
                <option value="vi">vi</option>
                <option value="en">en</option>
              </select>
            </label>
            <button className="cp-btn cp-btn--primary" type="submit">Review & Run</button>
          </form>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="cp-card">
          <div className="cp-card__head">
            <h2>Review & Run</h2>
            <div className="cp-actions">
              <button className="cp-btn" type="button" disabled={busy === 'validate'} onClick={() => void createAndValidate()}>
                {busy === 'validate' ? 'Đang kiểm tra…' : 'Kiểm tra hàng'}
              </button>
              <button className="cp-btn cp-btn--primary" type="button" disabled={!batch || busy === 'run'} onClick={() => void run()}>
                {busy === 'run' ? 'Đang chạy…' : 'Chạy batch'}
              </button>
              <button className="cp-btn" type="button" disabled={!batch || busy === 'csv'} onClick={() => void downloadErrors()}>
                Tải errors.csv
              </button>
            </div>
          </div>
          <p className="cp-muted">
            Hợp lệ {dash(batch?.valid_count)} · Lỗi {dash(batch?.invalid_count)} · Estimate {dash(batch?.estimate_credits)}
          </p>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Hàng</th>
                  <th>project_name</th>
                  <th>price_from</th>
                  <th>cta</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(items.length ? items : rows).length ? (items.length ? items : rows.map((row, index) => ({
                  row_no: Number(row.row_no ?? index + 1),
                  status: 'pending',
                  error: null,
                  row_json: row,
                }))).map((item) => {
                  const row = (item as CpBatchItem).row_json ?? (item as Record<string, unknown>);
                  const rowNo = (item as CpBatchItem).row_no;
                  const status = (item as CpBatchItem).status;
                  return (
                    <tr key={String(rowNo)}>
                      <td>{dash(rowNo)}</td>
                      <td>{dash((row as Record<string, unknown>).project_name as string | undefined)}</td>
                      <td>{dash((row as Record<string, unknown>).price_from as string | undefined)}</td>
                      <td>{dash((row as Record<string, unknown>).cta as string | undefined)}</td>
                      <td>{dash(status)}</td>
                      <td>
                        {status === 'failed' || status === 'invalid' ? (
                          <button
                            className="cp-btn"
                            type="button"
                            disabled={busy === `retry:${rowNo}`}
                            onClick={() => void retry(rowNo)}
                          >
                            Retry
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td className="cp-empty" colSpan={6}>{dash(null)}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
