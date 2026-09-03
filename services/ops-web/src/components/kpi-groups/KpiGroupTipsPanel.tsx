export function KpiGroupTipsPanel() {
  return (
    <aside className="kpi-group-tips-panel" aria-label="Gợi ý cấu hình">
      <h3 className="kpi-group-tips-panel__title">Gợi ý cấu hình</h3>
      <ul className="kpi-group-tips-panel__list">
        <li>
          <strong>Chuẩn hóa mã nhóm</strong>
          <p>Dùng mã IN HOA, gạch dưới — ví dụ <code>GROWTH_CONVERSION</code> — để dễ tra cứu và báo cáo.</p>
        </li>
        <li>
          <strong>Phạm vi áp dụng</strong>
          <p>Chọn &quot;Toàn doanh nghiệp&quot; cho nhóm dùng chung; chọn phòng ban/chức danh khi KPI chỉ áp dụng cục bộ.</p>
        </li>
        <li>
          <strong>Hướng đo mặc định</strong>
          <p>Thiết lập Tăng dần / Giảm dần / Duy trì ngưỡng để gợi ý đúng khi tạo chỉ tiêu mới.</p>
        </li>
        <li>
          <strong>Trạng thái</strong>
          <p>Chỉ nhóm <em>Đang hoạt động</em> xuất hiện trong biểu mẫu tạo KPI. Lưu nháp khi cần soạn thảo.</p>
        </li>
        <li>
          <strong>Thứ tự hiển thị</strong>
          <p>Số nhỏ hơn hiển thị trước trên danh sách và dropdown chọn nhóm.</p>
        </li>
      </ul>
    </aside>
  );
}
