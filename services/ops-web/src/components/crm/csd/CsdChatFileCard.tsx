'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CsdAttachmentRow } from '@/lib/crm/csd-api';
import {
  csdChatFileKind,
  formatCsdChatFileBytes,
  hasCsdChatFileLocally,
  openCsdChatFile,
  revealCsdChatFileInFolder,
  saveCsdChatFileToDisk,
} from '@/lib/crm/csd-chat-file-local';

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v10m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CsdChatFileCard({
  token,
  file,
}: {
  token: string;
  file: CsdAttachmentRow;
}) {
  const [local, setLocal] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const refreshLocal = useCallback(async () => {
    setLocal(await hasCsdChatFileLocally(file.id));
  }, [file.id]);

  useEffect(() => {
    void refreshLocal();
  }, [refreshLocal]);

  async function onOpen() {
    setBusy('open');
    setError('');
    try {
      await openCsdChatFile(token, file);
      await refreshLocal();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không mở được file');
    } finally {
      setBusy('');
    }
  }

  async function onSave(event: React.MouseEvent) {
    event.stopPropagation();
    setBusy('save');
    setError('');
    try {
      await saveCsdChatFileToDisk(token, file);
      await refreshLocal();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không lưu được file');
    } finally {
      setBusy('');
    }
  }

  async function onFolder(event: React.MouseEvent) {
    event.stopPropagation();
    setBusy('folder');
    setError('');
    try {
      await revealCsdChatFileInFolder(token, file);
      await refreshLocal();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Không mở được thư mục');
    } finally {
      setBusy('');
    }
  }

  const kind = csdChatFileKind(file.file_name);

  return (
    <div className={`csd-chat-file-card${local ? ' is-local' : ''}`} data-testid="csd-chat-file-card">
      <button
        type="button"
        className="csd-chat-file-card__main"
        data-testid="csd-chat-file-open"
        disabled={busy === 'open'}
        onClick={() => void onOpen()}
        title="Mở file"
      >
        <span className={`csd-chat-file-card__icon is-${kind}`}>{kind.toUpperCase()}</span>
        <span className="csd-chat-file-card__meta">
          <span className="csd-chat-file-card__name">{file.file_name}</span>
          <span className="csd-chat-file-card__sub">
            {formatCsdChatFileBytes(file.byte_size)}
            {local ? ' · ✓ Đã có trên máy' : ''}
          </span>
        </span>
      </button>
      <div className="csd-chat-file-card__actions">
        <button
          type="button"
          className="csd-chat-file-card__action"
          data-testid="csd-chat-file-folder"
          title="Mở thư mục"
          disabled={Boolean(busy)}
          onClick={(event) => void onFolder(event)}
        >
          <FolderIcon />
          <span className="sr-only">Mở thư mục</span>
        </button>
        <button
          type="button"
          className="csd-chat-file-card__action"
          data-testid="csd-chat-file-save"
          title="Lưu về máy"
          disabled={Boolean(busy)}
          onClick={(event) => void onSave(event)}
        >
          <SaveIcon />
          <span className="sr-only">Lưu về máy</span>
        </button>
      </div>
      {error ? <p className="csd-chat-file-card__error">{error}</p> : null}
    </div>
  );
}
