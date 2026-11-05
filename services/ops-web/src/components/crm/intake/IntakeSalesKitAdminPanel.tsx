'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  approveIntakeSalesKitFile,
  downloadIntakeSalesKitSample,
  fetchSalesKitRuntime,
  listIntakeSalesKitFiles,
  patchSalesKitRuntime,
  uploadIntakeSalesKitFile,
  type IntakeSalesKitFileRow,
  type SalesKitRuntimeDto,
} from '@/lib/api';
import { intakeServiceLabel, PILOT_SERVICE_SLUGS } from '@/lib/crm/intake-service-resolve';

const ORG_KINDS = ['qa', 'battle-cards', 'cases', 'pricing'] as const;
const ORG_ROOTS = [...PILOT_SERVICE_SLUGS, '_common'] as const;
const ACCEPT = '.xlsx,.pdf,image/png,image/jpeg,image/webp';
const DEFAULT_FOLDER = 'dich-vu-seo-tong-the/qa';

function folderHref(folder: string): string {
  return `/crm/intake/sales-kit?folder=${encodeURIComponent(folder)}`;
}

export type IntakeSalesKitAdminPanelProps = {
  token: string;
};

export function IntakeSalesKitAdminPanel({ token }: IntakeSalesKitAdminPanelProps) {
  const searchParams = useSearchParams();
  const folder = useMemo(() => {
    const raw = String(searchParams.get('folder') ?? '').trim();
    return raw || DEFAULT_FOLDER;
  }, [searchParams]);

  const [files, setFiles] = useState<IntakeSalesKitFileRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [runtime, setRuntime] = useState<SalesKitRuntimeDto | null>(null);
  const [modeBusy, setModeBusy] = useState(false);

  const reload = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const out = await listIntakeSalesKitFiles(token, { folder_key: folder });
      setFiles(out.files ?? []);
    } catch (err) {
      setFiles([]);
      setError(err instanceof Error ? err.message : 'Tải kho thất bại');
    } finally {
      setBusy(false);
    }
  }, [folder, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadRuntime = useCallback(async () => {
    try {
      const out = await fetchSalesKitRuntime(token);
      setRuntime(out);
    } catch (err) {
      setRuntime(null);
      setError(err instanceof Error ? err.message : 'Không tải chế độ AI');
    }
  }, [token]);

  useEffect(() => {
    void loadRuntime();
  }, [loadRuntime]);

  async function onModeChange(mode: SalesKitRuntimeDto['mode']) {
    if (runtime?.locked) return;
    setModeBusy(true);
    setError('');
    try {
      const out = await patchSalesKitRuntime(token, mode);
      setRuntime(out);
      if (out.warning) setError(out.warning);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi chế độ thất bại');
    } finally {
      setModeBusy(false);
    }
  }

  async function onUpload(file: File) {
    setBusy(true);
    setError('');
    try {
      await uploadIntakeSalesKitFile(token, { file, folder_key: folder });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload thất bại');
      setBusy(false);
    }
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void onUpload(file);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void onUpload(file);
  }

  async function onApprove(id: string) {
    setBusy(true);
    setError('');
    try {
      await approveIntakeSalesKitFile(token, id);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyệt thất bại');
      setBusy(false);
    }
  }

  async function onDownloadSample() {
    setError('');
    try {
      await downloadIntakeSalesKitSample(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải mẫu thất bại');
    }
  }

  return (
    <div className="sales-kit-admin">
      <nav className="sales-kit-admin__tree" aria-label="Thư mục kho">
        {ORG_ROOTS.map((root) => (
          <div key={root} className="sales-kit-admin__root">
            <strong>{intakeServiceLabel(root)}</strong>
            <ul>
              {ORG_KINDS.map((kind) => {
                const key = `${root}/${kind}`;
                return (
                  <li key={key}>
                    <Link
                      href={folderHref(key)}
                      className={key === folder ? 'is-active' : undefined}
                    >
                      {kind}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sales-kit-admin__main">
        <header className="sales-kit-admin__head">
          <p>
            Folder <code>{folder}</code>
          </p>
          <div className="sales-kit-admin__actions">
            <Link href="/crm/intake/sales-kit/learn" className="btn btn-secondary btn-sm">
              Vòng nuôi
            </Link>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void onDownloadSample()}>
              Tải mẫu
            </button>
          </div>
        </header>

        <fieldset className="sales-kit-admin__mode" disabled={modeBusy || runtime?.locked}>
          <legend>Chế độ AI</legend>
          {(['off', 'openai', 'ollama'] as const).map((mode) => (
            <label key={mode} className="sales-kit-admin__mode-opt">
              <input
                type="radio"
                name="sales-kit-mode"
                checked={runtime?.mode === mode}
                onChange={() => void onModeChange(mode)}
              />
              {mode === 'off' ? 'Không LLM' : mode === 'openai' ? 'LLM (OpenAI)' : 'Ollama'}
            </label>
          ))}
          {runtime?.locked ? <p className="muted">IT đã khóa chế độ trên server.</p> : null}
          {runtime?.hint_vi ? <p className="muted">{runtime.hint_vi}</p> : null}
        </fieldset>

        {error ? <p className="error">{error}</p> : null}

        <label
          className={`sales-kit-admin__drop${dragOver ? ' is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <span>Kéo xlsx / pdf / ảnh vào đây hoặc chọn file</span>
          <input type="file" accept={ACCEPT} disabled={busy} onChange={onFileInput} />
        </label>

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên</th>
                <th>parse_status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {files.length === 0 ? (
                <tr>
                  <td colSpan={3}>{busy ? 'Đang tải…' : 'Chưa có file trong thư mục này.'}</td>
                </tr>
              ) : (
                files.map((row) => (
                  <tr key={row.id}>
                    <td>{row.original_name}</td>
                    <td>
                      {row.parse_status}
                      {row.parse_error ? ` · ${row.parse_error}` : ''}
                    </td>
                    <td>
                      {row.parse_status === 'pending' ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busy}
                          onClick={() => void onApprove(row.id)}
                        >
                          Duyệt
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
