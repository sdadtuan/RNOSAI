import type { ReactNode } from 'react';
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb';

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, breadcrumb, actions, className }: PageHeaderProps) {
  const root = ['rn-page-header', className].filter(Boolean).join(' ');
  return (
    <div className={root}>
      <div className="rn-page-header__main">
        {breadcrumb?.length ? <Breadcrumb items={breadcrumb} /> : null}
        <h2 className="rn-page-header__title">{title}</h2>
        {subtitle ? <p className="rn-page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="rn-page-header__actions">{actions}</div> : null}
    </div>
  );
}
