'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  activateMktAiPlaybookVersion,
  canViewMktAiPlaybookAdmin,
  decideMktAiPlaybookVersion,
  depthLabelVi,
  enqueueMktAiPlaybookLearn,
  fetchMktAiPlaybookDetail,
  fetchMktAiPlaybookLearnJob,
  fetchMktAiPlaybookList,
  learnJobStatusLabelVi,
  patchMktAiPlaybookPolicy,
  patchMktAiPlaybookVersionDocument,
  rollbackMktAiPlaybookVersion,
  rolloutLabelVi,
  submitMktAiPlaybookVersion,
  type MktAiPlaybookAdminListItem,
  type MktAiPlaybookDetailResponse,
  type MktAiPlaybookVersionRow,
  type MktAiRollout,
  versionStatusLabelVi,
} from '@/lib/mkt-ai-playbook-admin-api';
import {
  canApproveMktAiPlanner,
  canGenerateMktAiPlanner,
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

function rolloutChipClass(rollout: MktAiRollout | null | undefined): string {
  if (rollout === 'pilot') return 'chip chip-warning';
  if (rollout === 'ga') return 'chip chip-success';
  return 'chip chip-muted';
}

function PlaybookDocumentFields({
  version,
  editable,
  onChange,
}: {
  version: MktAiPlaybookVersionRow;
  editable: boolean;
  onChange: (doc: Record<string, unknown>) => void;
}) {
  const doc = version.document_json;
  const brief = (doc.brief_defaults ?? {}) as Record<string, unknown>;
  const hints = (doc.strategy_prompt_hints as string[] | undefined) ?? [];
  const kpiTemplates = (doc.campaign_kpi_templates as string[] | undefined) ?? [];
  const governance = (doc.governance_notes_vi as string[] | undefined) ?? [];

  function patchDoc(patch: Record<string, unknown>) {
    onChange({ ...doc, ...patch });
  }

  function patchBrief(key: string, value: string) {
    onChange({ ...doc, brief_defaults: { ...brief, [key]: value } });
  }

  function patchStringList(key: string, raw: string) {
    const items = raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    onChange({ ...doc, [key]: items });
  }

  return (
    <div className="stack-gap text-sm">
      <div>
        <label className="block font-medium mb-1">Tên playbook</label>
        {editable ? (
          <input
            className="input w-full"
            value={String(doc.label_vi ?? '')}
            onChange={(e) => patchDoc({ label_vi: e.target.value })}
          />
        ) : (
          <p>{String(doc.label_vi ?? '—')}</p>
        )}
      </div>
      <div>
        <label className="block font-medium mb-1">Mục tiêu mặc định</label>
        {editable ? (
          <input
            className="input w-full"
            value={String(brief.objective ?? '')}
            onChange={(e) => patchBrief('objective', e.target.value)}
          />
        ) : (
          <p>{String(brief.objective ?? '—')}</p>
        )}
      </div>
      <div>
        <label className="block font-medium mb-1">Ngành</label>
        {editable ? (
          <input
            className="input w-full"
            value={String(brief.industry ?? '')}
            onChange={(e) => patchBrief('industry', e.target.value)}
          />
        ) : (
          <p>{String(brief.industry ?? '—')}</p>
        )}
      </div>
      <div>
        <label className="block font-medium mb-1">Thách thức</label>
        {editable ? (
          <textarea
            className="input w-full"
            rows={2}
            value={String(brief.challenges ?? '')}
            onChange={(e) => patchBrief('challenges', e.target.value)}
          />
        ) : (
          <p className="muted">{String(brief.challenges ?? '—')}</p>
        )}
      </div>
      <div>
        <label className="block font-medium mb-1">USP</label>
        {editable ? (
          <textarea
            className="input w-full"
            rows={2}
            value={String(brief.usp ?? '')}
            onChange={(e) => patchBrief('usp', e.target.value)}
          />
        ) : (
          <p className="muted">{String(brief.usp ?? '—')}</p>
        )}
      </div>
      <div>
        <label className="block font-medium mb-1">Gợi ý chiến lược (mỗi dòng một hint)</label>
        {editable ? (
          <textarea
            className="input w-full font-mono text-xs"
            rows={4}
            value={hints.join('\n')}
            onChange={(e) => patchStringList('strategy_prompt_hints', e.target.value)}
          />
        ) : (
          <ul className="list-disc pl-4 muted">
            {hints.length ? hints.map((h) => <li key={h}>{h}</li>) : <li>—</li>}
          </ul>
        )}
      </div>
      <div>
        <label className="block font-medium mb-1">KPI template</label>
        {editable ? (
          <textarea
            className="input w-full font-mono text-xs"
            rows={3}
            value={kpiTemplates.join('\n')}
            onChange={(e) => patchStringList('campaign_kpi_templates', e.target.value)}
          />
        ) : (
          <ul className="list-disc pl-4 muted">
            {kpiTemplates.length ? kpiTemplates.map((k) => <li key={k}>{k}</li>) : <li>—</li>}
          </ul>
        )}
      </div>
      <div>
        <label className="block font-medium mb-1">Governance</label>
        {editable ? (
          <textarea
            className="input w-full font-mono text-xs"
            rows={3}
            value={governance.join('\n')}
            onChange={(e) => patchStringList('governance_notes_vi', e.target.value)}
          />
        ) : (
          <ul className="list-disc pl-4 muted">
            {governance.length ? governance.map((g) => <li key={g}>{g}</li>) : <li>—</li>}
          </ul>
        )}
      </div>
      <p className="muted text-xs">
        v{version.version_no} · {versionStatusLabelVi(version.status)} · {depthLabelVi(version.depth)} ·{' '}
        {version.source}
      </p>
    </div>
  );
}

function PlaybookListTable({
  items,
  onOpen,
}: {
  items: MktAiPlaybookAdminListItem[];
  onOpen: (slug: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Dịch vụ</th>
            <th>Rollout</th>
            <th>Playbook active</th>
            <th>Mẫu</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.service_slug}>
              <td>
                <strong>{item.label_vi}</strong>
                <br />
                <span className="muted text-xs font-mono">{item.service_slug}</span>
              </td>
              <td>
                <span className={rolloutChipClass(item.policy?.rollout ?? 'off')}>
                  {rolloutLabelVi(item.policy?.rollout ?? 'off')}
                </span>
              </td>
              <td>
                {item.active_version ? (
                  <>
                    v{item.active_version.version_no} · {depthLabelVi(item.active_version.depth)}
                  </>
                ) : (
                  <span className="muted">Chưa có</span>
                )}
              </td>
              <td>
                <span title="Ứng viên / thắng">
                  {item.corpus.candidate_count}/5 · {item.corpus.winner_count}/3
                </span>
              </td>
              <td>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => onOpen(item.service_slug)}>
                  Mở
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlaybookDetailView({
  token,
  user,
  detail,
  onReload,
  onBack,
}: {
  token: string;
  user: StoredStaffUser;
  detail: MktAiPlaybookDetailResponse;
  onReload: () => Promise<void>;
  onBack: () => void;
}) {
  const canGenerate = canGenerateMktAiPlanner(user);
  const canApprove = canApproveMktAiPlanner(user);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(
    detail.versions[0]?.id ?? detail.active_version?.id ?? null,
  );
  const [documentDraft, setDocumentDraft] = useState<Record<string, unknown> | null>(null);
  const [excludeIds, setExcludeIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [acceptShallow, setAcceptShallow] = useState(false);
  const [selfApprove, setSelfApprove] = useState(false);
  const [activateNote, setActivateNote] = useState('');
  const [pollingJobId, setPollingJobId] = useState<number | null>(null);

  const selectedVersion = useMemo(
    () => detail.versions.find((v) => v.id === selectedVersionId) ?? detail.active_version,
    [detail, selectedVersionId],
  );

  useEffect(() => {
    if (selectedVersion) {
      setDocumentDraft({ ...selectedVersion.document_json });
    }
  }, [selectedVersion?.id]);

  const runningJob = detail.learn_jobs.find((j) => j.status === 'queued' || j.status === 'running');
  const latestJob = detail.learn_jobs[0] ?? null;
  const canLearn = detail.corpus.can_learn;
  const remaining = detail.corpus.remaining;

  useEffect(() => {
    if (!pollingJobId || !token) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const out = await fetchMktAiPlaybookLearnJob(token, detail.service_slug, pollingJobId);
        if (cancelled) return;
        if (out.job.status === 'succeeded' || out.job.status === 'failed') {
          setPollingJobId(null);
          await onReload();
        }
      } catch {
        /* ignore poll errors */
      }
    };
    const id = window.setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollingJobId, token, detail.service_slug, onReload]);

  async function runAction(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await fn();
      await onReload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
    } finally {
      setBusy('');
    }
  }

  async function handleLearn() {
    const exclude = [...excludeIds];
    await runAction('learn', async () => {
      const out = await enqueueMktAiPlaybookLearn(token, detail.service_slug, exclude);
      setPollingJobId(out.job_id);
    });
  }

  async function handleSaveDocument() {
    if (!selectedVersion || !documentDraft) return;
    await runAction('save', async () => {
      await patchMktAiPlaybookVersionDocument(token, selectedVersion.id, documentDraft);
    });
  }

  async function handleRollout(next: MktAiRollout) {
    await runAction('rollout', async () => {
      await patchMktAiPlaybookPolicy(token, detail.service_slug, { rollout: next });
    });
  }

  const versionEditable =
    Boolean(selectedVersion?.status === 'draft' && canGenerate && documentDraft);

  return (
    <div className="stack-gap">
      <div className="flex gap-2 items-center flex-wrap">
        <button type="button" className="btn btn-sm btn-ghost" onClick={onBack}>
          ← Danh sách
        </button>
        <h2 className="font-medium m-0">
          {detail.label_vi}{' '}
          <span className="muted text-sm font-mono">({detail.service_slug})</span>
        </h2>
        <span className={rolloutChipClass(detail.policy?.rollout ?? 'off')}>
          {rolloutLabelVi(detail.policy?.rollout ?? 'off')}
        </span>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="playbook-admin-grid">
        {/* Corpus */}
        <section className="page-card stack-gap">
          <h3 className="font-medium m-0">Corpus</h3>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="muted">Ứng viên</span>
              <br />
              <strong>
                {detail.corpus.candidate_count}/5
              </strong>
            </div>
            <div>
              <span className="muted">Thắng</span>
              <br />
              <strong>
                {detail.corpus.winner_count}/3
              </strong>
            </div>
            <div>
              <span className="muted">Độ sâu dự kiến</span>
              <br />
              <strong>{detail.corpus.depth === 'deep' ? 'Sâu' : 'Nông'}</strong>
            </div>
          </div>
          {detail.corpus.candidate_count < 5 ? (
            <p className="muted text-sm">Còn {remaining} HĐ nữa để đủ ngưỡng Sinh playbook.</p>
          ) : null}
          <ul className="stack-gap text-sm m-0 p-0 list-none">
            {detail.corpus.rows.map((row) => (
              <li key={row.lifecycle_id} className="border-b pb-2 flex gap-2 items-start">
                {canGenerate ? (
                  <input
                    type="checkbox"
                    checked={excludeIds.has(row.lifecycle_id)}
                    onChange={(e) => {
                      setExcludeIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(row.lifecycle_id);
                        else next.delete(row.lifecycle_id);
                        return next;
                      });
                    }}
                    title="Loại khỏi lần Sinh này"
                  />
                ) : null}
                <div className="flex-1">
                  <Link href={`/crm/service-delivery/${row.lifecycle_id}`} className="link">
                    HĐ #{row.lifecycle_id}
                  </Link>
                  <br />
                  <span className="muted">
                    Score {row.quality_score} · {row.stage}
                    {row.closed_loop_win ? ' · Thắng' : ''}
                    {row.has_tier3_artifact ? ' · Artifact' : ''}
                  </span>
                </div>
              </li>
            ))}
            {!detail.corpus.rows.length ? <li className="muted">Chưa có HĐ trong túi corpus.</li> : null}
          </ul>
        </section>

        {/* Playbook JSON */}
        <section className="page-card stack-gap">
          <div className="flex gap-2 items-center flex-wrap">
            <h3 className="font-medium m-0">Playbook</h3>
            <select
              className="input input-sm"
              value={selectedVersionId ?? ''}
              onChange={(e) => setSelectedVersionId(Number(e.target.value))}
            >
              {detail.versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_no} — {versionStatusLabelVi(v.status)} ({depthLabelVi(v.depth)})
                </option>
              ))}
            </select>
          </div>
          {selectedVersion && documentDraft ? (
            <PlaybookDocumentFields
              version={{ ...selectedVersion, document_json: documentDraft }}
              editable={versionEditable}
              onChange={setDocumentDraft}
            />
          ) : (
            <p className="muted">Chưa có version playbook.</p>
          )}
          {versionEditable ? (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={Boolean(busy)}
              onClick={() => void handleSaveDocument()}
            >
              Lưu nháp
            </button>
          ) : null}
          {detail.active_version && selectedVersion && selectedVersion.id !== detail.active_version.id ? (
            <p className="muted text-xs">
              So với active hiện tại (v{detail.active_version.version_no}): kiểm tra field trước khi Active.
            </p>
          ) : null}
        </section>

        {/* Actions */}
        <section className="page-card stack-gap">
          <h3 className="font-medium m-0">Hành động</h3>

          {latestJob ? (
            <div className="text-sm border rounded p-2">
              <strong>Job học #{latestJob.id}</strong>
              <br />
              <span className="muted">
                {learnJobStatusLabelVi(latestJob.status)}
                {latestJob.error ? ` — ${latestJob.error}` : ''}
              </span>
              {pollingJobId ? <p className="muted text-xs m-0 mt-1">Đang theo dõi job…</p> : null}
            </div>
          ) : null}

          {canGenerate ? (
            <>
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={Boolean(busy) || Boolean(runningJob) || !canLearn}
                title={!canLearn ? `Còn ${remaining} HĐ…` : undefined}
                onClick={() => void handleLearn()}
              >
                {!canLearn ? `Còn ${remaining} HĐ…` : 'Sinh playbook từ HĐ thực chiến'}
              </button>
              {canLearn && detail.corpus.winner_count < 3 ? (
                <p className="muted text-xs m-0">Job sẽ chạy ở độ sâu nông (thắng &lt; 3).</p>
              ) : null}
            </>
          ) : null}

          {selectedVersion && canGenerate && selectedVersion.status === 'draft' ? (
            <button
              type="button"
              className="btn btn-secondary w-full"
              disabled={Boolean(busy)}
              onClick={() =>
                void runAction('submit', async () => {
                  await submitMktAiPlaybookVersion(token, selectedVersion.id);
                })
              }
            >
              Gửi duyệt
            </button>
          ) : null}

          {selectedVersion && canApprove && selectedVersion.status === 'pending_review' ? (
            <>
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={Boolean(busy)}
                onClick={() =>
                  void runAction('approve', async () => {
                    await decideMktAiPlaybookVersion(token, selectedVersion.id, {
                      decision: 'approve',
                      note: reviewNote || undefined,
                    });
                  })
                }
              >
                Duyệt
              </button>
              <textarea
                className="input w-full text-sm"
                rows={2}
                placeholder="Ghi chú yêu cầu sửa (≥10 ký tự)"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-secondary w-full"
                disabled={Boolean(busy) || reviewNote.trim().length < 10}
                onClick={() =>
                  void runAction('reject', async () => {
                    await decideMktAiPlaybookVersion(token, selectedVersion.id, {
                      decision: 'request_changes',
                      note: reviewNote,
                    });
                  })
                }
              >
                Yêu cầu sửa
              </button>
            </>
          ) : null}

          {selectedVersion && canApprove && selectedVersion.status === 'approved' ? (
            <>
              {selectedVersion.depth === 'shallow' ? (
                <label className="flex gap-2 items-center text-sm">
                  <input
                    type="checkbox"
                    checked={acceptShallow}
                    onChange={(e) => setAcceptShallow(e.target.checked)}
                  />
                  Chấp nhận bản nông (shallow)
                </label>
              ) : null}
              {selectedVersion.created_by === user.email ? (
                <>
                  <label className="flex gap-2 items-center text-sm">
                    <input
                      type="checkbox"
                      checked={selfApprove}
                      onChange={(e) => setSelfApprove(e.target.checked)}
                    />
                    Tự duyệt Active (ghi chú ≥20 ký tự)
                  </label>
                  <textarea
                    className="input w-full text-sm"
                    rows={2}
                    placeholder="Ghi chú self-approve"
                    value={activateNote}
                    onChange={(e) => setActivateNote(e.target.value)}
                  />
                </>
              ) : null}
              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={
                  Boolean(busy) ||
                  (selectedVersion.depth === 'shallow' && !acceptShallow) ||
                  (selectedVersion.created_by === user.email &&
                    selfApprove &&
                    activateNote.trim().length < 20)
                }
                onClick={() =>
                  void runAction('activate', async () => {
                    await activateMktAiPlaybookVersion(token, selectedVersion.id, {
                      accept_shallow: acceptShallow || undefined,
                      self_approve: selfApprove || undefined,
                      note: activateNote || undefined,
                    });
                  })
                }
              >
                Active
              </button>
            </>
          ) : null}

          {selectedVersion &&
          canApprove &&
          (selectedVersion.status === 'approved' || selectedVersion.status === 'retired') &&
          selectedVersion.id !== detail.active_version?.id ? (
            <button
              type="button"
              className="btn btn-secondary w-full"
              disabled={Boolean(busy)}
              onClick={() =>
                void runAction('rollback', async () => {
                  await rollbackMktAiPlaybookVersion(token, selectedVersion.id);
                })
              }
            >
              Rollback về bản này
            </button>
          ) : null}

          {canApprove ? (
            <div className="border-t pt-3 stack-gap">
              <p className="muted text-xs m-0">Rollout slug (không cần restart)</p>
              <div className="flex gap-2 flex-wrap">
                {(['off', 'pilot', 'ga'] as MktAiRollout[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`btn btn-sm ${detail.policy?.rollout === r ? 'btn-primary' : 'btn-ghost'}`}
                    disabled={Boolean(busy) || detail.policy?.rollout === r}
                    onClick={() => void handleRollout(r)}
                  >
                    {rolloutLabelVi(r)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <style jsx>{`
        .playbook-admin-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .playbook-admin-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default function MktAiPlaybookAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slugParam = searchParams.get('slug')?.trim() ?? '';

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState<MktAiPlaybookAdminListItem[]>([]);
  const [detail, setDetail] = useState<MktAiPlaybookDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [router]);

  const ensureAuth = useCallback(async () => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      let me = await staffMe(access);
      if (!canViewMktAiPlaybookAdmin(me)) {
        setError('Không có quyền xem Admin Playbook DV.');
        setLoading(false);
        return;
      }
      setUser(me);
      updateStoredUser(me);
      setToken(access);
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      if (!canViewMktAiPlaybookAdmin(me)) {
        setError('Không có quyền xem Admin Playbook DV.');
        setLoading(false);
        return;
      }
      setUser(me);
      updateStoredUser(me);
      setToken(access);
    }
  }, [router]);

  const reloadList = useCallback(async () => {
    if (!token) return;
    const out = await fetchMktAiPlaybookList(token);
    setItems(out.items ?? []);
  }, [token]);

  const reloadDetail = useCallback(async () => {
    if (!token || !slugParam) return;
    const out = await fetchMktAiPlaybookDetail(token, slugParam);
    setDetail(out);
  }, [token, slugParam]);

  useEffect(() => {
    void ensureAuth();
  }, [ensureAuth]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        if (slugParam) {
          await reloadDetail();
        } else {
          await reloadList();
          setDetail(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải dữ liệu thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, slugParam, reloadList, reloadDetail]);

  function openSlug(slug: string) {
    router.push(`/crm/admin/mkt-ai/playbooks?slug=${encodeURIComponent(slug)}`);
  }

  function backToList() {
    router.push('/crm/admin/mkt-ai/playbooks');
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Playbook DV', href: '/crm/admin/mkt-ai/playbooks' },
        ...(slugParam ? [{ label: slugParam }] : []),
      ]}
    >
      <PageToolbar
        title="Playbook dịch vụ — Sinh / Duyệt / Active"
        subtitle="Học nháp từ HĐ thắng · MKT Lead duyệt và Active thủ công"
      />
      <div className="page-card stack-gap">
        {error ? <p className="error">{error}</p> : null}
        {loading ? (
          <p className="muted">Đang tải…</p>
        ) : slugParam && detail && token ? (
          <PlaybookDetailView
            token={token}
            user={user}
            detail={detail}
            onReload={reloadDetail}
            onBack={backToList}
          />
        ) : (
          <PlaybookListTable items={items} onOpen={openSlug} />
        )}
      </div>
    </StaffPageShell>
  );
}
