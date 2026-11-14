import type { SolutionAttachment } from '@/lib/crm/solution-file-display';
import { formatAttachmentMeta } from '@/lib/crm/solution-file-display';

export function SolutionFileList({
  files,
  canEdit = false,
  busy = false,
  onRemove,
}: {
  files: SolutionAttachment[];
  canEdit?: boolean;
  busy?: boolean;
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
            <a
              className="btn btn-sm btn-secondary"
              href={file.data_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Xem
            </a>
            <a className="btn btn-sm btn-secondary" href={file.data_url} download={file.name}>
              Tải về
            </a>
            {canEdit && onRemove ? (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={busy}
                onClick={() => onRemove(file)}
              >
                Gỡ
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SolutionAiDraftBody({
  title,
  badge,
  sections,
  pending = false,
  canEdit = false,
  busy = false,
  onSectionChange,
  onSave,
}: {
  title: string;
  badge: string;
  sections: Array<{ key: string; label: string; body: string }>;
  pending?: boolean;
  canEdit?: boolean;
  busy?: boolean;
  onSectionChange?: (key: string, body: string) => void;
  onSave?: () => void;
}) {
  return (
    <div className="solution-ai-draft" data-testid="solution-desk-ai-result">
      <h3 className="solution-ai-draft__title">{title}</h3>
      <p className={`solution-ai-draft__badge${pending ? ' solution-ai-draft__badge--pending' : ''}`}>{badge}</p>
      {pending ? (
        <p className="muted">Đang chờ AI viết. Bản nháp sẽ hiện ở đây khi agent trả kết quả.</p>
      ) : sections.length ? (
        <div className="solution-ai-draft__sections">
          {sections.map((section) => (
            <section key={section.key} className="solution-ai-draft__section">
              <h4>{section.label}</h4>
              {canEdit && onSectionChange ? (
                <textarea
                  className="solution-ai-draft__input"
                  value={section.body}
                  rows={4}
                  disabled={busy}
                  onChange={(event) => onSectionChange(section.key, event.target.value)}
                />
              ) : (
                <p>{section.body}</p>
              )}
            </section>
          ))}
        </div>
      ) : (
        <p className="muted">AI đã tạo bản nháp. AM kiểm tra nội dung trước khi nộp.</p>
      )}
      {canEdit && onSave && !pending ? (
        <div className="solution-ai-draft__actions">
          <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => onSave()}>
            Lưu bản nháp
          </button>
        </div>
      ) : null}
    </div>
  );
}
