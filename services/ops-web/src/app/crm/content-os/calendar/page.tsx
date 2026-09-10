'use client';

import { useEffect, useState } from 'react';
import { clearSession } from '@/lib/auth';
import { isContentMarketingFeEnabled } from '@/lib/content-marketing-flags';
import type { ContentOsCalendarSlot } from '@/lib/content-os-api';
import { CmktECalendar } from '@/components/content-os/cmkte/CmktECalendar';
import { fetchPortfolioPublications } from '@/lib/crm/cmkte-api';
import { useCmktEPageAuth } from '@/lib/crm/use-cmkte-page';

export default function CrmContentOsCalendarPage() {
  const { user, error, setError, ensureAuth, router } = useCmktEPageAuth();
  const [slots, setSlots] = useState<ContentOsCalendarSlot[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      let access: string | null = null;
      try {
        access = await ensureAuth();
      } catch {
        clearSession();
        router.replace('/login');
        return;
      }
      if (!access || !isContentMarketingFeEnabled()) return;
      setLoading(true);
      setError('');
      try {
        const list = await fetchPortfolioPublications(access);
        setSlots(list.slots);
      } catch (err) {
        setSlots([]);
        setError(err instanceof Error ? err.message : 'Không tải được Publication Control');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, router, setError]);

  if (!user) return null;
  if (!isContentMarketingFeEnabled()) return <p className="cmkte-status">Module tắt</p>;

  return (
    <div>
      {loading ? <p className="cmkte-status">Đang tải…</p> : null}
      {error ? <p className="cmkte-status cmkte-status--error">{error}</p> : null}
      {!loading && slots ? <CmktECalendar slots={slots} /> : null}
    </div>
  );
}
