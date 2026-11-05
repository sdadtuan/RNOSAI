'use client';

import { useState } from 'react';
import Link from 'next/link';
import { canOpenCreativeOsBrandKit, CREATIVE_OS_BRAND_KITS_HREF } from '@/lib/crm/cmkte-brand-kit';
import {
  canBindDamUrl,
  DAM_EMPTY_COLLECTION_COPY,
  DAM_PICK_LABEL,
  inferDamAllowedHost,
  type DamUrlMetadata,
} from '@/lib/crm/cmkte-dam';
import type { StaffSectionCap } from '@/lib/auth';

export function CmktEDamDrawer({
  open,
  collection,
  onCollectionChange,
  items,
  error,
  loading,
  loaded,
  onClose,
  onLoad,
  onBind,
}: {
  open: boolean;
  collection: string;
  onCollectionChange: (value: string) => void;
  items: DamUrlMetadata[];
  error?: string;
  loading?: boolean;
  loaded?: boolean;
  onClose: () => void;
  onLoad: (collection: string) => void;
  onBind?: (asset: DamUrlMetadata) => void;
}) {
  const allowedHost = inferDamAllowedHost(items);
  if (!open) return null;
  return (
    <div
      className="cmkte-modalback"
      role="dialog"
      aria-label={DAM_PICK_LABEL}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="cmkte-modal">
        <h2>{DAM_PICK_LABEL}</h2>
        <p className="cmkte-desc">HTTP allowlist · không host file. Empty success ≠ lỗi.</p>
        <label className="cmkte-field">
          <span>Collection</span>
          <input
            className="cmkte-input"
            value={collection}
            onChange={(event) => onCollectionChange(event.target.value)}
          />
        </label>
        <div className="cmkte-actions">
          <button
            type="button"
            className="cmkte-btn cmkte-btn--blue"
            disabled={loading || !collection.trim()}
            onClick={() => onLoad(collection)}
          >
            Tải collection
          </button>
          <button type="button" className="cmkte-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        {loading ? <p className="cmkte-status">Đang tải…</p> : null}
        {error ? <p className="cmkte-status cmkte-status--error">{error}</p> : null}
        {items.length > 0 ? (
          <ul className="cmkte-list">
            {items.map((asset) => {
              const bindable = canBindDamUrl(asset.url, allowedHost);
              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    className="cmkte-btn"
                    disabled={!bindable || !onBind}
                    onClick={() => {
                      if (bindable) onBind?.(asset);
                    }}
                  >
                    {asset.filename || asset.url}
                  </button>
                  {!bindable ? (
                    <span className="cmkte-status cmkte-status--error">Host lạ — không bind</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : loaded && !error && !loading ? (
          <p className="cmkte-empty">{DAM_EMPTY_COLLECTION_COPY}</p>
        ) : null}
      </div>
    </div>
  );
}

export function CmktELibrary({
  caps,
  assetUrls,
  damItems = [],
  damError,
  damLoading = false,
  damLoaded = false,
  onPickFromDam,
  onBindDam,
}: {
  caps: StaffSectionCap[] | null | undefined;
  assetUrls: string[];
  damItems?: DamUrlMetadata[];
  damError?: string;
  damLoading?: boolean;
  damLoaded?: boolean;
  onPickFromDam?: (collection: string) => void;
  onBindDam?: (asset: DamUrlMetadata) => void;
}) {
  const canOpenKit = canOpenCreativeOsBrandKit(caps);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collection, setCollection] = useState('approved');

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
              onClick={() => {
                setDrawerOpen(true);
                onPickFromDam?.(collection);
              }}
            >
              {DAM_PICK_LABEL}
            </button>
          </div>
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
      <CmktEDamDrawer
        open={drawerOpen}
        collection={collection}
        onCollectionChange={setCollection}
        items={damItems}
        error={damError}
        loading={damLoading}
        loaded={damLoaded}
        onClose={() => setDrawerOpen(false)}
        onLoad={(next) => onPickFromDam?.(next)}
        onBind={onBindDam}
      />
    </div>
  );
}
