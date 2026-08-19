'use client';

import { HrCompletenessRing } from '@/components/hr/HrCompletenessRing';
import type { HrStaffProfileDto } from '@/lib/hr-employee-file-api';

export type EmployeeFileTab = 'profile' | 'crm';

type Props = {
  profile: HrStaffProfileDto;
  activeTab: EmployeeFileTab;
  onTabChange: (tab: EmployeeFileTab) => void;
};

export function IdentityHeader({ profile, activeTab, onTabChange }: Props) {
  const { staff, identity, completeness_pct } = profile;
  const displayName = identity.legal_name?.trim() || staff.name;

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
          </p>
        </div>
        <div className="employee-file-header__ring">
          <HrCompletenessRing pct={completeness_pct} label="Độ đầy đủ hồ sơ" />
          <span className="muted" style={{ fontSize: '0.75rem' }}>
            Hồ sơ
          </span>
        </div>
      </div>
      <nav className="employee-file-tabs" aria-label="Employee file sections">
        {(
          [
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
