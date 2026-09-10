'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth';
import {
  parseCmktGateError,
  postContentOsApproveItem,
  postContentOsPublishItem,
  postContentOsRejectItem,
  postContentOsSubmitReview,
} from '@/lib/content-os-api';
import { evaluatePublishGate } from '@/lib/crm/cmkte-publish-gate';
import { cmktePath, contentOsPanelHref } from '@/lib/crm/cmkte-routes';
import { CMKTE_EMPTY_ITEM, CMKTE_TABS, nextTabLabel, type CmktETabId } from '@/lib/crm/cmkte-tabs';
import {
  calendarCollisionNotice,
  canMarkPublished,
  claimHighlightSegments,
  dash,
  firstCalendarCollision,
  isBlankRecord,
  itemClaimHits,
  itemMediaUrls,
  publishGateFlagsFromItem,
  rejectCommentValid,
} from '@/lib/crm/cmkte-workspace';
import { useCmktItem } from '@/lib/crm/use-cmkt-item';
import { deliverableFormatChannel } from './cmkte-deliverables';

function JsonBlock({ value, empty }: { value: unknown; empty: string }) {
  if (isBlankRecord(value)) return <p className="cmkte-empty">{empty}</p>;
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return <pre className="cmkte-json">{text}</pre>;
}

function contextSlots(bundle: ReturnType<typeof useCmktItem>): Array<{ label: string; value: string }> {
  const brand = bundle.plan?.snapshot?.brand_context_json ?? {};
  const snap = bundle.plan?.snapshot?.snapshot_json ?? {};
  const client = String(brand.client ?? brand.client_name ?? brand.brand ?? '').trim();
  const brandName = String(brand.brand ?? brand.brand_name ?? brand.name ?? '').trim();
  const locale = String(brand.locale ?? brand.market ?? brand.language ?? snap.locale ?? snap.market ?? '').trim();
  const campaign = String(snap.campaign ?? snap.campaign_name ?? '').trim();
  const market = locale === 'vi-VN' ? 'vi-VN' : '';
  const owner = [
    bundle.item?.created_by,
    bundle.item?.assignee_sp != null ? `SP ${bundle.item.assignee_sp}` : '',
    bundle.item?.assignee_qa != null ? `QA ${bundle.item.assignee_qa}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const risk = bundle.item?.status === 'changes_requested' ? 'BLOCKED' : bundle.item?.in_review_at ? 'IN_REVIEW' : '';
  return [
    { label: 'Organization / Business Unit', value: dash(bundle.context?.service_slug) },
    { label: 'Client / Brand', value: dash([client, brandName].filter(Boolean).join(' · ')) },
    { label: 'Market / Locale', value: dash(market) },
    {
      label: 'Campaign / Request',
      value: dash(campaign || (bundle.plan?.snapshot?.marketing_plan_id != null ? String(bundle.plan.snapshot.marketing_plan_id) : '')),
    },
    { label: 'Owner / Account', value: dash(owner) },
    { label: 'Risk / SLA', value: dash(risk) },
  ];
}

export function CmktEWorkspace({
  itemId,
  lifecycleHint,
  initialTab,
}: {
  itemId: number;
  lifecycleHint?: number;
  initialTab?: CmktETabId;
}) {
  const router = useRouter();
  const bundle = useCmktItem(itemId, lifecycleHint);
  const [tab, setTab] = useState<CmktETabId>(initialTab ?? 'brief');
  const [toast, setToast] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [busy, setBusy] = useState(false);

  const flags = useMemo(() => publishGateFlagsFromItem(bundle.item), [bundle.item]);
  const gate = useMemo(() => evaluatePublishGate(flags), [flags]);
  const tabIndex = CMKTE_TABS.findIndex((row) => row.id === tab);
  const lastTab = tab === 'publish';

  function showToast(message: string) {
    setToast(message);
  }

  function goTab(next: CmktETabId) {
    setTab(next);
  }

  function onPrevious() {
    if (tabIndex > 0) goTab(CMKTE_TABS[tabIndex - 1].id);
  }

  function onSaveValidate() {
    if (gate.status === 'Blocked') {
      showToast(`Save & validate: ${gate.blockers.length} blocker — Publish Gate BLOCKED.`);
      return;
    }
    showToast(
      gate.status === 'Warning'
        ? 'Save & validate: gate Warning · có thể Send to approval.'
        : 'Save & validate: gate PASS · có thể Send to approval.',
    );
  }

  async function sendToApproval() {
    if (!bundle.item) return;
    if (gate.status === 'Blocked') {
      goTab('publish');
      showToast(`Publish gate BLOCKED — ${gate.blockers.map((b) => b.message).join(' · ')}`);
      return;
    }
    const token = getAccessToken();
    if (!token) {
      showToast('Thiếu phiên đăng nhập.');
      return;
    }
    setBusy(true);
    try {
      await postContentOsSubmitReview(token, bundle.item.lifecycle_id, bundle.item.id);
      router.push(cmktePath('approvals'));
    } catch (err) {
      showToast(parseCmktGateError(err));
    } finally {
      setBusy(false);
    }
  }

  function onNext() {
    if (lastTab) {
      void sendToApproval();
      return;
    }
    goTab(CMKTE_TABS[tabIndex + 1].id);
  }

  async function runAction(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      bundle.reload();
    } catch (err) {
      showToast(parseCmktGateError(err));
    } finally {
      setBusy(false);
    }
  }

  if (bundle.loading) {
    return <p className="cmkte-status">Đang tải…</p>;
  }

  if (bundle.missing || !bundle.item) {
    return <p className="cmkte-empty">{CMKTE_EMPTY_ITEM}</p>;
  }

  const item = bundle.item;
  const slots = contextSlots(bundle);
  const urls = itemMediaUrls(item);
  const claimHits = itemClaimHits(item);
  const token = getAccessToken();
  const collisionNotice = calendarCollisionNotice(firstCalendarCollision(bundle.slots));

  return (
    <div className="cmkte-work">
      <div className="cmkte-head">
        <div>
          <h1>
            Content Production Workspace <span className="cmkte-status-pill">{item.status}</span>
          </h1>
          <p>
            {item.title || '—'} · item {item.id}
          </p>
        </div>
      </div>

      <div className="cmkte-context">
        {slots.map((slot) => (
          <div key={slot.label} className="cmkte-ctx">
            <small>{slot.label}</small>
            <b>{slot.value}</b>
          </div>
        ))}
      </div>

      <div className="cmkte-tabs" role="tablist">
        {CMKTE_TABS.map((row) => (
          <button
            key={row.id}
            type="button"
            role="tab"
            aria-selected={tab === row.id}
            className={tab === row.id ? 'cmkte-tabs__btn--active' : undefined}
            onClick={() => goTab(row.id)}
          >
            {row.label}
          </button>
        ))}
      </div>

      {tab === 'brief' ? (
        <section className="cmkte-card">
          <h2 className="cmkte-section-title">Brief & Strategy</h2>
          <JsonBlock value={item.brief_json} empty="Chưa có brief." />
        </section>
      ) : null}

      {tab === 'architecture' ? (
        <section className="cmkte-card">
          <h2 className="cmkte-section-title">Content Architecture</h2>
          {bundle.deliverables.length === 0 ? (
            <p className="cmkte-empty">Chưa có deliverable trong lifecycle này.</p>
          ) : (
            <div className="cmkte-table-scroll">
              <table className="cmkte-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Title</th>
                    <th>Format / Channel</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.deliverables.map((row) => (
                    <tr key={row.id}>
                      <td>{dash(row.display_code)}</td>
                      <td>{dash(row.title)}</td>
                      <td>{dash(deliverableFormatChannel(row))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {tab === 'copy' ? (
        <section className="cmkte-card">
          <h2 className="cmkte-section-title">Copy Studio</h2>
          {item.lifecycle_id > 0 ? (
            <p className="cmkte-desc">
              <a href={contentOsPanelHref(item.lifecycle_id)}>Mở editor CMKT</a>
            </p>
          ) : null}
          {claimHits.length ? (
            <ul className="cmkte-list">
              {claimHits.map((hit) => (
                <li key={hit}>Restricted: {hit}</li>
              ))}
            </ul>
          ) : null}
          {item.body_json?.markdown ? (
            <pre className="cmkte-json">
              {claimHighlightSegments(item.body_json.markdown, claimHits).map((seg, idx) =>
                seg.hit ? (
                  <mark key={`${seg.text}-${idx}`} className="cmkte-claim">
                    {seg.text}
                  </mark>
                ) : (
                  <span key={`${seg.text}-${idx}`}>{seg.text}</span>
                ),
              )}
            </pre>
          ) : (
            <JsonBlock value={item.body_json} empty="Chưa có copy." />
          )}
          {bundle.versions.length ? (
            <p className="cmkte-desc">{bundle.versions.length} phiên bản.</p>
          ) : (
            <p className="cmkte-empty">Chưa có version.</p>
          )}
          {bundle.comments.length ? (
            <ul className="cmkte-list">
              {bundle.comments.map((row) => (
                <li key={row.id}>
                  <b>{row.author_id}</b>
                  <span className="cmkte-dep">{row.body}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cmkte-empty">Chưa có comment.</p>
          )}
        </section>
      ) : null}

      {tab === 'assets' ? (
        <section className="cmkte-card">
          <h2 className="cmkte-section-title">Assets, DAM & Rights</h2>
          {urls.length === 0 ? (
            <p className="cmkte-empty">Chưa có asset.</p>
          ) : (
            <ul className="cmkte-list">
              {urls.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'seo' ? (
        <section className="cmkte-card">
          <h2 className="cmkte-section-title">SEO & Distribution</h2>
          {collisionNotice ? (
            <div className="cmkte-notice cmkte-notice--warn" role="status">
              <b>Trùng lịch xuất bản</b>
              <span>{collisionNotice}</span>
            </div>
          ) : null}
          {!bundle.seo || !bundle.seo.linked ? (
            <p className="cmkte-empty">Chưa liên kết SEO.</p>
          ) : (
            <p>
              SEO {dash(bundle.seo.seo_content_id)} · {dash(bundle.seo.workflow_status)}
              {bundle.seo.href ? (
                <>
                  {' '}
                  · <a href={bundle.seo.href}>{bundle.seo.href}</a>
                </>
              ) : null}
            </p>
          )}
        </section>
      ) : null}

      {tab === 'production' ? (
        <section className="cmkte-card">
          <h2 className="cmkte-section-title">Production Plan</h2>
          <JsonBlock value={item.production_json} empty="Chưa có production plan." />
        </section>
      ) : null}

      {tab === 'approvaltab' ? (
        <section className="cmkte-card">
          <h2 className="cmkte-section-title">Approval & Governance</h2>
          <p className="cmkte-desc">Trạng thái: {item.status}</p>
          <div className="cmkte-actions">
            <button
              type="button"
              className="cmkte-btn cmkte-btn--blue"
              disabled={busy || !token}
              onClick={() =>
                void runAction(() => postContentOsApproveItem(token as string, item.lifecycle_id, item.id))
              }
            >
              Approve
            </button>
          </div>
          <label className="cmkte-field">
            <span>Reject comment (tối thiểu 10 ký tự)</span>
            <textarea
              className="cmkte-input"
              rows={3}
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="cmkte-btn"
            disabled={busy || !token}
            onClick={() => {
              if (!rejectCommentValid(rejectComment)) {
                showToast('Comment từ chối tối thiểu 10 ký tự.');
                return;
              }
              void runAction(() =>
                postContentOsRejectItem(token as string, item.lifecycle_id, item.id, rejectComment.trim()),
              );
            }}
          >
            Reject
          </button>
        </section>
      ) : null}

      {tab === 'publish' ? (
        <section className="cmkte-card">
          <h2 className="cmkte-section-title">Publish Control</h2>
          {collisionNotice ? (
            <div className="cmkte-notice cmkte-notice--warn" role="status">
              <b>Trùng lịch xuất bản</b>
              <span>{collisionNotice}</span>
            </div>
          ) : null}
          {bundle.slots.length === 0 ? (
            <p className="cmkte-empty">Chưa có lịch xuất bản.</p>
          ) : (
            <ul className="cmkte-list">
              {bundle.slots.map((slot) => (
                <li key={slot.id}>
                  {slot.scheduled_at} · {slot.timezone}
                </li>
              ))}
            </ul>
          )}
          <p className="cmkte-desc">
            Publish gate: <b>{gate.status}</b>
          </p>
          {gate.blockers.length ? (
            <ul className="cmkte-list">
              {gate.blockers.map((row) => (
                <li key={row.code}>{row.message}</li>
              ))}
            </ul>
          ) : null}
          <p className="cmkte-desc">Connector tắt — chỉ đánh dấu published thủ công.</p>
          <button
            type="button"
            className="cmkte-btn"
            disabled={busy || !token || !canMarkPublished(gate.status, item.status)}
            onClick={() =>
              void runAction(() => postContentOsPublishItem(token as string, item.lifecycle_id, item.id))
            }
          >
            Mark published
          </button>
        </section>
      ) : null}

      <div className="cmkte-sticky">
        <div className="cmkte-saved">Audit logging active</div>
        <div className="cmkte-actions">
          <button type="button" className="cmkte-btn" disabled={tabIndex === 0} onClick={onPrevious}>
            ← Previous
          </button>
          <button type="button" className="cmkte-btn" onClick={onSaveValidate}>
            Save & validate
          </button>
          <button type="button" className="cmkte-btn cmkte-btn--blue" disabled={busy} onClick={onNext}>
            {lastTab ? 'Send to approval' : `Next: ${nextTabLabel(tab)} →`}
          </button>
        </div>
      </div>

      {toast ? (
        <div className="cmkte-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
