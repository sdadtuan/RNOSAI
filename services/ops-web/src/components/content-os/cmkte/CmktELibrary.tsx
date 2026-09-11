'use client';

import Link from 'next/link';
import { canOpenCreativeOsBrandKit, CREATIVE_OS_BRAND_KITS_HREF } from '@/lib/crm/cmkte-brand-kit';
import { DAM_PICK_LABEL, type DamUrlMetadata } from '@/lib/crm/cmkte-dam';
import type { StaffSectionCap } from '@/lib/auth';

export function CmktELibrary({
  caps,
  assetUrls,
  damItems = [],
  damError,
  damLoading = false,
  onPickFromDam,
}: {
  caps: StaffSectionCap[] | null | undefined;
  assetUrls: string[];
  damItems?: DamUrlMetadata[];
  damError?: string;
  damLoading?: boolean;
  onPickFromDam?: () => void;
}) {
  const canOpenKit = canOpenCreativeOsBrandKit(caps);

  return (
    <div className="cmkte-reqpage">
      <div className="cmkte-head">
        <div>
          <h1>Brand & Asset Library</h1>
          <p>Kho brand kit, asset master và quyền sử dụng — orchestration, không thay DAM khách.</p>
        </div>
        <div className="cmkte-actions">
          <Link href="/crm/content-os/w/0?tab=assets" className="cmkte-btn">
            Mở tab Assets
          </Link>
          {canOpenKit ? (
            <Link href={CREATIVE_OS_BRAND_KITS_HREF} className="cmkte-btn cmkte-btn--blue">
              Mở Creative OS Brand Kit
            </Link>
          ) : null}
        </div>
      </div>

      <div className="cmkte-layout">
        <div className="cmkte-card">
          <h3>Brand kits</h3>
          {canOpenKit ? (
            <p className="cmkte-desc">
              Deep link{' '}
              <Link href={CREATIVE_OS_BRAND_KITS_HREF}>{CREATIVE_OS_BRAND_KITS_HREF}</Link>
              {' · '}cap crm_cp.view.
            </p>
          ) : (
            <p className="cmkte-empty">Không có quyền mở Brand Kit Creative OS.</p>
          )}
        </div>
        <div className="cmkte-card">
          <h3>Approved assets</h3>
          <div className="cmkte-actions">
            <button
              type="button"
              className="cmkte-btn"
              disabled={damLoading || !onPickFromDam}
              onClick={() => onPickFromDam?.()}
            >
              {DAM_PICK_LABEL}
            </button>
          </div>
          {damError ? <p className="cmkte-status cmkte-status--error">{damError}</p> : null}
          {damItems.length > 0 ? (
            <ul className="cmkte-list">
              {damItems.map((asset) => (
                <li key={asset.id}>
                  <a href={asset.url} target="_blank" rel="noreferrer">
                    {asset.filename || asset.url}
                  </a>
                </li>
              ))}
            </ul>
          ) : damError ? (
            <p className="cmkte-empty">Chưa có asset từ DAM.</p>
          ) : null}
          {assetUrls.length === 0 ? (
            <p className="cmkte-empty">Chưa có asset từ item đang mở.</p>
          ) : (
            <ul className="cmkte-list">
              {assetUrls.map((url) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noreferrer">
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
