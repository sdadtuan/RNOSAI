'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CP_FILTER_PRESETS } from '@/lib/crm/cp-copy';
import { hasCap, type StoredStaffUser } from '@/lib/auth';

type Scope = 'me' | 'team' | 'all';

function parseScope(raw: string | null): Scope {
  if (raw === 'team' || raw === 'all') return raw;
  return 'me';
}

function roleLabel(user: StoredStaffUser | null): string {
  if (!user) return 'Staff';
  if (hasCap(user, 'crm_cp', 'manage')) return 'Admin CP';
  if (hasCap(user, 'crm_cp.finance', 'view')) return 'Finance';
  return user.display_name?.split(' ')[0] ?? 'Creator';
}

type CpScopeBarProps = {
  user: StoredStaffUser | null;
  presetDays?: '30' | 'all';
  onPresetDaysChange?: (value: '30' | 'all') => void;
};

export function CpScopeBar({ user, presetDays = '30', onPresetDaysChange }: CpScopeBarProps) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const scope = parseScope(searchParams.get('scope'));

  function patchQuery(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === '') params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function changeScope(next: Scope) {
    patchQuery({ scope: next === 'me' ? null : next });
  }

  function applyLast30Days() {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    patchQuery({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    onPresetDaysChange?.('30');
  }

  return (
    <div className="cp-catalog" aria-label="Phạm vi và bộ lọc">
      <b>{roleLabel(user)}</b>
      <button
        type="button"
        className={`cp-sc${presetDays === '30' ? ' cp-sc--on' : ''}`}
        onClick={applyLast30Days}
      >
        {CP_FILTER_PRESETS.last30Days}
      </button>
      <button type="button" className="cp-sc">
        {CP_FILTER_PRESETS.clientAll}
      </button>
      <div className="cp-catalog__ops">
        <select
          className="cp-scope-select"
          value={scope}
          onChange={(event) => changeScope(parseScope(event.target.value))}
          aria-label="Phạm vi"
        >
          <option value="me">Của tôi</option>
          <option value="team">Team</option>
          <option value="all">Toàn bộ</option>
        </select>
      </div>
    </div>
  );
}
