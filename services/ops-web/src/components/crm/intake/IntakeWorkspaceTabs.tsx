'use client';

import type { ReactNode } from 'react';
import type { IntakeWorkspaceTab } from '@/lib/crm/intake-workspace-tab';

const TABS: Array<{ id: IntakeWorkspaceTab; label: string }> = [
  { id: 'qualify', label: 'Qualify' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'win_intel', label: 'Win intel' },
  { id: 'handoff', label: 'Handoff' },
];

export type IntakeWorkspaceTabsProps = {
  activeTab: IntakeWorkspaceTab;
  onChange: (tab: IntakeWorkspaceTab) => void;
  qualify: ReactNode;
  discovery: ReactNode;
  winIntel: ReactNode;
  handoff: ReactNode;
};

export function IntakeWorkspaceTabs({
  activeTab,
  onChange,
  qualify,
  discovery,
  winIntel,
  handoff,
}: IntakeWorkspaceTabsProps) {
  const panel =
    activeTab === 'qualify'
      ? qualify
      : activeTab === 'discovery'
        ? discovery
        : activeTab === 'win_intel'
          ? winIntel
          : handoff;

  return (
    <div className="intake-workspace-tabs">
      <div className="intake-workspace-tabs__list" role="tablist" aria-label="Workspace qualify">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`intake-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`intake-panel-${tab.id}`}
            className={`intake-workspace-tabs__tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`intake-panel-${activeTab}`}
        aria-labelledby={`intake-tab-${activeTab}`}
        className="intake-workspace-tabs__panel"
      >
        {panel}
      </div>
    </div>
  );
}
