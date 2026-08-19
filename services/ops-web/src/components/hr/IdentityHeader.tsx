'use client';

import { HrCompletenessRing } from '@/components/hr/HrCompletenessRing';
import type { HrStaffProfileDto } from '@/lib/hr-employee-file-api';

export type EmployeeFileTab = 'profile' | 'wallet' | 'crm';

type Props = {
  profile: HrStaffProfileDto;
  activeTab: EmployeeFileTab;
  onTabChange: (tab: EmployeeFileTab) => void;
  walletPct?: number;
  expiringCount?: number;
};

export function IdentityHeader({ profile, activeTab, onTabChange, walletPct, expiringCount }: Props) {
  const { staff, identity } = profile;
  const displayName = identity.legal_name?.trim() || staff.name;
  const ringPct = walletPct ?? profile.wallet_pct ?? profile.completeness_pct;

  return (
    <header className="employee-file-header">
      <div className="employee-file-header__main">
        <div className="employee-file-header__avatar" aria-hidden>
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <div className="employee-file-header__meta">
          <h1 className="employee-file-header__title">{displayName}</h1>
          <p className="employee-file-header__sub muted">
            <span className="mono">{staff.internal_code || `#${staff.id}`}</span>
            {staff.dept_name ? ` · ${staff.dept_name}` : null}
            {staff.job_title ? ` · ${staff.job_title}` : null}
            {(expiringCount ?? profile.expiring_count) > 0 ? (
              <span className="hr-expiry-chip hr-expiry-chip--expiring" style={{ marginLeft: '0.5rem' }}>
                {(expiringCount ?? profile.expiring_count) ?? 0} hết hạn
              </span>
            ) : null}
          </p>
        </div>
        <div className="employee-file-header__ring">
          <HrCompletenessRing pct={ringPct} label="Ví giấy tờ %" />
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            Ví %
          </span>
        </div>
      </div>
      <nav className="employee-file-tabs" aria-label="Employee file sections">
        {(
          [
            ['wallet', 'Ví giấy tờ'],
            ['profile', 'Hồ sơ'],
            ['crm', 'CRM / Case'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            className={`employee-file-tabs__btn${activeTab === tab ? ' employee-file-tabs__btn--active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
