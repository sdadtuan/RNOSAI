'use client';

/** Staff/viewer account with no assigned Page: the server returns nothing, say why (t350u). */
export function isNoPageScope(scope?: { all_pages?: boolean; page_count?: number } | null): boolean {
  return Boolean(scope) && scope?.all_pages === false && (scope?.page_count ?? 0) === 0;
}

export function PortalNoPagesNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'tram-inbox__empty portal-no-pages is-compact' : 'tram-inbox__empty portal-no-pages'} role="status">
      <p>
        <strong>Chưa được phân Page</strong>
      </p>
      <p>Tài khoản của bạn chưa được giao Page nào nên chưa có Lead, tin nhắn hay bình luận để hiển thị. Liên hệ chủ tài khoản để được phân Page.</p>
    </div>
  );
}
