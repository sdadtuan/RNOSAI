'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { fetchLeadPresalesClientBrief, patchLeadPresalesClientBrief } from '@/lib/api';
import {
  clientBriefUiMissing,
  factsFromBriefMissing,
} from '@/lib/crm/client-plan-brief.ui';

export interface ClientBriefFormFields {
  audience: string;
  usp: string;
  goal: string;
  channels: string;
  retain: string;
  competitors: string;
  metrics: string;
  website: string;
  fanpage: string;
}

const EMPTY_FIELDS: ClientBriefFormFields = {
  audience: '',
  usp: '',
  goal: '',
  channels: '',
  retain: '',
  competitors: '',
  metrics: '',
  website: '',
  fanpage: '',
};

interface Props {
  token: string;
  leadId: number;
  disabled?: boolean;
  canEdit?: boolean;
  canAiDraft?: boolean;
  aiBusy?: boolean;
  onAiDraft: () => Promise<void>;
  onFlushReady?: (flush: (() => Promise<void>) | null) => void;
  onError?: (message: string) => void;
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="client-plan-brief__field">
      <span>
        {label}
        {required ? <em className="client-plan-brief__star"> *</em> : null}
      </span>
      {hint ? <span className="client-plan-brief__hint">{hint}</span> : null}
      {children}
    </label>
  );
}

export function PresalesClientBriefCard({
  token,
  leadId,
  disabled = false,
  canEdit = false,
  canAiDraft = false,
  aiBusy = false,
  onAiDraft,
  onFlushReady,
  onError,
}: Props) {
  const [fields, setFields] = useState<ClientBriefFormFields>(EMPTY_FIELDS);
  const [facts, setFacts] = useState({ company_name: '', niche: '', need: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const readyRef = useRef(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const locked = disabled || !canEdit || loading;

  const persist = useCallback(async () => {
    if (!canEdit || !readyRef.current) return [] as string[];
    const out = await patchLeadPresalesClientBrief(token, leadId, fieldsRef.current);
    setFacts(factsFromBriefMissing(out.missing));
    return out.missing;
  }, [canEdit, leadId, token]);

  const persistRef = useRef(persist);
  persistRef.current = persist;

  useEffect(() => {
    onFlushReady?.(() => persistRef.current().then(() => undefined));
    return () => onFlushReady?.(null);
  }, [onFlushReady]);

  useEffect(() => {
    let cancelled = false;
    readyRef.current = false;
    setLoading(true);
    void fetchLeadPresalesClientBrief(token, leadId)
      .then((res) => {
        if (cancelled) return;
        const brief = res.brief;
        setFields({
          audience: String(brief.audience ?? ''),
          usp: String(brief.usp ?? ''),
          goal: String(brief.goal ?? ''),
          channels: String(brief.channels ?? ''),
          retain: String(brief.retain ?? ''),
          competitors: String(brief.competitors ?? ''),
          metrics: String(brief.metrics ?? ''),
          website: String(brief.website ?? ''),
          fanpage: String(brief.fanpage ?? ''),
        });
        setFacts(factsFromBriefMissing(res.missing));
        readyRef.current = true;
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          onErrorRef.current?.(err instanceof Error ? err.message : 'Không tải được brief');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId, token]);

  function setKey(key: keyof ClientBriefFormFields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  const missing = clientBriefUiMissing({ ...facts, ...fields });

  async function onRunAi() {
    setSaving(true);
    onError?.('');
    try {
      const serverMissing = await persist();
      if (serverMissing.length > 0) return;
      await onAiDraft();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'AI điền R5 thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="client-plan-brief stack-gap" id="client-brief">
      <h4 style={{ margin: 0 }}>Brief gửi khách</h4>
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Ô có dấu * chặn AI và chặn rời Pre-sales.
      </p>
      <div className="client-plan-brief__note">
        Có website hoặc fanpage: một lần gọi model nhìn được ảnh (<strong>PTT_MKT_AI_MODEL</strong>) để
        viết khách hàng mục tiêu, đối thủ và chọn ảnh bìa.
        <br />
        Không có hai link: <strong>gpt-4o-mini</strong> chỉ viết từ brief. Chương đó và ảnh bìa là [cần
        xác nhận].
      </div>
      <Field label="Khách của họ là ai" hint="Để trống thì AI đọc website và fanpage. Có chữ thì giữ.">
        <textarea
          rows={2}
          value={fields.audience}
          disabled={locked}
          onChange={(e) => setKey('audience', e.target.value)}
        />
      </Field>
      <Field label="Điểm khác biệt" required hint="AI viết Thông điệp và Trải nghiệm">
        <textarea
          rows={2}
          value={fields.usp}
          disabled={locked}
          onChange={(e) => setKey('usp', e.target.value)}
        />
      </Field>
      <Field label="Mục tiêu đo được" required hint="Một câu. AI viết North Star">
        <input
          type="text"
          value={fields.goal}
          disabled={locked}
          onChange={(e) => setKey('goal', e.target.value)}
        />
      </Field>
      <Field label="Kênh muốn chạy và cách chốt đơn" required hint="AI viết Kênh và Chiến lược chuyển đổi.">
        <textarea
          rows={2}
          value={fields.channels}
          disabled={locked}
          onChange={(e) => setKey('channels', e.target.value)}
        />
      </Field>
      <Field label="Khách cũ được giữ thế nào" hint="Trống → Gia hạn và Giới thiệu = [cần xác nhận]">
        <textarea
          rows={2}
          value={fields.retain}
          disabled={locked}
          onChange={(e) => setKey('retain', e.target.value)}
        />
      </Field>
      <div className="client-plan-brief__row">
        <Field label="Website" hint="AI đọc để viết khách hàng mục tiêu, đối thủ và lấy ảnh">
          <input
            type="url"
            value={fields.website}
            placeholder="https://"
            disabled={locked}
            onChange={(e) => setKey('website', e.target.value)}
          />
        </Field>
        <Field label="Fanpage" hint="Cùng vai trò với website">
          <input
            type="url"
            value={fields.fanpage}
            placeholder="https://"
            disabled={locked}
            onChange={(e) => setKey('fanpage', e.target.value)}
          />
        </Field>
      </div>
      <div className="client-plan-brief__row">
        <Field label="Đối thủ (2–3 tên)" hint="Để trống thì AI chỉ lấy tên có trên website/fanpage">
          <input
            type="text"
            value={fields.competitors}
            disabled={locked}
            onChange={(e) => setKey('competitors', e.target.value)}
          />
        </Field>
        <Field label="Số liệu đang có" hint="Chỉ in số có trên trang đã đọc. Sales gõ thì giữ">
          <input
            type="text"
            value={fields.metrics}
            disabled={locked}
            onChange={(e) => setKey('metrics', e.target.value)}
          />
        </Field>
      </div>
      {canEdit ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {canAiDraft ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              data-testid="client-brief-ai"
              disabled={locked || saving || aiBusy || missing.length > 0}
              onClick={() => void onRunAi()}
            >
              {saving || aiBusy ? 'Đang điền R5…' : 'AI điền R5'}
            </button>
          ) : (
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Cần quyền <code>crm_mkt_ai.generate</code> để AI điền R5.
            </span>
          )}
        </div>
      ) : null}
      {!loading && missing.length > 0 ? (
        <ul className="client-plan-brief__missing" data-testid="client-brief-missing">
          {missing.map((label) => (
            <li key={label}>Thiếu {label}.</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
