'use client';

import { useEffect, useState } from 'react';
import {
  Form,
  FormField,
  FormGrid,
  FormInput,
  FormSection,
  FormSelect,
} from '@/components/form';
import {
  fetchB2bFacebookLeadgenForms,
  replaceB2bProjectChannels,
  replaceB2bProjectPages,
  syncB2bProjectFacebookLeads,
  type B2bProjectChannelRow,
  type B2bProjectPageRow,
} from '@/lib/b2b-projects-api';
import { getAccessToken } from '@/lib/auth';
import { mergeLeadgenForms } from './merge-leadgen-forms';

export type PageDraft = {
  page_id: string;
  name: string;
  token_ref: string;
  active: boolean;
  forms: FormDraft[];
};

export type FormDraft = {
  form_id: string;
  name: string;
  active: boolean;
};

export type ChannelDraft = {
  channel_type: 'zalo' | 'webform' | 'api';
  external_key: string;
  label: string;
  active: boolean;
};

function pagesToDraft(rows: B2bProjectPageRow[]): PageDraft[] {
  return rows.map((p) => ({
    page_id: p.page_id,
    name: p.name ?? '',
    token_ref: p.token_ref ?? '',
    active: p.active,
    forms: (p.forms ?? []).map((f) => ({
      form_id: f.form_id,
      name: f.name ?? '',
      active: f.active,
    })),
  }));
}

function channelsToDraft(rows: B2bProjectChannelRow[]): ChannelDraft[] {
  return rows.map((c) => ({
    channel_type: (c.channel_type as ChannelDraft['channel_type']) || 'zalo',
    external_key: c.external_key,
    label: c.label ?? '',
    active: c.active,
  }));
}

const CHANNEL_TYPE_LABELS: Record<ChannelDraft['channel_type'], string> = {
  zalo: 'Zalo OA',
  webform: 'Webform / Landing',
  api: 'API key',
};

type Props = {
  projectId: string;
  projectCode: string;
  pages: B2bProjectPageRow[];
  channels: B2bProjectChannelRow[];
  canManage: boolean;
  notice?: string;
  onSaved?: () => void;
  onMessage?: (msg: string) => void;
  onError?: (msg: string) => void;
};

export function B2bProjectChannelsPanel({
  projectId,
  projectCode,
  pages,
  channels,
  canManage,
  notice,
  onSaved,
  onMessage,
  onError,
}: Props) {
  const [pagesDraft, setPagesDraft] = useState<PageDraft[]>([]);
  const [channelsDraft, setChannelsDraft] = useState<ChannelDraft[]>([]);
  const [savingPages, setSavingPages] = useState(false);
  const [savingChannels, setSavingChannels] = useState(false);
  const [syncingFacebook, setSyncingFacebook] = useState(false);
  const [fetchingFormsIdx, setFetchingFormsIdx] = useState<number | null>(null);

  useEffect(() => {
    setPagesDraft(pagesToDraft(pages));
  }, [pages]);

  useEffect(() => {
    setChannelsDraft(channelsToDraft(channels));
  }, [channels]);

  function apiErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) {
      if (err.message.includes('channel_key_taken')) {
        return 'Page/Form hoặc kênh đã được map ở dự án PTT khác — kiểm tra /crm/b2b-unmatched.';
      }
      if (err.message.includes('missing_page_token')) {
        return 'Thiếu Page Access Token. Lưu token ở tab Kênh hoặc CRM_FACEBOOK_PAGE_ACCESS_TOKEN rồi thử lại.';
      }
      if (err.message.includes('no_active_forms')) {
        return 'Dự án chưa có Form Facebook active để đồng bộ.';
      }
      return err.message;
    }
    return fallback;
  }

  async function savePages(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canManage) return;
    setSavingPages(true);
    onError?.('');
    try {
      const payload = pagesDraft
        .filter((p) => p.page_id.trim())
        .map((p) => ({
          page_id: p.page_id.trim(),
          name: p.name.trim() || undefined,
          token_ref: p.token_ref.trim() || undefined,
          active: p.active,
          forms: p.forms
            .filter((f) => f.form_id.trim())
            .map((f) => ({
              form_id: f.form_id.trim(),
              name: f.name.trim() || undefined,
              active: f.active,
            })),
        }));
      await replaceB2bProjectPages(access, projectId, payload);
      onMessage?.('Đã lưu Page và form.');
      onSaved?.();
    } catch (err) {
      onError?.(apiErrorMessage(err, 'Lưu pages thất bại'));
    } finally {
      setSavingPages(false);
    }
  }

  async function saveChannels(e: React.FormEvent) {
    e.preventDefault();
    const access = getAccessToken();
    if (!access || !canManage) return;
    setSavingChannels(true);
    onError?.('');
    try {
      const payload = channelsDraft
        .filter((c) => c.external_key.trim())
        .map((c) => ({
          channel_type: c.channel_type,
          external_key: c.external_key.trim(),
          label: c.label.trim() || undefined,
          active: c.active,
        }));
      await replaceB2bProjectChannels(access, projectId, payload);
      onMessage?.('Đã lưu kênh Zalo, Webform và API.');
      onSaved?.();
    } catch (err) {
      onError?.(apiErrorMessage(err, 'Lưu kênh thất bại'));
    } finally {
      setSavingChannels(false);
    }
  }

  async function syncFacebookLeads() {
    const access = getAccessToken();
    if (!access || !canManage) return;
    setSyncingFacebook(true);
    onError?.('');
    try {
      const out = await syncB2bProjectFacebookLeads(access, projectId);
      onMessage?.(out.message || 'Đã đồng bộ lead Facebook.');
    } catch (err) {
      onError?.(apiErrorMessage(err, 'Đồng bộ Facebook thất bại'));
    } finally {
      setSyncingFacebook(false);
    }
  }

  async function pullLeadgenForms(pageIdx: number) {
    const access = getAccessToken();
    const page = pagesDraft[pageIdx];
    if (!access || !canManage || !page?.page_id.trim()) return;
    setFetchingFormsIdx(pageIdx);
    onError?.('');
    try {
      const out = await fetchB2bFacebookLeadgenForms(access, projectId, {
        page_id: page.page_id.trim(),
        access_token: page.token_ref.trim() || undefined,
      });
      setPagesDraft((prev) =>
        prev.map((p, i) => (i === pageIdx ? { ...p, forms: mergeLeadgenForms(p.forms, out.forms) } : p)),
      );
      onMessage?.(
        out.forms.length
          ? `Đã lấy ${out.forms.length} form. Bấm Lưu Page và form để gắn vào dự án.`
          : 'Page này chưa có Lead form trên Meta.',
      );
    } catch (err) {
      onError?.(apiErrorMessage(err, 'Không lấy được form từ Facebook'));
    } finally {
      setFetchingFormsIdx(null);
    }
  }

  function updatePage(idx: number, patch: Partial<PageDraft>) {
    setPagesDraft((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function updatePageForm(pageIdx: number, formIdx: number, patch: Partial<FormDraft>) {
    setPagesDraft((prev) =>
      prev.map((p, i) =>
        i === pageIdx
          ? {
              ...p,
              forms: p.forms.map((f, j) => (j === formIdx ? { ...f, ...patch } : f)),
            }
          : p,
      ),
    );
  }

  const busyPages = savingPages || syncingFacebook || fetchingFormsIdx !== null;

  return (
    <div className="delivery-ingest-stack">
      <Form className="page-card" onSubmit={(e) => void savePages(e)}>
        <FormSection title="Facebook Page và Lead form">
          <div className="delivery-card-toolbar">
            <p className="form-hint">
              Lead từ Page/form đã gắn về dự án <strong>{projectCode}</strong>. Lead chưa gắn xem{' '}
              <a href="/crm/b2b-unmatched">Ingress chưa map</a>.
            </p>
            {canManage ? (
              <div className="delivery-card-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={savingPages}
                  onClick={() =>
                    setPagesDraft((prev) => [
                      ...prev,
                      {
                        page_id: '',
                        name: '',
                        token_ref: '',
                        active: true,
                        forms: [{ form_id: '', name: '', active: true }],
                      },
                    ])
                  }
                >
                  Thêm Page
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busyPages}
                  onClick={() => void syncFacebookLeads()}
                >
                  {syncingFacebook ? 'Đang đồng bộ…' : 'Đồng bộ lead'}
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={busyPages}>
                  {savingPages ? 'Đang lưu…' : 'Lưu Page và form'}
                </button>
              </div>
            ) : null}
          </div>
          {notice ? <p className="delivery-notice">{notice}</p> : null}
          {pagesDraft.length === 0 ? (
            <p className="form-hint">Chưa có Page. Bấm Thêm Page để gắn Page ID và form từ Meta.</p>
          ) : null}

          {pagesDraft.map((page, pageIdx) => (
            <div key={`page-${pageIdx}`} className="delivery-page-block">
              <div className="delivery-page-block__head">
                <div>
                  <strong>{page.name.trim() || page.page_id.trim() || `Page ${pageIdx + 1}`}</strong>
                  <span
                    className={`delivery-status-pill${page.active ? ' is-on' : ''}`}
                  >
                    {page.active ? 'Đang nhận' : 'Tạm dừng'}
                  </span>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={savingPages}
                    onClick={() => setPagesDraft((prev) => prev.filter((_, i) => i !== pageIdx))}
                  >
                    Xóa page
                  </button>
                ) : null}
              </div>

              <FormGrid cols={2}>
                <FormField label="Page ID" required>
                  <FormInput
                    value={page.page_id}
                    disabled={!canManage || savingPages}
                    placeholder="vd: 123456789012345"
                    onChange={(e) => updatePage(pageIdx, { page_id: e.target.value })}
                  />
                </FormField>
                <FormField label="Tên page">
                  <FormInput
                    value={page.name}
                    disabled={!canManage || savingPages}
                    onChange={(e) => updatePage(pageIdx, { name: e.target.value })}
                  />
                </FormField>
                <FormField label="Page Access Token" hint="Token Page có quyền leads_retrieval.">
                  <FormInput
                    type="password"
                    autoComplete="off"
                    value={page.token_ref}
                    disabled={!canManage || savingPages}
                    placeholder="EAAx…"
                    onChange={(e) => updatePage(pageIdx, { token_ref: e.target.value })}
                  />
                </FormField>
                <FormField label="Trạng thái page">
                  <FormSelect
                    value={page.active ? 'yes' : 'no'}
                    disabled={!canManage || savingPages}
                    onChange={(e) => updatePage(pageIdx, { active: e.target.value === 'yes' })}
                  >
                    <option value="yes">Đang nhận</option>
                    <option value="no">Tạm dừng</option>
                  </FormSelect>
                </FormField>
              </FormGrid>

              <div className="delivery-forms-head">
                <h3 className="form-section-title">Lead form ({page.forms.filter((f) => f.form_id.trim()).length})</h3>
                {canManage ? (
                  <div className="delivery-card-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busyPages || !page.page_id.trim()}
                      onClick={() => void pullLeadgenForms(pageIdx)}
                    >
                      {fetchingFormsIdx === pageIdx ? 'Đang lấy form…' : 'Lấy tất cả form'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busyPages}
                      onClick={() =>
                        setPagesDraft((prev) =>
                          prev.map((p, i) =>
                            i === pageIdx
                              ? { ...p, forms: [...p.forms, { form_id: '', name: '', active: true }] }
                              : p,
                          ),
                        )
                      }
                    >
                      Thêm form
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="data-table-wrap">
                <table className="data-table delivery-forms-table">
                  <thead>
                    <tr>
                      <th>Form ID</th>
                      <th>Tên form</th>
                      <th>Nhận lead</th>
                      {canManage ? <th aria-label="Thao tác" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {page.forms.length === 0 ? (
                      <tr>
                        <td colSpan={canManage ? 4 : 3} className="muted">
                          Chưa có form. Bấm Lấy tất cả form hoặc Thêm form.
                        </td>
                      </tr>
                    ) : (
                      page.forms.map((form, formIdx) => (
                        <tr key={`form-${pageIdx}-${formIdx}`}>
                          <td>
                            <FormInput
                              value={form.form_id}
                              disabled={!canManage || savingPages}
                              placeholder="ID form Meta"
                              onChange={(e) => updatePageForm(pageIdx, formIdx, { form_id: e.target.value })}
                            />
                          </td>
                          <td>
                            <FormInput
                              value={form.name}
                              disabled={!canManage || savingPages}
                              onChange={(e) => updatePageForm(pageIdx, formIdx, { name: e.target.value })}
                            />
                          </td>
                          <td>
                            <FormSelect
                              value={form.active ? 'yes' : 'no'}
                              disabled={!canManage || savingPages}
                              onChange={(e) =>
                                updatePageForm(pageIdx, formIdx, { active: e.target.value === 'yes' })
                              }
                            >
                              <option value="yes">Có</option>
                              <option value="no">Không</option>
                            </FormSelect>
                          </td>
                          {canManage ? (
                            <td>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                disabled={savingPages}
                                onClick={() =>
                                  setPagesDraft((prev) =>
                                    prev.map((p, i) =>
                                      i === pageIdx
                                        ? { ...p, forms: p.forms.filter((_, j) => j !== formIdx) }
                                        : p,
                                    ),
                                  )
                                }
                              >
                                Xóa
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </FormSection>
      </Form>

      <Form className="page-card" onSubmit={(e) => void saveChannels(e)}>
        <FormSection title="Zalo, Webform và API">
          <div className="delivery-card-toolbar">
            <p className="form-hint">Webhook Zalo: /api/v1/webhooks/zalo/{projectCode}</p>
            {canManage ? (
              <div className="delivery-card-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={savingChannels}
                  onClick={() =>
                    setChannelsDraft((prev) => [
                      ...prev,
                      { channel_type: 'zalo', external_key: '', label: '', active: true },
                    ])
                  }
                >
                  Thêm kênh
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingChannels}>
                  {savingChannels ? 'Đang lưu…' : 'Lưu kênh'}
                </button>
              </div>
            ) : null}
          </div>

          {channelsDraft.length === 0 ? (
            <p className="form-hint">Chưa có kênh Zalo, Webform hoặc API.</p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table delivery-forms-table">
                <thead>
                  <tr>
                    <th>Loại kênh</th>
                    <th>Khóa / ID</th>
                    <th>Nhãn</th>
                    <th>Nhận lead</th>
                    {canManage ? <th aria-label="Thao tác" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {channelsDraft.map((ch, idx) => (
                    <tr key={`ch-${idx}`}>
                      <td>
                        <FormSelect
                          value={ch.channel_type}
                          disabled={!canManage || savingChannels}
                          onChange={(e) =>
                            setChannelsDraft((prev) =>
                              prev.map((c, i) =>
                                i === idx
                                  ? { ...c, channel_type: e.target.value as ChannelDraft['channel_type'] }
                                  : c,
                              ),
                            )
                          }
                        >
                          {(Object.keys(CHANNEL_TYPE_LABELS) as ChannelDraft['channel_type'][]).map((t) => (
                            <option key={t} value={t}>
                              {CHANNEL_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </FormSelect>
                      </td>
                      <td>
                        <FormInput
                          value={ch.external_key}
                          disabled={!canManage || savingChannels}
                          placeholder={
                            ch.channel_type === 'zalo'
                              ? 'Zalo OA ID'
                              : ch.channel_type === 'webform'
                                ? 'landing-slug'
                                : 'api-key-id'
                          }
                          onChange={(e) =>
                            setChannelsDraft((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, external_key: e.target.value } : c)),
                            )
                          }
                        />
                      </td>
                      <td>
                        <FormInput
                          value={ch.label}
                          disabled={!canManage || savingChannels}
                          onChange={(e) =>
                            setChannelsDraft((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, label: e.target.value } : c)),
                            )
                          }
                        />
                      </td>
                      <td>
                        <FormSelect
                          value={ch.active ? 'yes' : 'no'}
                          disabled={!canManage || savingChannels}
                          onChange={(e) =>
                            setChannelsDraft((prev) =>
                              prev.map((c, i) => (i === idx ? { ...c, active: e.target.value === 'yes' } : c)),
                            )
                          }
                        >
                          <option value="yes">Có</option>
                          <option value="no">Không</option>
                        </FormSelect>
                      </td>
                      {canManage ? (
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={savingChannels}
                            onClick={() => setChannelsDraft((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            Xóa
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </FormSection>
      </Form>
    </div>
  );
}
