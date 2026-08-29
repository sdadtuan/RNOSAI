'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';
import {
  listIntakeSalesKitFiles,
  uploadIntakeSalesKitFile,
  type IntakeSalesKitFileRow,
} from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { intakeServiceLabel, PILOT_SERVICE_SLUGS } from '@/lib/crm/intake-service-resolve';

const ORG_KINDS = ['qa', 'battle-cards', 'cases', 'pricing'] as const;
const ORG_ROOTS = [...PILOT_SERVICE_SLUGS, '_common'] as const;
const ACCEPT = '.xlsx,.pdf,image/png,image/jpeg,image/webp';

export type IntakeSalesKitLibrarySheetProps = {
  open: boolean;
  sessionId: number | null;
  leadId: number;
  serviceSlug?: string | null;
  canEdit: boolean;
  canBrowseOrg: boolean;
  onClose: () => void;
};

export function IntakeSalesKitLibrarySheet({
  open,
  sessionId,
  leadId,
  serviceSlug,
  canEdit,
  canBrowseOrg,
  onClose,
}: IntakeSalesKitLibrarySheetProps) {
  const orgFolder = useMemo(() => {
    const slug = String(serviceSlug ?? '').trim() || '_common';
    const root = (PILOT_SERVICE_SLUGS as readonly string[]).includes(slug) ? slug : '_common';
    return `${root}/qa`;
  }, [serviceSlug]);

  const [sessionFiles, setSessionFiles] = useState<IntakeSalesKitFileRow[]>([]);
  const [orgFiles, setOrgFiles] = useState<IntakeSalesKitFileRow[]>([]);
  const [browseFolder, setBrowseFolder] = useState(orgFolder);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setBrowseFolder(orgFolder);
  }, [orgFolder]);

  const reloadSession = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !sessionId) {
      setSessionFiles([]);
      return;
    }
    const out = await listIntakeSalesKitFiles(token, { session_id: sessionId });
    setSessionFiles(out.files ?? []);
  }, [sessionId]);

  const reloadOrg = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !canBrowseOrg) {
      setOrgFiles([]);
      return;
    }
    const out = await listIntakeSalesKitFiles(token, { folder_key: browseFolder });
    setOrgFiles(out.files ?? []);
  }, [browseFolder, canBrowseOrg]);

  useEffect(() => {
    if (!open) return;
    setError('');
    void (async () => {
      setBusy(true);
      try {
        await Promise.all([reloadSession(), reloadOrg()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải túi phiên thất bại');
      } finally {
        setBusy(false);
      }
    })();
  }, [open, reloadOrg, reloadSession]);

  async function onUpload(file: File) {
    const token = getAccessToken();
    if (!token || !sessionId || !canEdit) return;
    setBusy(true);
    setError('');
    try {
      await uploadIntakeSalesKitFile(token, {
        file,
        folder_key: `session/${leadId || 0}/${sessionId}`,
        lead_id: leadId > 0 ? leadId : undefined,
        session_id: sessionId,
      });
      await reloadSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload túi phiên thất bại');
    } finally {
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

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="intake-kit-library__backdrop"
        aria-label="Đóng túi phiên"
        onClick={onClose}
      />
      <aside
        id="intake-sales-kit-library"
        className="intake-kit-library"
        aria-label="Túi phiên Sales Kit"
      >
        <header className="intake-kit-library__head">
          <strong>Túi phiên</strong>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            Đóng
          </button>
        </header>

        {!sessionId ? <p className="muted">Tạo phiên để upload file vào túi.</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <label
          className={`intake-kit-library__drop${dragOver ? ' is-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <span>Kéo file phiên (xlsx / pdf / ảnh) vào đây</span>
          <input
            type="file"
            accept={ACCEPT}
            disabled={!sessionId || !canEdit || busy}
            onChange={onFileInput}
          />
        </label>

        <ul className="intake-kit-library__files">
          {sessionFiles.length === 0 ? (
            <li className="muted">{busy ? 'Đang tải…' : 'Chưa có file túi phiên.'}</li>
          ) : (
            sessionFiles.map((row) => (
              <li key={row.id}>
                {row.original_name} · {row.parse_status}
              </li>
            ))
          )}
        </ul>

        <section className="intake-kit-library__org" aria-label="Kho org (chỉ xem)">
          <header>
            <strong>Kho org</strong>
            {canBrowseOrg ? (
              <Link href="/crm/intake/sales-kit" className="nav-link">
                Mở admin
              </Link>
            ) : (
              <span className="muted">Chỉ xem — GDKD quản lý tại Kho Sales Kit</span>
            )}
          </header>
          {canBrowseOrg ? (
            <>
              <label className="intake-field">
                <span className="muted">Folder</span>
                <select
                  value={browseFolder}
                  onChange={(e) => setBrowseFolder(e.target.value)}
                >
                  {ORG_ROOTS.map((root) =>
                    ORG_KINDS.map((kind) => {
                      const key = `${root}/${kind}`;
                      return (
                        <option key={key} value={key}>
                          {intakeServiceLabel(root)} / {kind}
                        </option>
                      );
                    }),
                  )}
                </select>
              </label>
              <ul className="intake-kit-library__files">
                {orgFiles.length === 0 ? (
                  <li className="muted">Chưa có file org.</li>
                ) : (
                  orgFiles.map((row) => (
                    <li key={row.id}>
                      {row.original_name} · {row.parse_status}
                    </li>
                  ))
                )}
              </ul>
            </>
          ) : null}
        </section>
      </aside>
    </>
  );
}
