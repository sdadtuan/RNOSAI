import React from 'react';

export function PmPageState({
  loading,
  error,
  empty,
  denied,
}: {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  denied?: boolean;
}) {
  if (denied) return <p className="kpi-hub-form-error">Không có quyền xem màn này.</p>;
  if (loading) return <p className="kpi-hub-muted">Đang tải…</p>;
  if (error) return <p className="kpi-hub-form-error">{error}</p>;
  if (empty) return <p className="kpi-hub-muted">Chưa có dữ liệu kỳ này.</p>;
  return null;
}
