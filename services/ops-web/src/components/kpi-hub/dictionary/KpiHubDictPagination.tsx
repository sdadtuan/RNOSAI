'use client';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

function pageNumbers(current: number, totalPages: number): Array<number | '…'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: Array<number | '…'> = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(totalPages - 1, current + 1); p += 1) {
    pages.push(p);
  }
  if (current < totalPages - 2) pages.push('…');
  pages.push(totalPages);
  return pages;
}

export function KpiHubDictPagination({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="kpi-hub-dict-pagination">
      <p className="kpi-hub-dict-pagination__info">
        Hiển thị {from} đến {to} trong tổng số {total} KPI
      </p>
      <div className="kpi-hub-dict-pagination__controls" role="navigation" aria-label="Phân trang">
        <button
          type="button"
          className="kpi-hub-dict-pagination__btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Trang trước"
        >
          ‹
        </button>
        {pageNumbers(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="kpi-hub-dict-pagination__ellipsis">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`kpi-hub-dict-pagination__btn${p === page ? ' is-active' : ''}`}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="kpi-hub-dict-pagination__btn"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Trang sau"
        >
          ›
        </button>
      </div>
    </div>
  );
}
