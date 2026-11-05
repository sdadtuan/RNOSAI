import { Suspense, type ReactNode } from 'react';

export default function InternalReportsLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="p-6 text-sm text-slate-500">Đang tải…</p>}>{children}</Suspense>;
}
