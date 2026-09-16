export type TabItem = { id: string; label: string };

export type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export function Tabs({ items, value, onChange, className }: TabsProps) {
  const root = ['rn-tabs', className].filter(Boolean).join(' ');
  return (
    <div className={root} role="tablist">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={['rn-tabs__tab', active ? 'rn-tabs__tab--active' : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
