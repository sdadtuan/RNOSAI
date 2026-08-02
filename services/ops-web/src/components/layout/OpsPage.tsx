import type { ReactNode } from 'react';
import { Breadcrumb, type BreadcrumbItem } from './Breadcrumb';

type OpsPageProps = {
  breadcrumb?: BreadcrumbItem[];
  children: ReactNode;
  width?: 'default' | 'wide' | 'narrow';
};

export function OpsPage({ breadcrumb, children, width = 'wide' }: OpsPageProps) {
  return (
    <main className={`ops-page ops-page--${width}`}>
      {breadcrumb?.length ? <Breadcrumb items={breadcrumb} /> : null}
      {children}
    </main>
  );
}
