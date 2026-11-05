export function KpiTypeTipsPanel() {
  return (
    <aside className="kpi-type-tips-panel">
      <h3 className="kpi-type-tips-panel__title">Gợi ý</h3>
      <ul className="kpi-type-tips-panel__list">
        <li>
          <strong>Nhóm KPI trước</strong>
          <p>Chỉ gán vào nhóm Đang hoạt động. Hệ thống gợi ý hướng đo và đơn vị.</p>
        </li>
        <li>
          <strong>AUTO cần kiểm tra công thức</strong>
          <p>Kích hoạt AUTO/HYBRID khi công thức VALID và nguồn HEALTHY hoặc STALE.</p>
        </li>
        <li>
          <strong>Không ghi 0 giả</strong>
          <p>Lỗi kết nối hiện CONNECTION_ERROR — không thay actual bằng 0.</p>
        </li>
      </ul>
    </aside>
  );
}
