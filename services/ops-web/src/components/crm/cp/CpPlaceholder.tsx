import { dash } from '@/lib/crm/cp-format';

export function CpPlaceholder({ title }: { title: string }) {
  return (
    <section className="cp-placeholder">
      <h1>{title}</h1>
      <p className="cp-muted">Chưa có dữ liệu</p>
      <span className="cp-empty">{dash(null)}</span>
    </section>
  );
}
