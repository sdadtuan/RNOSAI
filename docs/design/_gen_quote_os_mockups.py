#!/usr/bin/env python3
"""Generate Quotation OS SoT mockups (master + per-module). Run from repo root."""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent

SCREENS = [
    ("ovr-01", "Tổng quan", "Tổng quan Báo giá"),
    ("ovr-02", "Action Center", "Action Center"),
    ("ovr-03", "Activity", "Nhật ký"),
    ("lst-01", "Báo giá", "Danh sách báo giá"),
    ("new-01", "Tạo báo giá", "Tạo báo giá"),
    ("bld-01", "Tạo báo giá", "Builder · Khách & bối cảnh"),
    ("bld-02", "Tạo báo giá", "Builder · Phương án A/B/C"),
    ("bld-03", "Tạo báo giá", "Builder · Dịch vụ & SKU"),
    ("bld-04", "Tạo báo giá", "Builder · KPI 3 lớp"),
    ("bld-05", "Tạo báo giá", "Builder · Chi phí & margin"),
    ("bld-06", "Tạo báo giá", "Builder · Điều khoản"),
    ("bld-07", "Tạo báo giá", "Builder · Lịch sử"),
    ("cat-01", "Service Catalog", "Catalog · Lưới nhóm"),
    ("cat-02", "Service Catalog", "Catalog · Drawer 6 tab"),
    ("cat-03", "Service Catalog", "Catalog · Package ngành"),
    ("cat-04", "Service Catalog", "Catalog · Rate card"),
    ("cat-05", "Service Catalog", "Template storyboard brand"),
    ("apr-01", "Phê duyệt", "Hộp thư phê duyệt"),
    ("apr-02", "Phê duyệt", "Bước duyệt · policy · diff"),
    ("prs-01", "Tạo báo giá", "Proposal Studio"),
    ("pub-01", "Báo giá", "Trang khách · Proposal"),
    ("pub-02", "Báo giá", "Xác nhận đề xuất (OTP)"),
    ("pub-03", "Báo giá", "Hết hạn / thu hồi"),
    ("cvt-01", "Báo giá", "Convert → lifecycle"),
    ("rpt-01", "Báo cáo", "Báo cáo điều hành"),
    ("rpt-02", "Báo cáo", "Funnel chuyển đổi"),
    ("rpt-03", "Báo cáo", "Margin theo nhóm"),
    ("rpt-04", "Báo cáo", "Lý do thua"),
    ("rpt-05", "Báo cáo", "Tương tác proposal"),
    ("set-01", "Cấu hình", "Mặc định thương mại"),
    ("set-02", "Cấu hình", "Guardrail"),
    ("set-03", "Cấu hình", "Rate card"),
    ("set-04", "Cấu hình", "Chia sẻ & OTP"),
    ("set-05", "Cấu hình", "Approver"),
    ("set-06", "Cấu hình", "Template điều khoản"),
]

NAV_MAP = {
    "ovr-02": "ovr-01", "ovr-03": "ovr-01",
    "new-01": "lst-01",
    "bld-01": "new-01", "bld-02": "new-01", "bld-03": "new-01", "bld-04": "new-01",
    "bld-05": "new-01", "bld-06": "new-01", "bld-07": "new-01", "prs-01": "new-01",
    "cat-02": "cat-01", "cat-03": "cat-01", "cat-04": "cat-01", "cat-05": "cat-01",
    "apr-02": "apr-01",
    "pub-01": "lst-01", "pub-02": "lst-01", "pub-03": "lst-01", "cvt-01": "lst-01",
    "rpt-02": "rpt-01", "rpt-03": "rpt-01", "rpt-04": "rpt-01", "rpt-05": "rpt-01",
    "set-02": "set-01", "set-03": "set-01", "set-04": "set-01", "set-05": "set-01", "set-06": "set-01",
}

JUMP = "".join(f'<option value="{sid}">{sid.upper()} {title}</option>' for sid, _, title in SCREENS)
CHIPS = "".join(
    f'<button class="sc{" is-on" if sid=="ovr-01" else ""}" type="button" data-page="{sid}" onclick="show(\'{sid}\')">{sid.upper()}</button>'
    for sid, _, _ in SCREENS
)

NOTE = '<p class="note">Sample mockup (An Phát · QT-PTT-2026-000089 · 265.647.600 ₫ · GM 22,4%). Runtime thiếu số = <code>null</code> / <code>—</code>. Không hard-code vào app.</p>'


def crumb(path: str) -> str:
    return f'<div class="crumb">Kinh doanh / Báo giá / {path}</div>'


def head(h1: str, sub: str, actions: str) -> str:
    return f'<div class="head"><div><h1>{h1}</h1><p class="sub">{sub}</p></div><div class="actions">{actions}</div></div>'


BODIES = {}

BODIES["ovr-01"] = f"""
{crumb("Tổng quan")}
{head("Tổng quan Báo giá", "OVR-01 · last_updated 2026-09-08T09:18:00+07:00 · URL filter share được · công thức win rate trên thẻ", '''<select class="scope"><option>Tháng 09/2026</option><option>7 ngày</option><option>Quý 3</option></select><select class="scope"><option>Phạm vi: Của tôi</option><option>Team</option><option>Toàn PTT</option></select><button class="btn" type="button" onclick="show('ovr-02')">Action Center (5)</button><button class="btn-primary btn" type="button" onclick="show('new-01')">Tạo báo giá</button>''')}
<div class="alert"><span>2 chờ phê duyệt · 1 vượt SLA 24h · QT-PTT-2026-000089 GM 22,4% dưới floor 25%.</span><button class="btn" type="button" onclick="show('ovr-02')">Mở Action Center</button></div>
<div class="tiles">
  <button class="tile" type="button" onclick="show('lst-01')"><span>Giá trị quote đang mở</span><strong>8,46 tỷ ₫</strong><em class="up">draft…negotiation · không gồm accepted</em></button>
  <button class="tile" type="button" onclick="show('apr-01')"><span>Chờ phê duyệt</span><strong>2</strong><em class="dn">1 vượt SLA</em></button>
  <button class="tile" type="button" onclick="show('rpt-01')"><span>Tỷ lệ chốt</span><strong>31,4%</strong><em>accepted / (accepted+rejected) trong kỳ</em></button>
  <button class="tile" type="button" onclick="show('rpt-03')"><span>GM dự kiến (mở)</span><strong>29,1%</strong><em>ẩn nếu thiếu crm_quote.finance</em></button>
</div>
<div class="grid2">
  <div class="card"><div class="card-h"><b>Quote theo trạng thái</b><span class="muted">count + value · kỳ filter</span></div>
    <div class="side-row"><span>Nháp</span><b>18 · 1,24 tỷ ₫</b></div><div class="track"><b></b><i style="width:45%"></i></div>
    <div class="side-row"><span>Đã gửi</span><b>31 · 3,80 tỷ ₫</b></div><div class="track"><b></b><i style="width:78%"></i></div>
    <div class="side-row"><span>Thương lượng</span><b>14 · 2,16 tỷ ₫</b></div><div class="track"><b></b><i style="width:57%"></i></div>
    <div class="side-row"><span>Đã xác nhận</span><b>09 · 1,26 tỷ ₫</b></div><div class="track"><b></b><i style="width:38%;background:var(--ok)"></i></div>
  </div>
  <div class="card"><div class="card-h"><b>Sức khỏe thương mại</b><button class="linkish" type="button" onclick="show('set-02')">Policy</button></div>
    <div class="side-row"><span>Dưới GM floor 25%</span><b class="dn">5</b></div>
    <div class="side-row"><span>Discount &gt; 10%</span><b class="dn">3</b></div>
    <div class="side-row"><span>Thiếu cost estimate</span><b class="dn">7</b></div>
    <div class="side-row"><span>Khách đã xem chưa phản hồi</span><b>21</b></div>
  </div>
</div>
<div class="grid2">
  <div class="card"><div class="card-h"><b>Việc cần xử lý</b><button class="linkish" type="button" onclick="show('ovr-02')">Tất cả</button></div>
    <p>QT-PTT-2026-000071 · Finance · SLA quá 6h · <button class="linkish" type="button" onclick="show('apr-02')">Duyệt</button></p>
    <p>QT-PTT-2026-000089 · hết hạn 10/09 · <button class="linkish" type="button" onclick="show('bld-01')">Mở builder</button></p>
    <p>An Phát xem v2 lúc 08:41 · <button class="linkish" type="button" onclick="show('lst-01')">Follow-up</button></p>
  </div>
  <div class="card"><div class="card-h"><b>Top dịch vụ theo giá trị</b><button class="linkish" type="button" onclick="show('cat-01')">Catalog</button></div>
    <div class="side-row"><span>DV08 Meta Ads · Tiêu chuẩn</span><b>2,14 tỷ ₫</b></div>
    <div class="side-row"><span>DV05 Social retainer</span><b>1,81 tỷ ₫</b></div>
    <div class="side-row"><span>DV12 Brand Film</span><b>1,26 tỷ ₫</b></div>
  </div>
</div>
{NOTE}
"""

BODIES["ovr-02"] = f"""
{crumb("Action Center")}
{head("Action Center", "OVR-02 · FR-OVR-003 · severity · resource · owner · SLA · CTA · audit", '<button class="btn-primary btn" type="button" onclick="show(&quot;ovr-01&quot;)">Về dashboard</button>')}
<div class="tbl-wrap"><table><thead><tr><th>Sev</th><th>Việc</th><th>Impact</th><th>Owner</th><th>SLA</th><th>CTA</th></tr></thead><tbody>
<tr><td><span class="pill s-bad">Crit</span></td><td>QT-PTT-2026-000071 chờ Finance</td><td>GM 22,4% &lt; floor</td><td>Finance Lan</td><td>quá 6h</td><td><button class="btn" type="button" onclick="show('apr-02')">Duyệt / trả</button></td></tr>
<tr><td><span class="pill s-warn">High</span></td><td>QT-PTT-2026-000089 hết hạn 10/09</td><td>valid_until TZ Asia/Ho_Chi_Minh</td><td>AM Minh</td><td>2 ngày</td><td><button class="btn" type="button" onclick="show('bld-01')">Gia hạn / gửi</button></td></tr>
<tr><td><span class="pill s-warn">High</span></td><td>An Phát xem v2 · chưa comment</td><td>sent-to-viewed 18h</td><td>AM Minh</td><td>follow 24h</td><td><button class="btn" type="button" onclick="show('lst-01')">Mở quote</button></td></tr>
<tr><td><span class="pill s-info">Med</span></td><td>5 quote thiếu cost</td><td>Block submit nếu policy</td><td>AM team</td><td>—</td><td><button class="btn" type="button" onclick="show('bld-05')">Cost</button></td></tr>
<tr><td><span class="pill s-info">Med</span></td><td>Discount 12% Bloom</td><td>Route AD + Finance</td><td>AD Kiều</td><td>12h</td><td><button class="btn" type="button" onclick="show('apr-01')">Inbox</button></td></tr>
</tbody></table></div>
<div class="card"><b>Escalate</b><p class="muted">Approval +24h → owner + GDKD. Expiry ≤3 ngày → AM. Viewed +48h không phản hồi → task Deal Room. GM &lt; floor không được publish trước approve.</p></div>
"""

BODIES["ovr-03"] = f"""
{crumb("Nhật ký")}
{head("Nhật ký báo giá", "OVR-03 · filter actor / action / quote · export = crm_quote.audit", '<input class="inp" placeholder="Tìm QT-PTT, actor, lead"/><button class="btn" type="button">Export CSV</button>')}
<div class="filters"><button class="chip is-on">Tất cả</button><button class="chip">Status</button><button class="chip">Approval</button><button class="chip">Share</button><button class="chip">Accept</button><button class="chip">Convert</button></div>
<div class="tbl-wrap"><table><thead><tr><th>Thời điểm</th><th>Actor</th><th>Action</th><th>Resource</th><th>Snapshot</th></tr></thead><tbody>
<tr><td>09:12</td><td>AM Minh</td><td>quote.submit_approval</td><td>QT-PTT-2026-000089 v2</td><td>GM 22,4% · discount 5%</td></tr>
<tr><td>08:41</td><td>portal</td><td>publication.viewed</td><td>share sh_9f · An Phát</td><td>section=investment · IP masked</td></tr>
<tr><td>08:05</td><td>Finance Lan</td><td>approval.return</td><td>step finance</td><td>thiếu cost DV12</td></tr>
<tr><td>07:50</td><td>AM Minh</td><td>quote.convert</td><td>QT-PTT-2026-000044 v1</td><td>idem cvt_2a · 3 lifecycle</td></tr>
</tbody></table></div>
{NOTE}
"""

BODIES["lst-01"] = f"""
{crumb("Danh sách")}
{head("Danh sách báo giá", "LST-01 · 14 status · mã QT-PTT-{{YYYY}}-{{SEQ:6}} · margin chỉ finance", '''<button class="btn" type="button">Xuất CSV</button><button class="btn-primary btn" type="button" onclick="show('new-01')">Tạo báo giá</button>''')}
<div class="filters">
  <button class="chip is-on">Tất cả (62)</button><button class="chip">Của tôi</button><button class="chip">Chờ tôi phê duyệt</button><button class="chip">Sắp hết hạn ≤7n</button><button class="chip">Đã gửi chưa phản hồi</button>
  <select class="scope"><option>Owner: Tất cả</option><option>AM Minh</option><option>AM Kiều</option></select>
  <input class="inp" placeholder="Mã / khách / lead / title"/>
</div>
<div class="tbl-wrap"><table><thead><tr><th>Mã / ver</th><th>Khách · Lead</th><th>Phương án</th><th>Tổng · phí DV</th><th>GM</th><th>Status</th><th>Hiệu lực</th><th>Owner</th><th></th></tr></thead><tbody>
<tr><td><button class="linkish" type="button" onclick="show('bld-01')">QT-PTT-2026-000089</button><br><span class="muted">v2 working</span></td><td>An Phát<br><span class="muted">LD-2026-0441 · AM 360</span></td><td>A · Growth Launch</td><td>265.647.600 ₫<br><span class="muted">phí 132.600.000</span></td><td><span class="pill s-warn">22,4%</span></td><td><span class="pill s-warn">Chờ duyệt</span></td><td>10/09 · còn 2n</td><td>AM Minh</td><td><button class="btn" type="button" onclick="show('bld-01')">Mở</button></td></tr>
<tr><td>QT-PTT-2026-000102</td><td>Bloom Spa<br><span class="muted">LD-2026-0512</span></td><td>B · Retainer</td><td>84.240.000 ₫</td><td><span class="pill s-ok">31,2%</span></td><td><span class="pill s-info">Đã gửi</span></td><td>20/09 · 12n</td><td>AM Kiều</td><td><button class="btn" type="button">Nhân bản</button></td></tr>
<tr><td>QT-PTT-2026-000044</td><td>EduNext<br><span class="muted">đã convert</span></td><td>A</td><td>156.000.000 ₫</td><td><span class="pill s-ok">28,0%</span></td><td><span class="pill s-ok">Đã xác nhận</span></td><td>—</td><td>AM Minh</td><td><button class="btn" type="button" onclick="show('cvt-01')">Lifecycle</button></td></tr>
</tbody></table></div>
<p class="muted">Chip status đầy đủ: nháp · chờ rà soát · chờ duyệt · yêu cầu chỉnh · đã duyệt · đã gửi · đã xem · thương lượng · xác nhận · từ chối · hết hạn · hủy · đã thay · lưu trữ. Cột GM ẩn nếu không <code>crm_quote.finance</code>.</p>
{NOTE}
"""

BODIES["new-01"] = f"""
{crumb("Tạo báo giá")}
{head("Tạo báo giá", "NEW-01 · nguồn Lead / AM 360 / trống · select tên, cấm dán UUID · không tạo khách ma", '<button class="btn" type="button" onclick="show(&quot;lst-01&quot;)">Hủy</button><button class="btn-primary btn" type="button" onclick="show(&quot;bld-01&quot;)">Tạo nháp</button>')}
<div class="stepper"><span class="is-on">1. Nguồn</span><span>2. Header</span><span>3. Builder</span></div>
<div class="grid3">
  <button class="card opt is-on" type="button"><span class="pill s-info">Khuyến nghị</span><h3>Từ Lead / Deal Room</h3><p class="muted">Kế thừa khách, owner, close date, tags. Deep-link <code>?lead_id=</code> từ Consult.</p></button>
  <button class="card opt" type="button"><h3>Từ AM 360</h3><p class="muted">Chọn khách đang active. Gắn lead sau nếu có.</p></button>
  <button class="card opt" type="button"><h3>Trống</h3><p class="muted">Bắt buộc chọn khách trước submit. Không invent client.</p></button>
</div>
<div class="grid2">
  <div class="card form">
    <label>Lead *<select class="inp"><option>LD-2026-0441 · An Phát · Growth Q4 · AM Minh</option><option>LD-2026-0512 · Bloom Spa · Retainer</option></select></label>
    <label>Khách (AM 360) *<select class="inp"><option>Công ty Cổ phần An Phát</option><option>Bloom Spa</option><option>EduNext</option></select><span class="muted">SoR <code>crm_clients</code> — form không có ô UUID</span></label>
    <label>Tiêu đề *<input class="inp" value="Growth Proposal Q4/2026"/></label>
    <label>Loại<select class="inp"><option>new_business</option><option>renewal</option><option>upsell</option><option>retainer</option><option>campaign</option></select></label>
  </div>
  <div class="card">
    <b>Prefill từ lead</b>
    <div class="side-row"><span>Owner</span><b>AM Minh</b></div>
    <div class="side-row"><span>Liên hệ quyết định</span><b>Nguyễn Minh Anh · Marketing Director</b></div>
    <div class="side-row"><span>Expected close</span><b>30/09/2026</b></div>
    <div class="side-row"><span>Entity phát hành</span><b>PTT HCM</b></div>
    <div class="side-row"><span>Mã sẽ cấp</span><b>QT-PTT-2026-000089</b></div>
    <p class="muted">Tạo = root <code>crm_proposals</code> + working v1. Currency VND. valid_until mặc định +30 ngày.</p>
  </div>
</div>
"""

BLD_TABS = '''<div class="tabs">
  <button class="tab" type="button" onclick="show('bld-01')">Bối cảnh</button>
  <button class="tab" type="button" onclick="show('bld-02')">Phương án</button>
  <button class="tab" type="button" onclick="show('bld-03')">Dịch vụ</button>
  <button class="tab" type="button" onclick="show('bld-04')">KPI</button>
  <button class="tab" type="button" onclick="show('bld-05')">Chi phí</button>
  <button class="tab" type="button" onclick="show('bld-06')">Điều khoản</button>
  <button class="tab" type="button" onclick="show('bld-07')">Lịch sử</button>
  <button class="tab" type="button" onclick="show('prs-01')">Studio</button>
</div>'''

STICKY = '''<aside class="sticky">
  <div class="card"><div class="card-h"><b>Tóm tắt đầu tư</b><span class="muted">client-facing</span></div>
    <div class="side-row"><span>Phí dịch vụ</span><b>132.600.000 ₫</b></div>
    <div class="side-row"><span>Media (pass-through)</span><b>120.000.000 ₫</b></div>
    <div class="side-row"><span>Chiết khấu package</span><b class="up">−6.630.000 ₫</b></div>
    <div class="side-row"><span>VAT 8% (snapshot)</span><b>19.677.600 ₫</b></div>
    <div class="total-row"><span>Tổng phải thu</span><b>265.647.600 ₫</b></div>
  </div>
  <div class="card"><div class="card-h"><b>Sức khỏe nội bộ</b><span class="muted">finance</span></div>
    <div class="side-row"><span>NSR (fee only)</span><b>126.000.000 ₫</b></div>
    <div class="side-row"><span>Gross margin</span><b><span class="pill s-warn">22,4% · dưới floor</span></b></div>
    <div class="side-row"><span>Discount</span><b>5%</b></div>
    <p class="muted">Media không vào NSR. Submit dưới 25% → Finance + GDKD.</p>
  </div>
  <div class="card"><div class="card-h"><b>Thanh toán</b><button class="linkish" type="button" onclick="show('bld-06')">Sửa</button></div>
    <div class="flow-row"><span class="flow-num">1</span><div><b>50% · 132.823.800 ₫</b><span class="muted">Ký xác nhận / kickoff</span></div></div>
    <div class="flow-row"><span class="flow-num">2</span><div><b>30% · 79.694.280 ₫</b><span class="muted">Giữa kỳ tháng 2</span></div></div>
    <div class="flow-row"><span class="flow-num">3</span><div><b>20% · 53.129.520 ₫</b><span class="muted">Nghiệm thu — làm tròn đợt cuối</span></div></div>
  </div>
</aside>'''


def bld_head(sid: str) -> str:
    return f"""
{crumb("Builder / QT-PTT-2026-000089")}
{head("Growth Proposal Q4/2026", f"{sid.upper()} · An Phát · LD-2026-0441 · autosave 09:18 · row_version 7 · <span class='pill s-warn'>Nháp / chờ duyệt</span>", '''<button class="btn" type="button">Lưu nháp</button><button class="btn" type="button" onclick="show('prs-01')">Xem Proposal</button><button class="btn-primary btn" type="button" onclick="show('apr-02')">Gửi phê duyệt</button>''')}
{BLD_TABS}
"""


BODIES["bld-01"] = f"""
{bld_head("bld-01")}
<div class="builder">
  <div>
    <div class="card">
      <div class="card-h"><b>Khách hàng &amp; bối cảnh</b><span class="muted">SoR AM 360 · không đổi UUID tay</span></div>
      <div class="client-top"><div class="client-logo">AP</div><div><h3>Công ty Cổ phần An Phát</h3><p class="muted">Nguyễn Minh Anh · Marketing Director · minhanh@anphat.vn</p><p class="muted">Lead <button class="linkish" type="button">LD-2026-0441</button> · Deal Room / Consult</p></div></div>
      <div class="ctx">
        <div><div class="lbl">Mục tiêu</div>Tạo lead chất lượng dự án căn hộ cao cấp Q4</div>
        <div><div class="lbl">Thời gian</div>01/10/2026 — 31/12/2026</div>
        <div><div class="lbl">Đối tượng</div>25–45 · TP.HCM · thu nhập trung-cao</div>
      </div>
      <div class="form-2" style="margin-top:12px">
        <label class="muted">Ngày báo giá<input class="inp" type="date" value="2026-09-08"/></label>
        <label class="muted">Hiệu lực đến *<input class="inp" type="date" value="2026-10-07"/></label>
      </div>
    </div>
    {NOTE}
  </div>
  {STICKY}
</div>
"""

BODIES["bld-02"] = f"""
{bld_head("bld-02")}
<div class="builder">
  <div>
    <p class="muted">Tối đa 1 phương án <code>recommended</code>. Client chỉ thấy option <code>client_visible</code>. Chọn 1 option lúc accept (PUB-02).</p>
    <div class="opt-grid">
      <button class="opt is-on is-rec" type="button"><span class="pill s-ok">Recommended</span><h3>A · Growth Launch</h3><p>3 tháng · 4 kênh · 48 deliverable</p><b>265.647.600 ₫</b></button>
      <button class="opt" type="button"><h3>B · Essential</h3><p>3 tháng · 2 kênh · 28 deliverable</p><b>186.400.000 ₫</b></button>
      <button class="opt" type="button"><h3>C · Aggressive</h3><p>3 tháng · 5 kênh · media 200tr</p><b>348.000.000 ₫</b></button>
    </div>
    <div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th></th><th>A</th><th>B</th><th>C</th></tr></thead><tbody>
      <tr><td>Phí DV</td><td>132.600.000</td><td>96.000.000</td><td>156.000.000</td></tr>
      <tr><td>Media</td><td>120.000.000</td><td>72.000.000</td><td>200.000.000</td></tr>
      <tr><td>Lead forecast</td><td>1.200</td><td>720</td><td>1.800</td></tr>
      <tr><td>GM nội bộ</td><td class="dn">22,4%</td><td>28,1%</td><td>21,0%</td></tr>
    </tbody></table></div>
    <div class="actions"><button class="btn" type="button">Nhân bản phương án</button><button class="btn" type="button">Ẩn C khỏi khách</button></div>
  </div>
  {STICKY}
</div>
"""

BODIES["bld-03"] = f"""
{bld_head("bld-03")}
<div class="builder">
  <div>
    <div class="svc">
      <div class="svc-h"><span class="svc-no">1</span><div><h3>Meta Ads Performance</h3><p class="muted"><span class="tag">DV08</span> <span class="tag">ops_service_profile</span> <span class="tag">fee + media</span></p></div><div class="svc-price">48.000.000 ₫<small>fee / 3 tháng · media 120tr tách dòng</small></div></div>
      <div class="sku" style="padding:0 14px"><span class="muted">SKU 3 tầng (package_tier)</span>
        <button type="button">Cơ bản</button><button class="is-on" type="button">Tiêu chuẩn</button><button type="button">Chuyên sâu</button>
      </div>
      <div class="metrics">
        <div class="metric"><span>Campaign set</span><b>3</b></div>
        <div class="metric"><span>Ad set</span><b>12</b></div>
        <div class="metric teal"><span>CTR mục tiêu</span><b>≥1,8%</b></div>
        <div class="metric teal"><span>CPL mục tiêu</span><b>≤100K</b></div>
        <div class="metric teal"><span>Lead forecast</span><b>1.200</b></div>
      </div>
      <div class="funnelbox">
        <div><div class="lbl">Funnel Meta (forecast)</div>
          <div class="funnel"><div class="fstep"><b>2,4tr</b><span>Imp.</span></div><div class="fstep"><b>43K</b><span>Click</span></div><div class="fstep"><b>1.5K</b><span>Lead</span></div><div class="fstep"><b>1.2K</b><span>SQL</span></div></div>
        </div>
        <div class="funnel-kpis"><div class="funnel-kpi"><span>CTR</span><b>1,8%</b></div><div class="funnel-kpi"><span>CVR</span><b>3,5%</b></div><div class="funnel-kpi"><span>CPL</span><b>100K</b></div><div class="funnel-kpi"><span>Nhãn</span><b>projected</b></div></div>
      </div>
      <div class="svc-foot"><div><strong>Included</strong>Setup + tối ưu tuần + A/B 8 creative</div><div><strong>Timeline</strong>Kickoff 5 ngày làm việc</div><div><strong>Assumption</strong>Media ≥ 40tr/tháng</div></div>
    </div>
    <div class="svc">
      <div class="svc-h"><span class="svc-no">2</span><div><h3>Social Media Management</h3><p class="muted"><span class="tag">DV05</span> <span class="tag">Tiêu chuẩn</span></p></div><div class="svc-price">54.000.000 ₫<small>retainer 3 tháng</small></div></div>
      <div class="metrics">
        <div class="metric"><span>Bài / tháng</span><b>24</b></div>
        <div class="metric"><span>Reels / tháng</span><b>12</b></div>
        <div class="metric"><span>Kênh</span><b>FB + TikTok</b></div>
        <div class="metric"><span>Báo cáo</span><b>Tuần</b></div>
        <div class="metric"><span>Hạng KPI</span><b>committed</b></div>
      </div>
    </div>
    <div class="alert"><span>Service <b>Draft</b> / custom chưa Commercial kích hoạt — không thêm vào quote client-facing.</span><button class="btn" type="button" onclick="show('cat-02')">Mở catalog</button></div>
    <div class="actions"><button class="btn" type="button" onclick="show('cat-01')">＋ Từ Catalog</button><button class="btn" type="button">Dòng tùy chỉnh (flag + reason)</button></div>
  </div>
  {STICKY}
</div>
"""

BODIES["bld-04"] = f"""
{bld_head("bld-04")}
<div class="builder">
  <div>
    <div class="card"><b>Phân lớp KPI bắt buộc trước publish</b>
      <p class="muted">Cam kết bàn giao ≠ mục tiêu tối ưu ≠ forecast. Forecast không được style như cam kết.</p>
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>Chỉ số</th><th>Lớp</th><th>Giá trị</th><th>Nguồn</th><th>Assumption</th></tr></thead><tbody>
      <tr><td>24 bài + 12 Reels / tháng</td><td><span class="pill s-ok">committed</span></td><td>36 asset</td><td>deliverable</td><td>Duyệt nội dung ≤2 ngày</td></tr>
      <tr><td>CTR Meta</td><td><span class="pill s-info">optimization</span></td><td>≥1,8%</td><td>Ads Manager</td><td>Creative A/B đủ 8 mẫu</td></tr>
      <tr><td>Lead</td><td><span class="pill s-warn">forecast</span></td><td>1.000–1.200</td><td>CRM + pixel</td><td>Media 120tr · LP live</td></tr>
      <tr><td>Ngân sách media</td><td><span class="pill">assumption</span></td><td>120.000.000 ₫</td><td>khách</td><td>Thanh toán đúng lịch</td></tr>
    </tbody></table></div>
    <p class="muted">Paid media: bắt buộc budget + platform + geo/audience + measurement trước gửi khách.</p>
  </div>
  {STICKY}
</div>
"""

BODIES["bld-05"] = f"""
{bld_head("bld-05")}
<div class="builder">
  <div>
    <div class="alert"><span>Màn finance-restricted. Không xuống portal / PDF / public API. Guard <code>crm_quote.finance</code>.</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>Line</th><th>Fee net</th><th>Labor</th><th>Outsource</th><th>Tools</th><th>GP</th><th>GM</th></tr></thead><tbody>
      <tr><td>DV08 Meta · Tiêu chuẩn</td><td>45.600.000</td><td>28.000.000</td><td>8.000.000</td><td>1.200.000</td><td>8.400.000</td><td class="dn">18,4%</td></tr>
      <tr><td>DV05 Social</td><td>51.300.000</td><td>32.000.000</td><td>4.000.000</td><td>800.000</td><td>14.500.000</td><td>28,3%</td></tr>
      <tr><td>DV12 Brand Film</td><td>29.100.000</td><td>—</td><td>—</td><td>—</td><td>—</td><td><span class="pill s-warn">thiếu cost</span></td></tr>
    </tbody></table></div>
    <div class="card">
      <div class="side-row"><span>Net Service Revenue</span><b>126.000.000 ₫</b></div>
      <div class="side-row"><span>Direct cost</span><b>97.776.000 ₫</b></div>
      <div class="side-row"><span>Gross profit</span><b>28.224.000 ₫</b></div>
      <div class="side-row"><span>Gross margin</span><b class="dn">22,4%</b></div>
      <p class="muted">NSR = fee-only, loại media no-markup. Override rate/cost = Finance + reason. NSR=0 → GM <code>null</code>.</p>
    </div>
  </div>
  {STICKY}
</div>
"""

BODIES["bld-06"] = f"""
{bld_head("bld-06")}
<div class="builder">
  <div>
    <div class="card form">
      <label>Template điều khoản<select class="inp"><option>PTT HCM · chuẩn 2026</option><option>Retainer</option></select></label>
      <label>Lệch template (Legal)<textarea class="inp">Không — dùng clause snapshot chuẩn</textarea></label>
      <p class="muted">Clause lệch → route <code>crm_quote.legal</code>. Wording accept: <b>Xác nhận đề xuất</b>, không “ký hợp đồng”.</p>
    </div>
    <div class="card"><b>Lịch thanh toán — tổng % = 100</b>
      <div class="tbl-wrap"><table><thead><tr><th>#</th><th>%</th><th>Số tiền</th><th>Mốc</th></tr></thead><tbody>
        <tr><td>1</td><td>50</td><td>132.823.800</td><td>Xác nhận đề xuất</td></tr>
        <tr><td>2</td><td>30</td><td>79.694.280</td><td>Ngày 15 tháng 2</td></tr>
        <tr><td>3</td><td>20</td><td>53.129.520</td><td>Nghiệm thu · nhận phần dư làm tròn</td></tr>
      </tbody></table></div>
      <p class="muted">Lệch 1 ₫ → đợt cuối. Lệch % → block submit. Payment term &gt; 60 ngày → Finance.</p>
    </div>
  </div>
  {STICKY}
</div>
"""

BODIES["bld-07"] = f"""
{bld_head("bld-07")}
<div class="builder">
  <div>
    <div class="tbl-wrap"><table><thead><tr><th>Ver</th><th>State</th><th>Thay đổi</th><th>Ai</th><th>Khi</th></tr></thead><tbody>
      <tr><td>v1</td><td>superseded</td><td>Gửi khách 01/09 · option A</td><td>AM Minh</td><td>01/09</td></tr>
      <tr><td>v2</td><td>submitted</td><td>Meta 42tr → 48tr · discount 3→5% · payment 60/40 → 50/30/20</td><td>AM Minh</td><td>08/09</td></tr>
    </tbody></table></div>
    <div class="card"><div class="card-h"><b>Diff v1 → v2 (commercial critical)</b></div>
      <div class="diff"><b>DV08 unit price</b><p class="muted">42.000.000 → 48.000.000 · tăng 1 campaign set</p></div>
      <div class="diff"><b>Package discount</b><p class="muted">3% → 5%</p></div>
      <div class="diff"><b>Payment</b><p class="muted">60/40 → 50/30/20</p></div>
      <p class="muted">Sửa sau Approved → revision mới, v cũ immutable, re-route policy.</p>
    </div>
  </div>
  {STICKY}
</div>
"""

BODIES["cat-01"] = f"""
{crumb("Service Catalog")}
{head("Service Catalog", "CAT-01 · 13 nhóm + package ngành · Active mới add quote client-facing", '''<select class="scope"><option>Rate card HCM 2026</option></select><button class="btn" type="button" onclick="show('cat-04')">Rate card</button><button class="btn-primary btn" type="button">＋ Dịch vụ</button>''')}
<div class="filters"><button class="chip is-on">Active</button><button class="chip">Draft</button><button class="chip">Package ngành</button><input class="inp" placeholder="Tìm slug / dv_code / tên"/></div>
<div class="cat-grid">
  <button class="cat-item" type="button" onclick="show('cat-02')"><span class="pill s-ok">Active</span><h3>1. Strategy &amp; Research</h3><p class="muted">Audit · insight · kế hoạch</p></button>
  <button class="cat-item" type="button" onclick="show('cat-02')"><span class="pill s-ok">Active</span><h3>2. Branding &amp; Creative</h3><p class="muted">Identity · key visual</p></button>
  <button class="cat-item" type="button" onclick="show('cat-02')"><span class="pill s-ok">Active</span><h3>3. Content &amp; Social · DV05</h3><p class="muted">Retainer 3 SKU</p></button>
  <button class="cat-item" type="button" onclick="show('cat-02')"><span class="pill s-ok">Active</span><h3>4. Video &amp; Image · DV12</h3><p class="muted">Reels · Brand Film</p></button>
  <button class="cat-item" type="button" onclick="show('cat-02')"><span class="pill s-ok">Active</span><h3>5. Performance &amp; Media · DV08</h3><p class="muted">Meta / Google / TikTok</p></button>
  <button class="cat-item" type="button"><span class="pill s-ok">Active</span><h3>6. Web, LP &amp; CRO</h3><p class="muted">Landing · A/B</p></button>
  <button class="cat-item" type="button"><span class="pill s-ok">Active</span><h3>7. SEO / AEO / Organic</h3><p class="muted">Technical + content</p></button>
  <button class="cat-item" type="button"><span class="pill s-info">Draft</span><h3>8. CRM, Automation &amp; AI</h3><p class="muted">Không add quote khách</p></button>
  <button class="cat-item" type="button"><h3>9. Email &amp; Retention</h3><p class="muted">Journey · flow</p></button>
  <button class="cat-item" type="button"><h3>10. PR, KOL &amp; Reputation</h3><p class="muted">Booking KOL</p></button>
  <button class="cat-item" type="button"><h3>11. Event &amp; Activation</h3><p class="muted">Offline / launch</p></button>
  <button class="cat-item" type="button"><h3>12. Sales Enablement B2B</h3><p class="muted">Deck · playbook</p></button>
  <button class="cat-item" type="button"><h3>13. Data &amp; Analytics</h3><p class="muted">Dashboard · pixel</p></button>
  <button class="cat-item" type="button" onclick="show('cat-03')"><span class="pill s-info">Package</span><h3>Ngành BĐS / Spa / Edu / Growth</h3><p class="muted">CAT-03</p></button>
</div>
<p class="muted">Mỗi service: <code>service_slug</code> và/hoặc <code>dv_code</code> → <code>ops_service_profile</code>. 3 gói = SKU cùng dv_code, không phải nhóm sidebar.</p>
"""

BODIES["cat-02"] = f"""
{crumb("Catalog / DV08")}
{head("Meta Ads Performance · DV08", "CAT-02 · drawer 6 tab · snapshot vào line khi add", '<button class="btn" type="button" onclick="show(&quot;cat-01&quot;)">Đóng</button><button class="btn-primary btn" type="button" onclick="show(&quot;bld-03&quot;)">Thêm vào báo giá</button>')}
<div class="drawer">
  <div class="card">
    <p><b>Status</b> Active</p>
    <p><b>SKU</b> Cơ bản / Tiêu chuẩn / Chuyên sâu</p>
    <p><b>Owner catalog</b> Performance Lead</p>
    <p class="muted">Draft → nút Thêm disabled trên quote client-facing.</p>
  </div>
  <div>
    <div class="tabs">
      <button class="tab is-on" type="button" onclick="subtab(this,'cat02-ov')">Tổng quan</button>
      <button class="tab" type="button" onclick="subtab(this,'cat02-del')">Deliverable</button>
      <button class="tab" type="button" onclick="subtab(this,'cat02-kpi')">KPI</button>
      <button class="tab" type="button" onclick="subtab(this,'cat02-tl')">Timeline</button>
      <button class="tab" type="button" onclick="subtab(this,'cat02-pr')">Pricing &amp; Cost</button>
      <button class="tab" type="button" onclick="subtab(this,'cat02-po')">Proposal &amp; Policy</button>
    </div>
    <div class="subpage is-on" id="cat02-ov"><div class="card"><b>Included</b><p>Setup pixel, 3 campaign set, tối ưu tuần, báo cáo.</p><b>Excluded</b><p>Media buy (khách trả nền tảng). Creative ngoài 8 mẫu.</p><p class="muted">CTA/UTA library · effort 12 MD / tháng (Tiêu chuẩn).</p></div></div>
    <div class="subpage" id="cat02-del"><div class="card"><p>8 creative / tháng · format 1:1 + 9:16 · nghiệm thu: file + report Ads.</p></div></div>
    <div class="subpage" id="cat02-kpi"><div class="card"><p>committed: báo cáo tuần. optimization: CTR/CPL. forecast: lead — cần assumption media.</p></div></div>
    <div class="subpage" id="cat02-tl"><div class="card"><p>Kickoff 5 NLV · always-on 12 tuần · pause 3 ngày nếu media trễ.</p></div></div>
    <div class="subpage" id="cat02-pr"><div class="card"><p>Rate Tiêu chuẩn 16.000.000 ₫/tháng. Cost labor+tools restricted. GM target 28%.</p></div></div>
    <div class="subpage" id="cat02-po"><div class="card"><p>client_visible mặc định. Map Studio section 04 + 07. Require approval nếu custom price.</p></div></div>
  </div>
</div>
"""

BODIES["cat-03"] = f"""
{crumb("Catalog / Package ngành")}
{head("Package theo ngành", "CAT-03 · BĐS / Spa / Education / Growth Launch · bundle nhiều slug", '<button class="btn" type="button" onclick="show(&quot;cat-01&quot;)">Về lưới</button>')}
<div class="grid2">
  <div class="card"><h3>Growth Launch (sample)</h3><p>DV05 + DV08 + LP + 12 Reels. Discount package 5%. Add = N line snapshot.</p><button class="btn-primary btn" type="button" onclick="show('bld-03')">Áp vào option A</button></div>
  <div class="card"><h3>Bất động sản</h3><p>Lead-gen Meta + content căn hộ + Brand Film tour. Template KPI lead + booking.</p></div>
  <div class="card"><h3>Spa / Clinic</h3><p>Retainer social + booking ads. Cấm claim y khoa trên forecast.</p></div>
  <div class="card"><h3>Education</h3><p>Enrollment funnel · mùa tuyển sinh. Payment thường 40/40/20.</p></div>
</div>
"""

BODIES["cat-04"] = f"""
{crumb("Catalog / Rate card")}
{head("Rate card HCM 2026", "CAT-04 · effective_from/to · snapshot lúc add line / publish", '<button class="btn-primary btn" type="button">Lưu</button>')}
<div class="tbl-wrap"><table><thead><tr><th>dv_code</th><th>SKU</th><th>Fee / tháng</th><th>Cost labor</th><th>Hiệu lực</th><th>State</th></tr></thead><tbody>
<tr><td>DV08</td><td>Tiêu chuẩn</td><td>16.000.000</td><td>9.200.000</td><td>01/01–31/12/2026</td><td><span class="pill s-ok">Active</span></td></tr>
<tr><td>DV05</td><td>Tiêu chuẩn</td><td>18.000.000</td><td>11.000.000</td><td>01/01–31/12/2026</td><td><span class="pill s-ok">Active</span></td></tr>
<tr><td>DV12</td><td>Brand Film 45s</td><td>45.000.000 / spot</td><td>—</td><td>01/06/2026–</td><td><span class="pill s-warn">Thiếu cost</span></td></tr>
<tr><td>DV08</td><td>Cơ bản 2025</td><td>12.000.000</td><td>7.000.000</td><td>hết 31/12/2025</td><td><span class="pill">Retired</span></td></tr>
</tbody></table></div>
<p class="muted">Rate hết hạn → cảnh báo/block theo SET-02. Đổi card không sửa version quote đã snapshot.</p>
"""

BODIES["cat-05"] = f"""
{crumb("Catalog / Template production")}
{head("VID-TPL-01 · Brand Film / Reels storyboard", "CAT-05 · không phải màn quote · template deliverable → Video SOP / CP OS sau convert", '<button class="btn" type="button" onclick="show(&quot;cvt-01&quot;)">Xem convert</button>')}
<div class="grid2">
  <div class="card">
    <div class="cover"><small>PTT × AN PHÁT</small><h2>Brand Film 45s<br>6 scene · 1080×1920</h2><p>Hook → strategy → creative → performance/CRM → CTA ĐẶT LỊCH TƯ VẤN</p></div>
    <p class="muted">Master dọc. VO + CTA library. QT không host editor video.</p>
  </div>
  <div class="card">
    <div class="tbl-wrap"><table><thead><tr><th>#</th><th>Scene</th><th>Thời lượng</th></tr></thead><tbody>
      <tr><td>1</td><td>Hook căn hộ / lifestyle</td><td>0–6s</td></tr>
      <tr><td>2</td><td>Vấn đề khách</td><td>6–14s</td></tr>
      <tr><td>3</td><td>Giải pháp PTT</td><td>14–24s</td></tr>
      <tr><td>4</td><td>Social proof</td><td>24–32s</td></tr>
      <tr><td>5</td><td>Offer</td><td>32–40s</td></tr>
      <tr><td>6</td><td>CTA đặt lịch</td><td>40–45s</td></tr>
    </tbody></table></div>
    <p>Khi line DV12 accepted → optional spawn <code>/crm/video</code> hoặc CP project, gắn template này. File mockup brand-video cũ = nguồn visual, không SoT IA.</p>
  </div>
</div>
"""

BODIES["apr-01"] = f"""
{crumb("Phê duyệt")}
{head("Hộp thư phê duyệt", "APR-01 · queue theo bước user được route · scope Của tôi / Team", '<button class="btn" type="button" onclick="show(&quot;set-05&quot;)">Policy</button>')}
<div class="filters"><button class="chip is-on">Chờ tôi (2)</button><button class="chip">Đã xử lý</button><button class="chip">SLA vỡ</button></div>
<div class="tbl-wrap"><table><thead><tr><th>Quote</th><th>Trigger</th><th>Bước</th><th>SLA</th><th>Owner</th><th></th></tr></thead><tbody>
<tr><td><button class="linkish" type="button" onclick="show('apr-02')">QT-PTT-2026-000089 v2</button><br><span class="muted">An Phát · 265.647.600 ₫</span></td><td><span class="pill s-warn">MARGIN_FLOOR</span></td><td>Finance</td><td class="dn">+6h</td><td>Lan</td><td><button class="btn-primary btn" type="button" onclick="show('apr-02')">Mở</button></td></tr>
<tr><td>QT-PTT-2026-000110 v1</td><td><span class="pill s-warn">DISCOUNT_12</span></td><td>AD + Finance</td><td>còn 8h</td><td>Kiều</td><td><button class="btn" type="button">Mở</button></td></tr>
</tbody></table></div>
"""

BODIES["apr-02"] = f"""
{crumb("Phê duyệt / QT-PTT-2026-000089")}
{head("Duyệt v2 · An Phát", "APR-02 · step · policy · diff · snapshot NSR · comment bắt buộc khi return", '<button class="btn" type="button">Trả lại</button><button class="btn-primary btn" type="button">Phê duyệt</button>')}
<div class="grid2">
  <div>
    <div class="card">
      <div class="apr-item"><span class="apr-ico done">✓</span><div><h3>Sales Manager</h3><p class="muted">Auto — discount 5% · không vượt cap</p></div><span class="pill s-ok">xong</span></div>
      <div class="apr-item"><span class="apr-ico wait">2</span><div><h3>Finance Controller</h3><p class="muted">GM &lt; 25% + thiếu cost DV12</p></div><span class="pill s-warn">chờ</span></div>
      <div class="apr-item"><span class="apr-ico lock">3</span><div><h3>GDKD / Commercial</h3><p class="muted">Khóa đến khi Finance xong</p></div><span class="pill">khóa</span></div>
    </div>
    <div class="card"><b>Diff v1 → v2</b>
      <div class="diff"><b>Meta fee</b> 42tr → 48tr</div>
      <div class="diff"><b>Discount</b> 3% → 5%</div>
      <div class="diff"><b>Payment</b> 60/40 → 50/30/20</div>
    </div>
    <div class="card form"><label>Comment (bắt buộc nếu trả/từ chối)<textarea class="inp" placeholder="Lý do"></textarea></label>
      <label><input type="checkbox"/> Ủy quyền (delegate) — lưu actor gốc + hạn + lý do</label>
    </div>
  </div>
  <div>
    <div class="card"><b>Policy kích hoạt</b>
      <p><span class="pill s-warn">MARGIN_FLOOR</span> 22,4% &lt; 25%</p>
      <p><span class="pill s-warn">COST_MISSING</span> DV12</p>
      <p><span class="pill s-ok">PAYMENT_OK</span> 50/30/20 = 100%</p>
      <p><span class="pill s-ok">VALUE_OK</span> &lt; 200tr</p>
    </div>
    <div class="card"><b>Commercial snapshot</b>
      <div class="side-row"><span>NSR</span><b>126.000.000</b></div>
      <div class="side-row"><span>Direct cost</span><b>97.776.000</b></div>
      <div class="side-row"><span>GP</span><b>28.224.000</b></div>
      <div class="side-row"><span>GM</span><b class="dn">22,4%</b></div>
    </div>
  </div>
</div>
"""

BODIES["prs-01"] = f"""
{crumb("Proposal Studio / QT-PTT-2026-000089")}
{head("Proposal Studio", "PRS-01 · 9 section · gate 08+09 trước publish · cấm cost/margin", '''<button class="btn" type="button" onclick="show('pub-01')">Xem trước khách</button><button class="btn-primary btn" type="button">Xuất bản &amp; chia sẻ</button>''')}
<div class="studio">
  <div class="card">
    <button class="tab is-on" type="button" onclick="subtab(this,'s01')">01 Cover &amp; thương hiệu</button>
    <button class="tab" type="button" onclick="subtab(this,'s02')">02 Bối cảnh &amp; mục tiêu</button>
    <button class="tab" type="button" onclick="subtab(this,'s03')">03 Chiến lược</button>
    <button class="tab" type="button" onclick="subtab(this,'s04')">04 Phạm vi</button>
    <button class="tab" type="button" onclick="subtab(this,'s05')">05 KPI &amp; hiệu quả</button>
    <button class="tab" type="button" onclick="subtab(this,'s06')">06 Timeline</button>
    <button class="tab" type="button" onclick="subtab(this,'s07')">07 Đầu tư</button>
    <button class="tab" type="button" onclick="subtab(this,'s08')">08 Điều khoản *</button>
    <button class="tab" type="button" onclick="subtab(this,'s09')">09 Xác nhận *</button>
  </div>
  <div>
    <div class="subpage is-on" id="s01"><div class="cover"><small>PTT HCM × AN PHÁT</small><h2>Growth Proposal<br>Q4/2026</h2><p>QT-PTT-2026-000089 · hiệu lực đến 07/10/2026</p></div></div>
    <div class="subpage" id="s02"><div class="card"><h3>Mục tiêu</h3><p>Lead chất lượng căn hộ cao cấp — merge từ BLD-01.</p></div></div>
    <div class="subpage" id="s03"><div class="card"><p>≥1 trụ cột: Content always-on · Performance Meta · LP CRO.</p></div></div>
    <div class="subpage" id="s04"><div class="card"><p>Line client_visible option A. Deliverable từ snapshot catalog.</p></div></div>
    <div class="subpage" id="s05"><div class="card"><p>Nhãn 3 lớp + disclaimer forecast. Cấm chữ “cam kết doanh số”.</p></div></div>
    <div class="subpage" id="s06"><div class="card"><p>≥1 milestone: Kickoff 01/10 · Review T2 · Closing 31/12.</p></div></div>
    <div class="subpage" id="s07"><div class="card"><div class="price-row"><span>Phí</span><b>132.600.000</b></div><div class="price-row"><span>Media</span><b>120.000.000</b></div><div class="price-row"><span>VAT 8%</span><b>19.677.600</b></div></div></div>
    <div class="subpage" id="s08"><div class="card"><p>Bật clause snapshot. Gate publish nếu tắt.</p></div></div>
    <div class="subpage" id="s09"><div class="card"><p>CTA <b>Xác nhận đề xuất</b> + checkbox copy. OTP flag từ SET-04.</p></div></div>
  </div>
  <div>
    <div class="card"><b>Điều khiển</b>
      <p><label><input type="checkbox" checked/> Logo khách</label></p>
      <p><label><input type="checkbox" checked/> KPI + assumption</label></p>
      <p><label><input type="checkbox" checked/> Phương án A recommended</label></p>
      <p><label><input type="checkbox" checked/> Tải PDF</label></p>
      <p><label><input type="checkbox" checked/> OTP khi xác nhận</label></p>
    </div>
    <div class="card"><b>Publish</b><p class="muted">Chỉ version <code>approved</code> còn hạn. Token gắn cứng v2. Revoke = PUB-03.</p></div>
  </div>
</div>
"""

BODIES["pub-01"] = f"""
{crumb("Portal khách")}
{head("Trang đề xuất (khách)", "PUB-01 · portal-web / token · không cost/margin/approval/option ẩn", '<span class="muted">PTT Ads · QT-PTT-2026-000089 · v2 · đến 07/10/2026</span>')}
<div class="hero-pub"><small>ĐỀ XUẤT MARKETING TÍCH HỢP</small><h1>Growth Proposal Q4/2026</h1><p>Dành cho Công ty Cổ phần An Phát · phát hành 08/09/2026 · PTT HCM</p></div>
<div class="grid2">
  <div>
    <div class="card"><h3>Mục tiêu hợp tác</h3><p>Hệ thống tạo lead căn hộ cao cấp: content, Meta Ads, Reels, landing page.</p></div>
    <div class="card"><h3>Phạm vi</h3><ul><li>24 bài + 12 Reels / tháng</li><li>3 campaign set Meta · A/B creative</li><li>1 landing page CRO</li><li>Báo cáo tuần</li></ul></div>
    <div class="card"><h3>Chỉ số — đã gắn nhãn</h3>
      <div class="tiles"><div class="tile"><span>Lead dự kiến</span><strong>1.000–1.200</strong><em>forecast</em></div><div class="tile"><span>CPL mục tiêu</span><strong>≤100K</strong><em>optimization</em></div><div class="tile"><span>Bài / Reels</span><strong>36</strong><em>cam kết bàn giao</em></div></div>
      <p class="muted">Forecast phụ thuộc media, tệp, creative, LP và tốc độ xử lý lead.</p>
    </div>
  </div>
  <div>
    <div class="card"><h3>Tóm tắt đầu tư</h3>
      <div class="price-row"><span>Phí dịch vụ</span><b>132.600.000 ₫</b></div>
      <div class="price-row"><span>Ngân sách media</span><b>120.000.000 ₫</b></div>
      <div class="price-row"><span>Chiết khấu</span><b>−6.630.000 ₫</b></div>
      <div class="price-row"><span>VAT 8%</span><b>19.677.600 ₫</b></div>
      <div class="total-row"><span>Tổng</span><b>265.647.600 ₫</b></div>
    </div>
    <div class="card"><h3>Thanh toán</h3>
      <p>50% xác nhận · 30% giữa kỳ · 20% nghiệm thu</p>
      <button class="accept" type="button" onclick="show('pub-02')">✓ Xác nhận đề xuất</button>
      <p style="text-align:center"><button class="linkish" type="button">Yêu cầu điều chỉnh</button></p>
      <p class="muted">Không phải hợp đồng pháp lý. Hợp đồng / PO đi SoR pháp chế sau convert.</p>
    </div>
  </div>
</div>
{NOTE}
"""

BODIES["pub-02"] = f"""
{crumb("Portal / xác nhận")}
{head("Xác nhận đề xuất", "PUB-02 · checkbox điều khoản + OTP email · ghi name/title/email/time/IP/UA/option/version", '<button class="btn" type="button" onclick="show(&quot;pub-01&quot;)">Quay lại</button>')}
<div class="modal-demo">
  <div class="form">
    <label>Phương án xác nhận<select class="inp"><option>A · Growth Launch · 265.647.600 ₫</option><option>B · Essential</option></select></label>
    <label>Họ tên người xác nhận *<input class="inp" value="Nguyễn Minh Anh"/></label>
    <label>Chức danh *<input class="inp" value="Marketing Director"/></label>
    <label>Email nhận OTP *<input class="inp" value="minhanh@anphat.vn"/></label>
    <label><input type="checkbox"/> Tôi đã đọc điều khoản phiên bản v2 và xác nhận đề xuất thương mại này (không phải ký HĐ).</label>
    <label>Mã OTP *<input class="inp" placeholder="6 số · gửi email"/></label>
    <button class="btn-primary btn" type="button" onclick="show('cvt-01')">Xác nhận</button>
  </div>
  <p class="muted">Hết hạn token / revoked → PUB-03, không accept. Một option lock; option khác giữ audit.</p>
</div>
"""

BODIES["pub-03"] = f"""
{crumb("Portal / hết hạn")}
{head("Liên kết không còn hiệu lực", "PUB-03 · expired / revoked · không lộ body proposal", "")}
<div class="card" style="max-width:520px">
  <h2>Đề xuất đã hết hạn hoặc được thu hồi</h2>
  <p>Mã <code>QT-PTT-2026-000089</code> · liên hệ AM Minh để nhận phiên bản mới.</p>
  <p class="muted">Không render section giá / KPI / file. Token gắn một version — không tái sử dụng.</p>
</div>
"""

BODIES["cvt-01"] = f"""
{crumb("Convert")}
{head("Convert sau xác nhận", "CVT-01 · idempotent (version_id, target_type) · N lifecycle + 1 schedule + invoice draft", '<button class="btn-primary btn" type="button">Chạy convert</button>')}
<div class="alert"><span>QT-PTT-2026-000089 v2 · option A accepted 08/09 10:02 · OTP ok. Convert lần 2 không nhân bản.</span></div>
<div class="grid2">
  <div class="card"><b>Sẽ tạo</b>
    <div class="side-row"><span>service_lifecycle ×3</span><b>DV08 · DV05 · DV12</b></div>
    <div class="side-row"><span>Payment schedule</span><b>50/30/20 → invoices draft</b></div>
    <div class="side-row"><span>Content OS</span><b>deep-link tab content-os (DV05)</b></div>
    <div class="side-row"><span>Video SOP / CP</span><b>optional DV12 · VID-TPL-01</b></div>
    <p class="muted">Không tạo campaign bảng 2. Không clone CSD ticket. Owner = AM + delivery lead catalog.</p>
  </div>
  <div class="card"><b>Kết quả (đã chạy)</b>
    <p>LC-ANPHAT-Q4-META · <button class="linkish" type="button">mở lifecycle</button></p>
    <p>LC-ANPHAT-Q4-SOC</p>
    <p>LC-ANPHAT-Q4-VID · gắn template 6 scene</p>
    <p>INV draft · 3 đợt · tổng 265.647.600 ₫</p>
    <p><code>crm_quote_conversions</code> unique cvt_2a</p>
  </div>
</div>
"""

BODIES["rpt-01"] = f"""
{crumb("Báo cáo")}
{head("Báo cáo điều hành", "RPT-01 · kỳ + scope · doanh thu agency không cộng media", '''<select class="scope"><option>Tháng 09/2026</option></select><select class="scope"><option>Toàn PTT</option></select><button class="btn" type="button">Xuất XLSX</button>''')}
<div class="tiles">
  <div class="tile"><span>Quote đã gửi</span><strong>31</strong><em>3,80 tỷ ₫ payable</em></div>
  <div class="tile"><span>Được xem</span><strong>24</strong><em class="up">77,4% sent-to-viewed</em></div>
  <div class="tile"><span>Đã xác nhận</span><strong>9</strong><em class="up">29,0% sent-to-accepted</em></div>
  <div class="tile"><span>Avg. approval</span><strong>13,6h</strong><em class="dn">mục tiêu &lt;12h</em></div>
</div>
<div class="card"><div class="card-h"><b>Giá trị gửi theo tuần</b></div>
  <div class="bars"><i style="height:42%"></i><i style="height:66%"></i><i style="height:51%"></i><i style="height:88%"></i></div>
</div>
<p class="muted">Win rate dashboard = accepted/(accepted+rejected). Báo cáo này ghi sent-to-accepted riêng. Export = view_audit.</p>
{NOTE}
"""

BODIES["rpt-02"] = f"""
{crumb("Báo cáo / Funnel")}
{head("Funnel chuyển đổi", "RPT-02 · mẫu số ghi trên từng bậc", '<button class="btn" type="button" onclick="show(&quot;rpt-01&quot;)">Điều hành</button>')}
<div class="card">
  <div class="side-row"><span>Draft</span><b>62 · 100%</b></div><div class="track"><b></b><i style="width:100%"></i></div>
  <div class="side-row"><span>Sent</span><b>31 · 50% draft</b></div><div class="track"><b></b><i style="width:50%"></i></div>
  <div class="side-row"><span>Viewed</span><b>24 · 77% sent</b></div><div class="track"><b></b><i style="width:39%"></i></div>
  <div class="side-row"><span>Accepted</span><b>9 · 29% sent</b></div><div class="track"><b></b><i style="width:15%;background:var(--ok)"></i></div>
</div>
<p class="muted">Không gộp rejected vào mẫu số viewed. Kỳ filter + scope Của tôi/Team/Toàn PTT.</p>
"""

BODIES["rpt-03"] = f"""
{crumb("Báo cáo / Margin")}
{head("Margin theo nhóm dịch vụ", "RPT-03 · finance only · NSR fee-only", "")}
<div class="tbl-wrap"><table><thead><tr><th>Nhóm</th><th>NSR</th><th>Direct cost</th><th>GM</th></tr></thead><tbody>
<tr><td>Strategy</td><td>420tr</td><td>243tr</td><td class="up">42,2%</td></tr>
<tr><td>Social &amp; Content</td><td>1,12 tỷ</td><td>764tr</td><td class="up">31,8%</td></tr>
<tr><td>Performance</td><td>890tr</td><td>670tr</td><td class="dn">24,7%</td></tr>
<tr><td>Production</td><td>610tr</td><td>475tr</td><td class="dn">22,1%</td></tr>
</tbody></table></div>
<p class="muted">Media pass-through loại khỏi NSR. 403 nếu thiếu finance.</p>
"""

BODIES["rpt-04"] = f"""
{crumb("Báo cáo / Lost")}
{head("Lý do thua quote", "RPT-04 · rejected + lost reason bắt buộc", "")}
<div class="card">
  <div class="side-row"><span>Ngân sách không phù hợp</span><b>37%</b></div>
  <div class="side-row"><span>Chọn đối thủ</span><b>25%</b></div>
  <div class="side-row"><span>Đổi ưu tiên nội bộ</span><b>21%</b></div>
  <div class="side-row"><span>Scope / timeline</span><b>17%</b></div>
</div>
<p class="muted">Status rejected yêu cầu lost_reason enum. Không để trống.</p>
"""

BODIES["rpt-05"] = f"""
{crumb("Báo cáo / Engagement")}
{head("Tương tác proposal", "RPT-05 · first/last view · section · privacy notice", "")}
<div class="tbl-wrap"><table><thead><tr><th>Quote</th><th>First view</th><th>Last</th><th>Section sâu</th><th>Comment</th></tr></thead><tbody>
<tr><td>QT-PTT-2026-000089</td><td>08/09 08:41</td><td>08/09 09:02</td><td>Đầu tư</td><td>0</td></tr>
<tr><td>QT-PTT-2026-000102</td><td>07/09 14:10</td><td>08/09 11:00</td><td>KPI</td><td>2</td></tr>
</tbody></table></div>
<p class="muted">Tracking có notice trên PUB-01. Không heatmap pixel bên thứ ba W1.</p>
"""

BODIES["set-01"] = f"""
{crumb("Cấu hình")}
{head("Mặc định thương mại", "SET-01 · tenant PTT · một legal entity PTT HCM", '<button class="btn-primary btn" type="button">Lưu</button>')}
<div class="grid2">
  <div class="card form">
    <label>Format mã<input class="inp" value="QT-PTT-{{YYYY}}-{{SEQ:6}}" readonly/></label>
    <label>Hiệu lực mặc định (ngày)<input class="inp" value="30"/></label>
    <label>VAT %<input class="inp" value="8"/></label>
    <label>Tiền tệ<input class="inp" value="VND" readonly/></label>
    <label>Payment template<select class="inp"><option>50 / 30 / 20</option><option>40 / 40 / 20</option></select></label>
  </div>
  <div class="card"><b>Khóa W1</b><p>Không multi-currency. Không multi-brand render. Timezone <code>Asia/Ho_Chi_Minh</code>.</p></div>
</div>
"""

BODIES["set-02"] = f"""
{crumb("Cấu hình / Guardrail")}
{head("Guardrail giá &amp; margin", "SET-02 · policy engine APR", '<button class="btn-primary btn" type="button">Lưu</button>')}
<div class="tbl-wrap"><table><thead><tr><th>Điều kiện</th><th>Approver</th></tr></thead><tbody>
<tr><td>Discount ≤5% và GM ≥25%</td><td>Auto / Sales Manager</td></tr>
<tr><td>Discount 5–10%</td><td>AM Lead / AD</td></tr>
<tr><td>Discount &gt;10%</td><td>AD + Finance</td></tr>
<tr><td>GM &lt; 25%</td><td>Finance + GDKD</td></tr>
<tr><td>Tổng &gt; 200.000.000 ₫</td><td>GDKD</td></tr>
<tr><td>Payment term &gt; 60 ngày</td><td>Finance</td></tr>
<tr><td>Clause lệch template</td><td>Legal</td></tr>
<tr><td>Custom / zero-price / thiếu cost</td><td>Finance</td></tr>
</tbody></table></div>
<p class="muted">Không bypass bằng dòng ảo (BR-QT-006). Floor mặc định 25%.</p>
"""

BODIES["set-03"] = f"""
{crumb("Cấu hình / Rate")}
{head("Quản trị rate card", "SET-03 · deep-link CAT-04 · Active/Retired", '<button class="btn" type="button" onclick="show(&quot;cat-04&quot;)">Mở CAT-04</button>')}
<div class="card"><p>Card theo legal entity PTT HCM. Import W3. Đổi card = revision catalog, không rewrite quote cũ.</p></div>
"""

BODIES["set-04"] = f"""
{crumb("Cấu hình / Chia sẻ")}
{head("Chia sẻ & OTP", "SET-04 · token entropy · expiry · PDF · OTP · view tracking", '<button class="btn-primary btn" type="button">Lưu</button>')}
<div class="card form">
  <label>Hết hạn link mặc định (ngày)<input class="inp" value="14"/></label>
  <label><input type="checkbox" checked/> Cho phép tải PDF</label>
  <label><input type="checkbox" checked/> OTP email khi xác nhận</label>
  <label><input type="checkbox" checked/> Ghi first/last view + section (có notice PUB-01)</label>
  <p class="muted">W1 = checkbox + OTP. E-sign provider = W3. Revoke tức thì → PUB-03.</p>
</div>
"""

BODIES["set-05"] = f"""
{crumb("Cấu hình / Approver")}
{head("Ma trận approver", "SET-05 · map job function PTT · không INSERT staff_section_permissions", '<button class="btn-primary btn" type="button">Lưu</button>')}
<div class="tbl-wrap"><table><thead><tr><th>Bước</th><th>Cap</th><th>Người / hàng</th></tr></thead><tbody>
<tr><td>Sales Manager</td><td>crm_quote.approve</td><td>AM Lead team</td></tr>
<tr><td>Finance</td><td>crm_quote.finance</td><td>Controller Lan</td></tr>
<tr><td>GDKD</td><td>crm_quote.approve</td><td>Commercial Director</td></tr>
<tr><td>Legal</td><td>crm_quote.legal</td><td>Legal desk</td></tr>
</tbody></table></div>
<p class="muted">Grant qua Admin RBAC catalog-only. Delegate lưu actor gốc + hạn + lý do.</p>
"""

BODIES["set-06"] = f"""
{crumb("Cấu hình / Template")}
{head("Template điều khoản & Studio", "SET-06 · clause snapshot lúc publish", '<button class="btn-primary btn" type="button">Lưu</button>')}
<div class="grid2">
  <div class="card"><h3>Clause PTT HCM chuẩn</h3><p>Thanh toán · IP nội dung · giới hạn trách nhiệm · bảo mật. Lệch → Legal.</p></div>
  <div class="card"><h3>Studio cover</h3><p>Logo PTT navy · merge quote_code · valid_until. Cấm kéo field finance.</p></div>
</div>
<p class="muted">SSO / MFA = platform Admin — không nằm QT.</p>
"""

assert set(BODIES) == {s[0] for s in SCREENS}, set(BODIES) ^ {s[0] for s in SCREENS}

NAV_BTNS = """
<div class="grp">KINH DOANH</div>
<button class="nav-btn is-on" type="button" data-page="ovr-01" onclick="show('ovr-01')">Tổng quan</button>
<button class="nav-btn" type="button" data-page="lst-01" onclick="show('lst-01')">Báo giá</button>
<button class="nav-btn" type="button" data-page="new-01" onclick="show('new-01')">Tạo báo giá</button>
<button class="nav-btn" type="button" data-page="cat-01" onclick="show('cat-01')">Service Catalog</button>
<div class="grp">KIỂM SOÁT</div>
<button class="nav-btn" type="button" data-page="apr-01" onclick="show('apr-01')">Phê duyệt</button>
<button class="nav-btn" type="button" data-page="rpt-01" onclick="show('rpt-01')">Báo cáo</button>
<div class="grp">QUẢN TRỊ</div>
<button class="nav-btn" type="button" data-page="set-01" onclick="show('set-01')">Cấu hình</button>
"""

SCRIPT = """
function show(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('is-on'));
  const el=document.getElementById(id);
  if(el) el.classList.add('is-on');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('is-on', b.dataset.page===id || (NAV_MAP[id]&&b.dataset.page===NAV_MAP[id])));
  document.querySelectorAll('.sc').forEach(b=>b.classList.toggle('is-on', b.dataset.page===id));
  const j=document.getElementById('demo-jump'); if(j) j.value=id;
  document.querySelectorAll('.page .tab').forEach(()=>{});
  const tabs={
    'bld-01':0,'bld-02':1,'bld-03':2,'bld-04':3,'bld-05':4,'bld-06':5,'bld-07':6,'prs-01':7
  };
  if(el){
    const bar=el.querySelector('.tabs');
    if(bar && tabs[id]!==undefined){
      bar.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('is-on', i===tabs[id]));
    }
  }
}
function subtab(btn,id){
  const root=btn.closest('.page');
  root.querySelectorAll('.tab').forEach(t=>t.classList.remove('is-on'));
  btn.classList.add('is-on');
  root.querySelectorAll('.subpage').forEach(p=>p.classList.toggle('is-on', p.id===id));
}
const NAV_MAP = """ + json.dumps(NAV_MAP) + """;
document.addEventListener('DOMContentLoaded',()=>{
  const q=new URLSearchParams(location.search).get('s');
  if(q) show(q);
});
"""


def wrap(title: str, pages: list[str], default_on: str, chips_extra: str = "") -> str:
    sections = []
    for sid, nav_title, page_title in SCREENS:
        if sid not in pages:
            continue
        on = " is-on" if sid == default_on else ""
        sections.append(
            f'<section class="page{on}" id="{sid}" data-title="{page_title}">{BODIES[sid]}</section>'
        )
    jump = "".join(
        f'<option value="{sid}">{sid.upper()} {pt}</option>'
        for sid, _, pt in SCREENS
        if sid in pages
    )
    chips = "".join(
        f'<button class="sc{" is-on" if sid==default_on else ""}" type="button" data-page="{sid}" onclick="show(\'{sid}\')">{sid.upper()}</button>'
        for sid, _, _ in SCREENS
        if sid in pages
    )
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="rnosai-quote-os-mockup.css"/>
</head>
<body>
<div class="app" id="app">
  <header class="topbar">
    <button class="icon-btn" type="button" onclick="document.getElementById('app').classList.toggle('collapsed')">☰</button>
    <span class="logo">RNOSAI <span style="font-weight:500;color:var(--mute);font-size:12px">PTT · Quotation OS</span></span>
    <button class="search-btn" type="button"><span>Tìm QT-PTT, khách AM 360, lead…</span><span class="kbd">⌘K</span></button>
    <div class="top-right">
      <span class="fresh">Đồng bộ 09:18 · last_updated ISO</span>
      <button class="icon-btn" type="button" onclick="document.getElementById('notify').classList.toggle('is-on')">🔔<i class="dot"></i></button>
      <span class="ava" title="AM Minh">AM</span>
    </div>
    <div class="notify" id="notify">
      <div class="card-h"><b>Thông báo</b></div>
      <p>QT-PTT-2026-000071 Finance SLA +6h</p>
      <p>An Phát xem proposal v2</p>
      <p>GM 22,4% dưới floor — sample</p>
    </div>
  </header>
  <div class="catalog">
    <b>Kinh doanh</b>
    <select class="scope"><option>Vai trò: AM — Minh</option><option>Finance — Lan</option><option>GDKD</option><option>Legal</option></select>
    <select class="scope"><option>Phạm vi: Của tôi</option><option>Team</option><option>Toàn PTT</option></select>
    <div class="ops">
      <label class="fresh" for="demo-jump">Nhảy màn</label>
      <select class="scope" id="demo-jump" onchange="show(this.value)">{jump}</select>
      <details class="demo-more"><summary>Toàn catalog</summary>{chips}{chips_extra}</details>
    </div>
  </div>
  <div class="shell">
    <aside class="sidebar">
      <div class="nav">{NAV_BTNS}</div>
      <div class="sb-foot">Chờ phê duyệt<br><b>2 quote</b>1 vượt SLA 24h · sample</div>
    </aside>
    <main class="main">{"".join(sections)}</main>
  </div>
</div>
<script>{SCRIPT}</script>
</body>
</html>
"""


def main() -> None:
    all_ids = [s[0] for s in SCREENS]
    master_chips = "".join(
        f'<button class="sc{" is-on" if sid=="ovr-01" else ""}" type="button" data-page="{sid}" onclick="show(\'{sid}\')">{sid.upper()} {pt.split(" · ")[0]}</button>'
        for sid, _, pt in SCREENS
    )
    (OUT / "rnosai-quote-os-srs-mockup.html").write_text(
        wrap(
            "RNOSAI · Quotation OS — mockup vận hành enterprise",
            all_ids,
            "ovr-01",
            "",
        ).replace(
            "".join(
                f'<button class="sc{" is-on" if sid=="ovr-01" else ""}" type="button" data-page="{sid}" onclick="show(\'{sid}\')">{sid.upper()}</button>'
                for sid, _, _ in SCREENS
            ),
            master_chips,
        ),
        encoding="utf-8",
    )
    modules = [
        ("rnosai-quote-os-overview-mockup.html", "RNOSAI · QT OS · Tổng quan", ["ovr-01", "ovr-02", "ovr-03"], "ovr-01"),
        ("rnosai-quote-os-list-mockup.html", "RNOSAI · QT OS · Danh sách & tạo", ["lst-01", "new-01"], "lst-01"),
        (
            "rnosai-quote-os-builder-mockup.html",
            "RNOSAI · QT OS · Builder",
            ["bld-01", "bld-02", "bld-03", "bld-04", "bld-05", "bld-06", "bld-07"],
            "bld-01",
        ),
        (
            "rnosai-quote-os-catalog-mockup.html",
            "RNOSAI · QT OS · Catalog",
            ["cat-01", "cat-02", "cat-03", "cat-04", "cat-05"],
            "cat-01",
        ),
        ("rnosai-quote-os-approval-mockup.html", "RNOSAI · QT OS · Phê duyệt", ["apr-01", "apr-02"], "apr-01"),
        ("rnosai-quote-os-studio-mockup.html", "RNOSAI · QT OS · Proposal Studio", ["prs-01"], "prs-01"),
        (
            "rnosai-quote-os-public-mockup.html",
            "RNOSAI · QT OS · Portal & convert",
            ["pub-01", "pub-02", "pub-03", "cvt-01"],
            "pub-01",
        ),
        (
            "rnosai-quote-os-reports-mockup.html",
            "RNOSAI · QT OS · Báo cáo & cấu hình",
            ["rpt-01", "rpt-02", "rpt-03", "rpt-04", "rpt-05", "set-01", "set-02", "set-03", "set-04", "set-05", "set-06"],
            "rpt-01",
        ),
    ]
    for name, title, ids, default in modules:
        (OUT / name).write_text(wrap(title, ids, default), encoding="utf-8")
    print("wrote", 1 + len(modules), "html files")


if __name__ == "__main__":
    main()
