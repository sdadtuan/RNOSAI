'use client';

import { useEffect, useMemo, useState } from 'react';
import { previewCsdFileObjectUrl } from '@/lib/crm/csd-api';
import {
  csdChatFileKind,
  formatCsdChatFileBytes,
  openCsdChatFile,
} from '@/lib/crm/csd-chat-file-local';
import {
  formatChatListTime,
  groupCsdMediaItemsByDay,
  type CsdConversationMediaItem,
} from '@/lib/crm/csd-chat-display';

export type CsdChatStorageTab = 'media' | 'files' | 'links';

const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#eef0f2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="12">…</text></svg>',
  );

const TABS: { id: CsdChatStorageTab; label: string }[] = [
  { id: 'media', label: 'Ảnh/Video' },
  { id: 'files', label: 'File' },
  { id: 'links', label: 'Links' },
];

function VaultMediaThumb({
  token,
  file,
  selecting,
  selected,
  onToggle,
}: {
  token: string;
  file: CsdConversationMediaItem['file'];
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const [src, setSrc] = useState(PLACEHOLDER_IMG);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    void previewCsdFileObjectUrl(token, file.id)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoked = url;
        setSrc(url);
      })
      .catch(() => {
        /* keep placeholder */
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [token, file.id]);

  return (
    <button
      type="button"
      className={`csd-chat-storage-vault__thumb${selected ? ' is-selected' : ''}`}
      onClick={() => {
        if (selecting) onToggle();
        else void openCsdChatFile(token, file);
      }}
      title={file.file_name}
    >
      <img src={src} alt={file.file_name} />
      {selecting ? (
        <span className="csd-chat-storage-vault__check" aria-hidden>
          {selected ? '✓' : ''}
        </span>
      ) : null}
    </button>
  );
}

function VaultFileRow({
  token,
  item,
  selecting,
  selected,
  onToggle,
}: {
  token: string;
  item: CsdConversationMediaItem;
  selecting: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const kind = csdChatFileKind(item.file.file_name);
  return (
    <button
      type="button"
      className={`csd-chat-context-file csd-chat-storage-vault__file${selected ? ' is-selected' : ''}`}
      onClick={() => {
        if (selecting) onToggle();
        else void openCsdChatFile(token, item.file);
      }}
    >
      {selecting ? (
        <span className="csd-chat-storage-vault__check csd-chat-storage-vault__check--row" aria-hidden>
          {selected ? '✓' : ''}
        </span>
      ) : null}
      <span className={`csd-chat-context-file__icon is-${kind}`} aria-hidden>
        {kind === 'xls' ? 'X' : kind.slice(0, 3).toUpperCase()}
      </span>
      <span className="csd-chat-context-file__main">
        <span className="csd-chat-context-file__name">{item.file.file_name}</span>
        <span className="csd-chat-context-file__meta">
          {formatCsdChatFileBytes(item.file.byte_size)}
        </span>
      </span>
      <span className="csd-chat-context-file__when">{formatChatListTime(item.createdAt)}</span>
    </button>
  );
}

type CsdChatStorageVaultProps = {
  token: string;
  tab: CsdChatStorageTab;
  images: CsdConversationMediaItem[];
  files: CsdConversationMediaItem[];
  loading?: boolean;
  error?: string;
  onTabChange: (tab: CsdChatStorageTab) => void;
  onClose: () => void;
};

export function CsdChatStorageVault({
  token,
  tab,
  images,
  files,
  loading = false,
  error = '',
  onTabChange,
  onClose,
}: CsdChatStorageVaultProps) {
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const mediaGroups = useMemo(() => groupCsdMediaItemsByDay(images), [images]);
  const fileGroups = useMemo(() => groupCsdMediaItemsByDay(files), [files]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelecting() {
    setSelecting((v) => {
      if (v) setSelectedIds(new Set());
      return !v;
    });
  }

  return (
    <div className="csd-chat-storage-vault" data-testid="csd-chat-storage-vault" role="dialog" aria-label="Kho lưu trữ">
      <header className="csd-chat-storage-vault__head">
        <button type="button" className="csd-chat-storage-vault__back" aria-label="Quay lại" onClick={onClose}>
          ‹
        </button>
        <h3 className="csd-chat-storage-vault__title">Kho lưu trữ</h3>
        <button
          type="button"
          className={`csd-chat-storage-vault__select${selecting ? ' is-active' : ''}`}
          onClick={toggleSelecting}
        >
          {selecting ? 'Xong' : 'Chọn'}
        </button>
      </header>

      <div className="csd-chat-storage-vault__tabs" role="tablist" aria-label="Loại nội dung">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`csd-chat-storage-vault__tab${tab === item.id ? ' is-active' : ''}`}
            data-testid={`csd-chat-storage-tab-${item.id}`}
            onClick={() => onTabChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="csd-chat-storage-vault__filters">
        <label className="csd-chat-storage-vault__filter">
          <span>Người gửi</span>
          <select defaultValue="all" aria-label="Lọc người gửi">
            <option value="all">Tất cả</option>
          </select>
        </label>
        <label className="csd-chat-storage-vault__filter">
          <span>Ngày gửi</span>
          <select defaultValue="all" aria-label="Lọc ngày gửi">
            <option value="all">Tất cả</option>
          </select>
        </label>
      </div>

      <div className="csd-chat-storage-vault__body">
        {loading ? (
          <p className="csd-chat-context-empty">Đang tải…</p>
        ) : error ? (
          <p className="csd-chat-context-empty">{error}</p>
        ) : tab === 'media' ? (
          images.length === 0 ? (
            <p className="csd-chat-context-empty">Chưa có ảnh hoặc video</p>
          ) : (
            mediaGroups.map(([label, rows]) => (
              <section key={label} className="csd-chat-storage-vault__day">
                <h4 className="csd-chat-storage-vault__day-label">{label}</h4>
                <div className="csd-chat-storage-vault__grid">
                  {rows.map((item) => (
                    <VaultMediaThumb
                      key={item.file.id}
                      token={token}
                      file={item.file}
                      selecting={selecting}
                      selected={selectedIds.has(item.file.id)}
                      onToggle={() => toggleSelected(item.file.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          )
        ) : tab === 'files' ? (
          files.length === 0 ? (
            <p className="csd-chat-context-empty">Chưa có file</p>
          ) : (
            fileGroups.map(([label, rows]) => (
              <section key={label} className="csd-chat-storage-vault__day">
                <h4 className="csd-chat-storage-vault__day-label">{label}</h4>
                <div className="csd-chat-storage-vault__files">
                  {rows.map((item) => (
                    <VaultFileRow
                      key={item.file.id}
                      token={token}
                      item={item}
                      selecting={selecting}
                      selected={selectedIds.has(item.file.id)}
                      onToggle={() => toggleSelected(item.file.id)}
                    />
                  ))}
                </div>
              </section>
            ))
          )
        ) : (
          <p className="csd-chat-context-empty">Chưa có link</p>
        )}
      </div>
    </div>
  );
}
