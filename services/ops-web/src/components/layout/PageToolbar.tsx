import type { ReactNode } from 'react';
import { PageHeader } from '@rnosai/ui';

type PageToolbarProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageToolbar({ title, subtitle, actions }: PageToolbarProps) {
  return <PageHeader title={title} subtitle={subtitle} actions={actions} />;
}
