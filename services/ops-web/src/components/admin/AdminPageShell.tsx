'use client';

import type { ReactNode } from 'react';
import {
  ModuleSubNav,
  PageToolbar,
  StaffPageShell,
  type BreadcrumbItem,
} from '@/components/layout';
import {
  buildAiAutomationModuleLinks,
  buildCrmConfigModuleLinks,
} from '@/lib/admin/module-nav';
import type { StoredStaffUser } from '@/lib/auth';

type AdminSection = 'ai-automation' | 'crm-config';

type AdminPageShellProps = {
  user: StoredStaffUser | null;
  onLogout: () => void;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  section: AdminSection;
  showModuleNav?: boolean;
  hideToolbar?: boolean;
  width?: 'default' | 'wide' | 'narrow';
  loading?: boolean;
  children: ReactNode;
};

function moduleLinksForSection(user: StoredStaffUser | null, section: AdminSection) {
  if (section === 'crm-config') return buildCrmConfigModuleLinks(user);
  return buildAiAutomationModuleLinks(user);
}

function defaultBreadcrumb(section: AdminSection, title: string): BreadcrumbItem[] {
  if (section === 'crm-config') {
    return [
      { label: 'Cấu hình CRM', href: '/admin/crm/custom-fields' },
      { label: title },
    ];
  }
  return [
    { label: 'AI & Automation', href: '/crm/automation' },
    { label: title },
  ];
}

export function AdminPageShell({
  user,
  onLogout,
  title,
  subtitle,
  actions,
  breadcrumb,
  section,
  showModuleNav = true,
  hideToolbar = false,
  width = 'wide',
  loading,
  children,
}: AdminPageShellProps) {
  const moduleLinks = moduleLinksForSection(user, section);

  return (
    <StaffPageShell
      user={user}
      onLogout={onLogout}
      breadcrumb={breadcrumb ?? defaultBreadcrumb(section, title)}
      width={width}
      loading={loading}
    >
      {hideToolbar ? null : <PageToolbar title={title} subtitle={subtitle} actions={actions} />}
      {showModuleNav ? (
        <ModuleSubNav links={moduleLinks} ariaLabel="Admin module navigation" />
      ) : null}
      {children}
    </StaffPageShell>
  );
}
