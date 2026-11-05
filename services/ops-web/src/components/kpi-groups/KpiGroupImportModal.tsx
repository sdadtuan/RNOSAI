'use client';

import { useRef, useState } from 'react';
import {
  downloadKpiGroupImportTemplate,
  parseKpiGroupImportCsv,
  type KpiGroupImportPreviewRow,
} from '@/lib/kpi-group-import.util';
import { importKpiGroups, type ImportKpiGroupsResult } from '@/lib/kpi-groups-api';

type KpiGroupImportModalProps = {
  open: boolean;
  token: string;
  busy?: boolean;
  onClose: () => void;
  onImported: (result: ImportKpiGroupsResult) => void;
};

export function KpiGroupImportModal({
  open,
  token,
  busy: externalBusy,
  onClose,
  onImported,
}: KpiGroupImportModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<KpiGroupImportPreviewRow[]>([]);
  const [rows, setRows] = useState<ReturnType<typeof parseKpiGroupImportCsv>['rows']>([]);
  const [headerError, setHeaderError] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportKpiGroupsResult | null>(null);
  const [err, setErr] = useState('');

  if (!open) return null;

  const validCount = preview.filter((p) => p.valid).length;
  const invalidCount = preview.filter((p) => !p.valid).length;
  const isBusy = busy || Boolean(externalBusy);

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setErr('');
    setResult(null);
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseKpiGroupImportCsv(text);
    setPreview(parsed.preview);
    setRows(parsed.rows);
    setHeaderError(parsed.headerError ?? '');
  }

  function reset() {
    setPreview([]);
    setRows([]);
    setHeaderError('');
    setFileName('');
    setResult(null);
    setErr('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function onImport() {
    if (!rows.length) {
      setErr('Không có dòng hợp lệ để import');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const out = await importKpiGroups(token, rows);
      setResult(out);
      onImported(out);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Import thất bại');
    } finally {
      setBusy(false);
    }
  }

  function onCloseModal() {
    reset();
    onClose();
  }

  return (
    <div className="kpi-group-import-backdrop" role="presentation" onClick={onCloseModal}>
      <div
        className="kpi-group-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kpi-group-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kpi-group-import-modal__head">
          <h2 id="kpi-group-import-title">Nhập dữ liệu Nhóm KPI</h2>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onCloseModal}>
            Đóng
          </button>
        </header>

        <div className="kpi-group-import-modal__body">
          <p className="muted">
            Tải file CSV theo mẫu. Các cột bắt buộc: <code>code</code>, <code>name</code>,{' '}
            <code>scope_type</code>, <code>default_direction</code>.
          </p>

          <div className="kpi-group-import-modal__actions">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={isBusy}
              onClick={() => downloadKpiGroupImportTemplate()}
            >
              Tải file mẫu
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={isBusy}
              onClick={() => fileRef.current?.click()}
            >
              Chọn file CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => void onPickFile(e.target.files?.[0])}
            />
          </div>

          {fileName ? (
            <p className="kpi-group-import-modal__file">
              File: <strong>{fileName}</strong>
              {validCount || invalidCount ? (
                <span className="muted">
                  {' '}
                  · {validCount} hợp lệ · {invalidCount} lỗi
                </span>
              ) : null}
            </p>
          ) : null}

          {headerError ? <p className="error">{headerError}</p> : null}
          {err ? <p className="error">{err}</p> : null}

          {result ? (
            <div className="kpi-group-import-modal__result">
              <p>
                Import xong: <strong>{result.created}</strong> thành công ·{' '}
                <strong>{result.failed}</strong> lỗi
              </p>
            </div>
          ) : null}

          {preview.length ? (
            <div className="kpi-group-import-preview">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dòng</th>
                    <th>Mã</th>
                    <th>Tên</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.row_number} className={row.valid ? '' : 'is-error'}>
                      <td>{row.row_number}</td>
                      <td>
                        <code>{row.body.code || '—'}</code>
                      </td>
                      <td>{row.body.name || '—'}</td>
                      <td>
                        {row.valid ? (
                          <span className="kpi-group-import-ok">OK</span>
                        ) : (
                          <span className="error">{row.error ?? 'Lỗi'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <footer className="kpi-group-import-modal__foot">
          <button type="button" className="btn btn-sm btn-ghost" disabled={isBusy} onClick={onCloseModal}>
            Hủy
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={isBusy || !rows.length || Boolean(headerError)}
            onClick={() => void onImport()}
          >
            {isBusy ? 'Đang import…' : `Import ${rows.length} dòng`}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default KpiGroupImportModal;
