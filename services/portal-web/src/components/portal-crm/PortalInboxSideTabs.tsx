'use client';

export type InboxSideTab = 'khach' | 'chot' | 'lead';

const TABS: Array<{ id: InboxSideTab; label: string }> = [
  { id: 'khach', label: 'Khách' },
  { id: 'chot', label: 'Chốt đơn' },
  { id: 'lead', label: 'Lead' },
];

export function PortalInboxSideTabs({
  value,
  onChange,
}: {
  value: InboxSideTab;
  onChange: (id: InboxSideTab) => void;
}) {
  return (
    <div className="tram-inbox__side-tabs" role="tablist" aria-label="Cột phải hội thoại">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={value === tab.id ? 'is-on' : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
