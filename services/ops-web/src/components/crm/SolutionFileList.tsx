import type { SolutionAttachment } from '@/lib/crm/solution-file-display';
import { formatAttachmentMeta } from '@/lib/crm/solution-file-display';

export function SolutionFileList({
  files,
  canEdit = false,
  busy = false,
  onOpen,
  onDownload,
  onRemove,
}: {
  files: SolutionAttachment[];
  canEdit?: boolean;
  busy?: boolean;
  onOpen?: (file: SolutionAttachment) => void;
  onDownload?: (file: SolutionAttachment) => void;
  onRemove?: (file: SolutionAttachment) => void;
}) {
  if (!files.length) return null;
  return (
    <ul className="solution-file-list" data-testid="solution-desk-files">
      {files.map((file) => (
        <li key={file.id} className="solution-file-row" data-testid="solution-file-row">
          <div className="solution-file-row__main">
            <div className="solution-file-row__name" title={file.name}>
              {file.name}
            </div>
            <div className="solution-file-row__meta">{formatAttachmentMeta(file)}</div>
          </div>
          <div className="solution-file-row__actions">
            <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => onOpen?.(file)}>
              Mở
            </button>
            <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => onDownload?.(file)}>
              Tải về
            </button>
            {canEdit && onRemove ? (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Xóa file "${file.name}"?`)) onRemove(file);
                }}
              >
                Xóa
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export { SolutionAiDraftBody } from './SolutionAiDocument';
