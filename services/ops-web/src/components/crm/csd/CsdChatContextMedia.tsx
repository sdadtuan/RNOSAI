'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { CsdAttachmentRow } from '@/lib/crm/csd-api';
import { previewCsdFileObjectUrl } from '@/lib/crm/csd-api';
import {
  csdChatFileKind,
  formatCsdChatFileBytes,
  openCsdChatFile,
} from '@/lib/crm/csd-chat-file-local';
import {
  formatChatListTime,
  type CsdConversationMediaItem,
} from '@/lib/crm/csd-chat-display';

const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#eef0f2"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="12">…</text></svg>',
  );

function ContextMediaThumb({ token, file }: { token: string; file: CsdAttachmentRow }) {
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
      className="csd-chat-context-media__thumb"
      onClick={() => void openCsdChatFile(token, file)}
      title={file.file_name}
    >
      <img src={src} alt={file.file_name} />
    </button>
  );
}

function ContextFileRow({
  token,
  item,
}: {
  token: string;
  item: CsdConversationMediaItem;
}) {
  const kind = csdChatFileKind(item.file.file_name);
  return (
    <button
      type="button"
      className="csd-chat-context-file"
      data-testid="csd-chat-context-file-row"
      onClick={() => void openCsdChatFile(token, item.file)}
    >
      <span className={`csd-chat-context-file__icon is-${kind}`} aria-hidden>
        {kind === 'xls' ? 'X' : kind.slice(0, 3).toUpperCase()}
      </span>
      <span className="csd-chat-context-file__main">
        <span className="csd-chat-context-file__name">{item.file.file_name}</span>
        <span className="csd-chat-context-file__meta">
          {formatCsdChatFileBytes(item.file.byte_size)}
          <span className="csd-chat-context-file__ok" aria-hidden>
            ✓
          </span>
        </span>
      </span>
      <span className="csd-chat-context-file__when">{formatChatListTime(item.createdAt)}</span>
    </button>
  );
}

type MediaModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

function MediaModal({ title, onClose, children }: MediaModalProps) {
  return (
    <div className="csd-chat-context-modal" role="dialog" aria-label={title}>
      <div className="csd-chat-context-modal__panel">
        <header className="csd-chat-context-modal__head">
          <h4>{title}</h4>
          <button type="button" className="csd-chat-context-modal__close" aria-label="Đóng" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="csd-chat-context-modal__body">{children}</div>
      </div>
    </div>
  );
}

type CsdChatContextMediaProps = {
  token: string;
  loading?: boolean;
  error?: string;
  images: CsdConversationMediaItem[];
  files: CsdConversationMediaItem[];
};

export function CsdChatContextMedia({ token, loading = false, error = '', images, files }: CsdChatContextMediaProps) {
  const [mediaOpen, setMediaOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const previewImages = images.slice(0, 8);
  const previewFiles = files.slice(0, 3);

  return (
    <>
      <section className="csd-chat-context-section" data-testid="csd-chat-context-media">
        <button
          type="button"
          className="csd-chat-context-section__head"
          aria-expanded={mediaOpen}
          onClick={() => setMediaOpen((v) => !v)}
        >
          <span>Ảnh/Video</span>
          <span className="csd-chat-context-section__chev" aria-hidden>
            {mediaOpen ? '▾' : '▸'}
          </span>
        </button>
        {mediaOpen ? (
          <div className="csd-chat-context-section__body">
            {loading ? (
              <p className="csd-chat-context-empty">Đang tải…</p>
            ) : error ? (
              <p className="csd-chat-context-empty">{error}</p>
            ) : images.length === 0 ? (
              <p className="csd-chat-context-empty">Chưa có ảnh hoặc video</p>
            ) : (
              <>
                <div className="csd-chat-context-media__grid">
                  {previewImages.map((item) => (
                    <ContextMediaThumb key={item.file.id} token={token} file={item.file} />
                  ))}
                </div>
                <button
                  type="button"
                  className="csd-chat-context-view-all"
                  data-testid="csd-chat-context-media-all"
                  onClick={() => setGalleryOpen(true)}
                >
                  Xem tất cả
                </button>
              </>
            )}
          </div>
        ) : null}
      </section>

      <section className="csd-chat-context-section" data-testid="csd-chat-context-files">
        <button
          type="button"
          className="csd-chat-context-section__head"
          aria-expanded={filesOpen}
          onClick={() => setFilesOpen((v) => !v)}
        >
          <span>File</span>
          <span className="csd-chat-context-section__chev" aria-hidden>
            {filesOpen ? '▾' : '▸'}
          </span>
        </button>
        {filesOpen ? (
          <div className="csd-chat-context-section__body">
            {loading ? (
              <p className="csd-chat-context-empty">Đang tải…</p>
            ) : error ? (
              <p className="csd-chat-context-empty">{error}</p>
            ) : files.length === 0 ? (
              <p className="csd-chat-context-empty">Chưa có file</p>
            ) : (
              <>
                <div className="csd-chat-context-files">
                  {previewFiles.map((item) => (
                    <ContextFileRow key={item.file.id} token={token} item={item} />
                  ))}
                </div>
                <button
                  type="button"
                  className="csd-chat-context-view-all"
                  data-testid="csd-chat-context-files-all"
                  onClick={() => setFilesModalOpen(true)}
                >
                  Xem tất cả
                </button>
              </>
            )}
          </div>
        ) : null}
      </section>

      {galleryOpen ? (
        <MediaModal title="Ảnh/Video" onClose={() => setGalleryOpen(false)}>
          <div className="csd-chat-context-media__grid csd-chat-context-media__grid--modal">
            {images.map((item) => (
              <ContextMediaThumb key={item.file.id} token={token} file={item.file} />
            ))}
          </div>
        </MediaModal>
      ) : null}

      {filesModalOpen ? (
        <MediaModal title="File" onClose={() => setFilesModalOpen(false)}>
          <div className="csd-chat-context-files csd-chat-context-files--modal">
            {files.map((item) => (
              <ContextFileRow key={item.file.id} token={token} item={item} />
            ))}
          </div>
        </MediaModal>
      ) : null}
    </>
  );
}
