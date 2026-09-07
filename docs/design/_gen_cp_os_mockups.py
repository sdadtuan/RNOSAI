#!/usr/bin/env python3
"""Generate RNOSAI Creative Production OS enterprise mockups (SoT UI)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

NAV = [
    ("ovr-01", "Tổng quan", "overview"),
    ("prj-01", "Dự án", "projects"),
    ("vid-01", "Video AI", "video"),
    ("med-01", "Thư viện", "media"),
    ("brk-01", "Brand Kit", "brand"),
    ("cal-01", "Lịch xuất bản", "calendar"),
    ("rpt-01", "Báo cáo", "reports"),
    ("set-01", "Cấu hình", "settings"),
]

SCREENS = [
    ("ovr-01", "OVR-01 Dashboard"),
    ("ovr-02", "OVR-02 Action Center"),
    ("ovr-03", "OVR-03 Production Monitor"),
    ("ovr-04", "OVR-04 Activity"),
    ("prj-01", "PRJ-01 Portfolio"),
    ("prj-02", "PRJ-02 Tạo project"),
    ("prj-03", "PRJ-03 Workspace"),
    ("prj-04", "PRJ-04 Timeline"),
    ("vid-01", "VID-01 Studio"),
    ("vid-02", "VID-02 Storyboard"),
    ("vid-03", "VID-03 Timeline"),
    ("vid-04", "VID-04 Render Ops"),
    ("vid-05", "VID-05 Review"),
    ("vid-06", "VID-06 Batch"),
    ("vid-07", "VID-07 Template"),
    ("vid-08", "VID-08 Version"),
    ("med-01", "MED-01 Library"),
    ("med-02", "MED-02 Asset"),
    ("med-03", "MED-03 Ingest"),
    ("med-04", "MED-04 Collections"),
    ("med-05", "MED-05 Rights"),
    ("med-06", "MED-06 Quality"),
    ("brk-01", "BRK-01 Portfolio"),
    ("brk-02", "BRK-02 Editor"),
    ("brk-03", "BRK-03 Rules"),
    ("brk-04", "BRK-04 Preview Lab"),
    ("brk-05", "BRK-05 History"),
    ("cal-01", "CAL-01 Calendar"),
    ("cal-02", "CAL-02 Composer"),
    ("cal-03", "CAL-03 Gate"),
    ("cal-04", "CAL-04 Monitor"),
    ("cal-05", "CAL-05 Bulk"),
    ("rpt-01", "RPT-01 Executive"),
    ("rpt-02", "RPT-02 Production"),
    ("rpt-03", "RPT-03 Credit"),
    ("rpt-04", "RPT-04 Performance"),
    ("rpt-05", "RPT-05 Governance"),
    ("set-01", "SET-01 Profile"),
    ("set-02", "SET-02 Members"),
    ("set-03", "SET-03 SSO (Admin)"),
    ("set-04", "SET-04 Credit"),
    ("set-05", "SET-05 Models"),
    ("set-06", "SET-06 Integrations"),
    ("set-07", "SET-07 Security"),
    ("set-08", "SET-08 Policy"),
]


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def btn(sid, label, cls="btn"):
    return '<button class="%s" type="button" onclick="show(%r)">%s</button>' % (cls, sid, label)


def kpi(label, value, delta, cls="up"):
    return (
        '<button class="tile" type="button" onclick="show(%r)"><span>%s</span><strong>%s</strong><em class="%s">%s</em></button>'
        % (delta[0], label, value, cls, delta[1])
    )


def table(headers, rows):
    th = "".join(f"<th>{h}</th>" for h in headers)
    trs = []
    for r in rows:
        trs.append("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>")
    return f'<div class="tbl-wrap"><table><thead><tr>{th}</tr></thead><tbody>{"".join(trs)}</tbody></table></div>'


def head(title, sub, actions=""):
    return f"""<div class="crumb">Vận hành / Sản xuất sáng tạo / {esc(title)}</div>
<div class="head"><div><h1>{esc(title)}</h1><p class="sub">{sub}</p></div><div class="actions">{actions}</div></div>"""


def tabs(active, items):
    bits = []
    for sid, label in items:
        on = " is-on" if sid == active else ""
        bits.append(btn(sid, label, "tab" + on))
    return f'<div class="tabs">{"".join(bits)}</div>'


# ---------------------------------------------------------------------------
# Screens
# ---------------------------------------------------------------------------

def ovr_01():
    tiles = "".join([
        kpi("Video đã tạo", "86", ("vid-01", "+12 kỳ này")),
        kpi("Video đã duyệt", "41", ("vid-05", "Final Approved")),
        kpi("Render thành công", "94%", ("ovr-03", "p95 6m12s"), "up"),
        kpi("Thời lượng render TB", "6m 12s", ("ovr-03", "p95 11m")),
        kpi("Credit đã dùng", "3.840", ("rpt-03", "charged + reserved")),
        kpi("Credit còn lại", "1.160", ("set-04", "hard cap 5.000")),
        kpi("Asset sắp hết quyền", "7", ("med-05", "≤14 ngày"), "dn"),
        kpi("Việc quá hạn", "4", ("prj-03", "task + AM link"), "dn"),
    ])
    h = head(
        "Tổng quan sản xuất",
        "last_updated 2026-09-07T09:18:00+07:00 · URL filter share được · sample The Peak",
        '<select class="scope"><option>30 ngày</option><option>7 ngày</option><option>Tháng này</option></select>'
        '<select class="scope"><option>Khách: Tất cả</option><option>The Peak</option></select>'
        + btn("ovr-02", "Action Center (5)"),
    )
    proj = table(
        ["Project", "Khách", "Tiến độ", "Hạn", "Credit"],
        [
            [btn("prj-03", "The Peak — Launch Q3", "linkish"), "The Peak", "62%", '<span class="pill s-warn">09/09</span>', "80%"],
            ["Bloom — Reels 9:16", "Bloom Spa", "40%", "12/09", "44%"],
            ["EduNext — Localization", "EduNext", "18%", "20/09", "22%"],
        ],
    )
    return (
        h
        + '<div class="alert"><span>3 việc critical — render fail + client review +24h + credit 80% The Peak.</span>'
        + btn("ovr-02", "Mở Action Center")
        + "</div>"
        + f'<div class="tiles">{tiles}</div>'
        + """
<div class="grid2">
  <div class="card"><div class="card-h"><b>Xu hướng 30 ngày</b><span class="muted">created / approved / published</span></div>
    <div class="bars"><i style="height:40%"></i><i style="height:55%"></i><i style="height:48%"></i><i style="height:70%"></i><i style="height:62%"></i><i style="height:80%"></i><i style="height:74%"></i></div>
    <p class="muted">86 tạo · 41 duyệt · 19 xuất bản (handoff Campaign Write)</p></div>
  <div class="card"><div class="card-h"><b>Sức khỏe sản xuất</b>"""
        + btn("ovr-03", "Monitor", "linkish")
        + """</div>
    <p>Model allowlist <span class="pill s-ok">Watch</span> · stub 4/4 · p95 6m</p>
    <p>Ingest DAM <span class="pill s-ok">OK</span> · 2 processing</p>
    <p>Provider adapter <span class="pill s-warn">Degraded</span> · 1 timeout 08:41</p>
    <p class="muted">Không cam kết SLA phút tuyệt đối — theo model.</p></div>
</div>
<div class="grid2">
  <div class="card"><div class="card-h"><b>Project đang chạy</b>"""
        + btn("prj-01", "Portfolio", "linkish")
        + "</div>"
        + proj
        + """</div>
  <div class="card"><div class="card-h"><b>Cột mốc 7 ngày</b></div>
    <div class="tl"><div class="ev"><b>09/09</b> · Client review Peak 16:9 — Creative Hub</div>
    <div class="ev"><b>10/09</b> · Batch 48 SKU hết hạn mapping</div>
    <div class="ev"><b>12/09</b> · License VO-PEAK-12 hết hạn</div></div></div>
</div>
<div class="card"><div class="card-h"><b>Hoạt động 24h</b>"""
        + btn("ovr-04", "Tất cả", "linkish")
        + """</div>
  <p>09:12 · NM · gửi Hub <code>cr_8841</code> Peak 16:9</p>
  <p>08:41 · Worker · render <code>job_4412</code> failed timeout · """
        + btn("vid-04", "trace", "linkish")
        + """</p>
  <p>08:05 · Brand · publish Brand Kit v12 Peak</p></div>
"""
    )


def ovr_02():
    return f"""
{head("Action Center", "FR-OVR-003 · severity · resource · owner · CTA · audit",
      btn("ovr-01", "Về dashboard", "btn-primary btn"))}
{table(["Sev","Việc","Impact","Owner","SLA","CTA"],[
  ['<span class="pill s-bad">Crit</span>',"Render job_4412 timeout","Mất slot batch 10:00","Creator Hân","quá","<button class=btn type=button onclick=show('vid-04')>Retry / fallback</button>"],
  ['<span class="pill s-warn">High</span>',"Client review Peak 16:9 +24h","Hạn 09/09","AM Minh","6h","<button class=btn type=button onclick=show('prj-03')>Mở Hub</button>"],
  ['<span class="pill s-warn">High</span>',"Credit The Peak 80%","Hard cap 100% block render","Finance","—","<button class=btn type=button onclick=show('rpt-03')>Budget</button>"],
  ['<span class="pill s-info">Med</span>',"License VO-PEAK-12 · 5 ngày","Block render nếu hết hạn","Legal","5d","<button class=btn type=button onclick=show('med-05')>Rights</button>"],
  ['<span class="pill s-info">Med</span>',"Publish TikTok 09:00 failed","CAL-04 retry","Producer","—","<button class=btn type=button onclick=show('cal-04')>Retry</button>"],
])}
<div class="card"><b>Escalate</b><p class="muted">Client review +24h → AM + Producer. Budget 100% → Owner. Rights 3 ngày → Legal + block render.</p></div>
"""


def ovr_03():
    return f"""
{head("Production Monitor", "OVR-03 + VID-04 · queue · provider · capacity",
      btn("vid-04", "Chi tiết job"))}
<div class="tiles">
  <div class="tile"><span>Queue depth</span><strong>7</strong></div>
  <div class="tile"><span>Concurrent slot</span><strong>3 / 5</strong></div>
  <div class="tile"><span>Provider p95 60p</span><strong>11m</strong></div>
  <div class="tile"><span>Timeout 60p</span><strong>1</strong><em class="dn">job_4412</em></div>
</div>
{table(["Job","Video","Stage","%","Provider","Prio","Action"],[
  ["job_4419","Peak 9:16 Reels","Encoding","78%","stub-a","High",'<button class=btn type=button>Cancel</button>'],
  ["job_4412","Peak 16:9 TV","Rendering","—","stub-b","Std",'<button class=btn-primary btn type=button onclick=show("vid-04")>Retry child</button>'],
  ["job_4408","Bloom VO","QC","100%","stub-a","Std","—"],
])}
<div class="card"><b>Job trace chuẩn</b>
<ol class="muted"><li>Validation + reserve credit</li><li>Moderation + rights check</li><li>Script / scene gen</li><li>TTS</li><li>Audio mix + ducking</li><li>Compositing</li><li>Encoding</li><li>QC 9 check</li><li>CDN / export signed URL</li></ol></div>
"""


def ovr_04():
    return f"""
{head("Workspace Activity", "OVR-04 · filter actor / module / action · export = view_audit",
      '<input class="inp" placeholder="Tìm actor, job, project"/><button class="btn" type="button">Export CSV</button>')}
<div class="filters"><button class="chip is-on">Tất cả</button><button class="chip">Render</button><button class="chip">Approval</button><button class="chip">Credit</button><button class="chip">Brand</button></div>
{table(["Thời điểm","Actor","Action","Resource","Snapshot"],[
  ["09:12","NM","submit_creative","Peak 16:9 → cr_8841","kit v12 · pricing 2026-09"],
  ["08:41","worker","render.failed","job_4412","attempt 1 · timeout"],
  ["08:05","Brand","kit.publish","Peak Brand Kit v12","impact 3 draft"],
  ["07:50","Hân","credit.reserve","240 cr · job_4419","idem pot_9f"],
])}
"""


def prj_01():
    return f"""
{head("Danh mục dự án", "PRJ-01 · grid/list · filter status/owner/khách/health",
      btn("prj-02", "Tạo project", "btn-primary btn"))}
<div class="filters"><button class="chip is-on">Tất cả (12)</button><button class="chip">Active</button><button class="chip">At Risk</button><button class="chip">In Review</button><button class="chip">Của tôi</button></div>
{table(["Project","Khách / lifecycle","Deliverable","Hạn","Status","Owner","Credit"],[
  [btn("prj-03", "The Peak — Launch Q3", "linkish"),"The Peak / LC-PEAK-Q3","8 / 13","09/09",'<span class="pill s-warn">At Risk</span>',"Producer Lan","80%"],
  ["Bloom — Reels 9:16","Bloom Spa / LC-BLOOM","3 / 8","12/09",'<span class="pill s-ok">Active</span>',"Hân","44%"],
  ["EduNext — Localization","EduNext / LC-EDU","1 / 6","20/09",'<span class="pill s-info">Draft</span>',"Minh","22%"],
])}
"""


def prj_02():
    return f"""
{head("Tạo project", "PRJ-02 · FR-PRJ-001 · agency_client bắt buộc",
      btn("prj-01", "Hủy") + btn("prj-03", "Tạo", "btn-primary btn"))}
<div class="grid2">
  <div class="card form">
    <label>Tên *<input class="inp" value="The Peak — Always-on Q4"/></label>
    <label>Khách (agency_client) *<select class="inp"><option>The Peak</option><option>Bloom Spa</option></select></label>
    <label>Lifecycle (tùy chọn)<select class="inp"><option>LC-PEAK-Q3 — Content retainer</option></select></label>
    <label>Ngành<input class="inp" value="Bất động sản"/></label>
    <label>Mục tiêu<textarea class="inp">12 video AI / tháng · Reels + TVC cắt</textarea></label>
  </div>
  <div class="card form">
    <label>Bắt đầu / Hạn<div class="form-2"><input class="inp" type="date" value="2026-09-01"/><input class="inp" type="date" value="2026-09-30"/></div></label>
    <label>Owner *<select class="inp"><option>Producer Lan</option></select></label>
    <label>Team (project member)<input class="inp" value="AM Minh, Creator Hân, Brand Mai"/></label>
    <label>Credit budget<input class="inp" value="2000"/> </label>
    <label>Cost center<input class="inp" value="CC-PEAK-CONTENT"/></label>
    <label>Tags<input class="inp" value="q3, always-on, ai-video"/></label>
  </div>
</div>
<p class="note">Không tạo khách ma. AM 360 là SoR. Campaign = lifecycle, không bảng campaign 2.</p>
"""


def prj_03():
    return f"""
{head("The Peak — Launch Q3", "PRJ-03 · 8 tab · status At Risk vì credit 80% + hạn 09/09",
      btn("prj-04", "Timeline") + '<button class="btn" type="button" onclick="alert(HUB_MSG)">Chia sẻ review (Hub)</button>')}
<div class="tabs">
  <button class="tab is-on" type="button" onclick="subtab(this,'p-ov')">Tổng quan</button>
  <button class="tab" type="button" onclick="subtab(this,'p-br')">Brief</button>
  <button class="tab" type="button" onclick="subtab(this,'p-de')">Deliverables</button>
  <button class="tab" type="button" onclick="subtab(this,'p-tk')">Công việc</button>
  <button class="tab" type="button" onclick="subtab(this,'p-md')">Media</button>
  <button class="tab" type="button" onclick="subtab(this,'p-ap')">Phê duyệt</button>
  <button class="tab" type="button" onclick="subtab(this,'p-bd')">Ngân sách</button>
  <button class="tab" type="button" onclick="subtab(this,'p-ac')">Hoạt động</button>
</div>
<div id="p-ov" class="subpage is-on">
  <div class="alert"><span>Credit 80% · Client review quá SLA · 2 deliverable quá hạn.</span></div>
  <div class="tiles"><div class="tile"><span>Deliverable xong</span><strong>8/13</strong></div>
    <div class="tile"><span>Video Final</span><strong>3</strong></div>
    <div class="tile"><span>Ngày còn</span><strong>2</strong></div>
    <div class="tile"><span>Credit</span><strong>1.280 / 1.600</strong></div></div>
  <div class="grid2">
    <div class="card"><b>Mục tiêu</b><p>Launch Q3 The Peak — 9:16 Reels + 16:9 TVC. CTA đăng ký căn hộ mẫu.</p>
      <p class="muted">Deep-link: AM 360 The Peak · LC-PEAK-Q3 Content OS · Video SOP không dùng.</p></div>
    <div class="card"><b>Member</b><p>Lan (producer) · Minh (AM) · Hân (creator) · Mai (brand) · Legal Q.</p></div>
  </div>
</div>
<div id="p-br" class="subpage">
  <div class="card"><div class="card-h"><b>Brief v3</b><span class="pill s-ok">Brand approved</span></div>
    <p><b>Bối cảnh.</b> The Peak mở bán tháp B. Đối thủ đang chạy Reels giá.</p>
    <p><b>Mục tiêu.</b> 12 video / tháng. Lead form landing.</p>
    <p><b>Thông điệp + CTA.</b> “Sống trên mây” · Đăng ký tour.</p>
    <p><b>Ràng buộc.</b> Không claim ROI. Disclaimer pháp lý BĐS. Logo safe-area 8%.</p>
    <p class="muted">Sửa = revision v4. Cite Planner item PLN-441.</p>
    <button class="btn" type="button">Gửi duyệt Brand</button>
  </div>
</div>
<div id="p-de" class="subpage">
  <div class="grid3">
    <div class="card"><div class="thumb">▶ 16:9</div><b>TVC cắt 30s</b><p class="muted">ai_video · Client review</p><button class="btn" type="button" onclick="show('vid-05')">Mở review</button></div>
    <div class="card"><div class="thumb">▶ 9:16</div><b>Reels hook A</b><p class="muted">ai_video · QC Warning</p><button class="btn" type="button" onclick="show('vid-01')">Studio</button></div>
    <div class="card"><div class="thumb">SOP</div><b>Walkthrough căn hộ</b><p class="muted">human_video → Video SOP</p><button class="btn" type="button">Mở /crm/video</button></div>
  </div>
  <button class="btn-primary btn" type="button" onclick="show('vid-01')">Tạo deliverable video AI</button>
</div>
<div id="p-tk" class="subpage">
  {table(["Việc","Assignee","Hạn","Prio","Status","Nguồn"],[
    ["Khóa VO Peak","Hân","08/09",'<span class="pill s-bad">Critical</span>',"Overdue","crm_cp_tasks"],
    ["Duyệt Hub 16:9","Minh","09/09","High","In progress","link Hub"],
    ["Gia hạn license VO","Legal","12/09","High","Open","link AM task"],
  ])}
  <p class="note">Không clone ticket CSD. Được gắn <code>am_task_id</code> / <code>csd_ticket_id</code>.</p>
</div>
<div id="p-md" class="subpage">
  <div class="media-grid">
    <div class="media-card"><div class="ph"></div><b>logo-peak.svg</b></div>
    <div class="media-card"><div class="ph" style="background:#f59e0b"></div><b>vo-12.wav · ⚠ 5d</b></div>
    <div class="media-card"><div class="ph"></div><b>b-roll-lobby.mp4</b></div>
  </div>
  <button class="btn" type="button" onclick="show('med-03')">Upload gán project</button>
</div>
<div id="p-ap" class="subpage">
  {table(["Bước","Rule","Actor","SLA","Status"],[
    ["Brand","kit + safe-area","Mai","4h",'<span class="pill s-ok">Approved</span>'],
    ["Client","portal Hub","The Peak","24h",'<span class="pill s-warn">+24h</span>'],
    ["Legal","has_claim / giá","Q. Legal","8h",'<span class="pill s-info">Chờ QC</span>'],
  ])}
</div>
<div id="p-bd" class="subpage">
  <div class="alert"><span>80% — cảnh báo. 100% = hard block render (policy).</span></div>
  {table(["Hạng","Budget","Charged","Reserved","Còn"],[
    ["Video production","1.000","720","80","200"],
    ["Batch factory","400","360","40","0"],
    ["TTS / voice","200","120","0","80"],
  ])}
  <button class="btn" type="button" onclick="show('rpt-03')">Xuất CSV (finance)</button>
</div>
<div id="p-ac" class="subpage">
  <div class="tl">
    <div class="ev">09:12 gửi Hub cr_8841</div>
    <div class="ev">08:05 Brand Kit v12</div>
    <div class="ev">07:50 reserve 240 cr</div>
  </div>
</div>
"""


def prj_04():
    return f"""
{head("Project Timeline", "PRJ-04 · milestone · dependency · owner",
      btn("prj-03", "Workspace"))}
{table(["Ngày","Cột mốc","Owner","Phụ thuộc","Status"],[
  ["01/09","Brief v3 lock","Lan","—",'<span class="pill s-ok">Xong</span>'],
  ["05/09","Batch mapping 48 SKU","Hân","Brief",'<span class="pill s-ok">Xong</span>'],
  ["09/09","Client review 16:9","Minh","QC pass",'<span class="pill s-warn">At risk</span>'],
  ["12/09","License VO gia hạn","Legal","—",'<span class="pill s-info">Open</span>'],
  ["15/09","Publish tuần 3","Lan","Final + CAL gate",'<span class="pill s-info">Open</span>'],
])}
<p class="note">Cảnh báo chồng hạn: 09/09 review trùng slot render batch.</p>
"""


def vid_01():
    return f"""
{head("Video Studio — Peak Reels 9:16", "VID-01 · FR-VID-001…010 · autosave 2s · estimate + pricing",
      btn("vid-02", "Storyboard") + btn("vid-04", "Tạo video (reserve)", "btn-primary btn"))}
{tabs("vid-01",[("vid-01","Studio"),("vid-02","Storyboard"),("vid-03","Timeline"),("vid-04","Ops"),("vid-05","Review"),("vid-06","Batch"),("vid-07","Template"),("vid-08","Version")])}
<div class="studio">
  <div class="card form">
    <div class="tabs"><button class="tab is-on">Prompt</button><button class="tab">Kịch bản</button><button class="tab">URL</button></div>
    <textarea class="inp" style="min-height:120px">Cinematic aerial The Peak sunset, luxury lobby, CTA đăng ký tour, không claim giá ảo.</textarea>
    <p class="muted">842 / 2.000 ký tự · moderation trước dispatch</p>
    <label><input type="checkbox" checked/> Tự tạo kịch bản (hook, scene, VO, overlay, CTA)</label>
    <button class="btn" type="button" onclick="show('med-01')">DAM picker (asset_version_id)</button>
    <div class="media-grid" style="grid-template-columns:1fr 1fr"><div class="media-card"><div class="ph"></div><b>logo v3</b></div><div class="media-card"><div class="ph"></div><b>vo-12</b></div></div>
  </div>
  <div class="card">
    <div class="thumb">Preview 9:16 · 00:12 / 00:30</div>
    <div class="grid3" style="margin-top:8px">
      <div class="media-card"><div class="ph"></div><b>1 Hook · lock</b></div>
      <div class="media-card"><div class="ph"></div><b>2 Lobby</b></div>
      <div class="media-card"><div class="ph"></div><b>3 CTA</b></div>
    </div>
    <button class="linkish" type="button" onclick="show('vid-03')">Mở timeline 4 track</button>
  </div>
  <div class="card form">
    <label>Tỉ lệ<select class="inp"><option>9:16</option><option>16:9</option><option>1:1</option><option>4:5</option></select></label>
    <label>Duration<select class="inp"><option>30s</option><option>15s</option><option>60s</option></select></label>
    <label>Style<select class="inp"><option>Cinematic luxury</option></select></label>
    <label>Locale / Voice<select class="inp"><option>vi-VN · Nữ ấm</option></select></label>
    <label>Model<select class="inp"><option>stub-pro · pricing 2026-09</option></select></label>
    <label>Brand Kit<select class="inp"><option>The Peak v12</option></select></label>
    <p><b>Ước tính 42 cr</b> · watermark draft ON</p>
    <p class="muted">Block nếu: AI tắt · asset ≠ Ready · rights · credit · moderation</p>
  </div>
</div>
{table(["Job","Trạng thái","Stage"],[["job_4419",'<span class="pill s-info">Encoding 78%</span>',"encode"],["job_4412",'<span class="pill s-bad">Failed</span>',"render"]])}
"""


def vid_02():
    return f"""
{head("Script & Storyboard", "VID-02 · FR-VID-004/005/011/012 · lock không bị regenerate",
      tabs("vid-02",[("vid-01","Studio"),("vid-02","Storyboard"),("vid-03","Timeline"),("vid-04","Ops"),("vid-05","Review")]))}
<div class="grid2">
  <div>
    <div class="card"><b>1 · Hook 0–4s</b> <span class="pill s-ok">Locked</span><p>Visual: aerial sunset. VO: “Sống trên mây.” Overlay: THE PEAK (28/42 ký tự).</p>
      <button class="btn" disabled>Regenerate (locked)</button></div>
    <div class="card"><b>2 · Lobby 4–18s</b><p>B-roll lobby. VO tiện ích. QC: logo visibility warning.</p>
      <button class="btn">Duplicate</button> <button class="btn">Split</button> <button class="btn">Regenerate scene</button></div>
    <div class="card"><b>3 · CTA 18–30s</b><p>Mandatory CTA outro + disclaimer BĐS.</p></div>
  </div>
  <div class="card"><b>Rule panel</b>
    <p>Brand Kit v12 · palette lock</p>
    <p>Asset policy: VO-PEAK-12 còn 5 ngày</p>
    <p>Approval: has_claim = false → Legal optional</p>
    <p class="muted">Reorder / merge / delete theo policy template.</p>
  </div>
</div>
"""


def vid_03():
    return f"""
{head("Timeline Editor", "VID-03 · 4 track · undo 20 · completed version immutable",
      '<button class="btn" type="button">Undo</button><button class="btn">Redo</button>')}
{tabs("vid-03",[("vid-01","Studio"),("vid-03","Timeline"),("vid-05","Review")])}
<div class="card">
  <p class="muted">Zoom · snap · trim · volume · ducking</p>
  <div class="track"><b>Scene</b><i style="width:18%"></i><i style="width:46%;background:#64748b"></i><i style="width:28%;background:#0ea5e9"></i></div>
  <div class="track"><b>VO</b><i style="width:88%;background:#7c3aed"></i></div>
  <div class="track"><b>Music</b><i style="width:100%;background:#059669;opacity:.5"></i></div>
  <div class="track"><b>Caption</b><i style="width:30%"></i><i style="width:40%;background:#d97706"></i></div>
</div>
<div class="alert"><span>Missing asset nếu revoke VO-PEAK-12 → block render (FR-VID-016).</span></div>
"""


def vid_04():
    return f"""
{head("Render Operations", "VID-04 · FR-VID-017…022 · child job · SSE 5–10s fallback",
      '<button class="btn-primary btn" type="button">Retry child job_4412</button>')}
{tabs("vid-04",[("vid-01","Studio"),("vid-04","Ops"),("ovr-03","Monitor")])}
{table(["Job","Parent","State","Prio","Idempotency","Credit"],[
  ["job_4419","—",'<span class="pill s-info">encoding</span>',"High","pot_9f","reserved 42"],
  ["job_4412","—",'<span class="pill s-bad">failed</span>',"Std","pot_8a","release pending"],
  ["job_4412b","job_4412",'<span class="pill s-info">queued</span>',"High","pot_8a_r2","reserve 42 — không double"],
])}
<div class="card"><b>job_4412 trace</b>
  <p>1 Validation+reserve ✓ · 2 Moderation+rights ✓ · 3 Scene gen ✓ · 4 TTS ✓ · 5 Mix ✓ · 6 Composite ✓ · 7 Encode ✗ timeout · 8 QC — · 9 CDN —</p>
  <p class="muted">Cancel chỉ stage cho phép. Fallback provider = child + cùng pricing snapshot.</p>
</div>
"""


def vid_05():
    qc = table(["Check","Kết quả"],[
      ["Technical res/duration/audio",'<span class="pill s-ok">Pass</span>'],
      ["Safe area 8%",'<span class="pill s-ok">Pass</span>'],
      ["Caption overflow",'<span class="pill s-warn">Warning</span>'],
      ["Logo presence",'<span class="pill s-ok">Pass</span>'],
      ["CTA bắt buộc",'<span class="pill s-ok">Pass</span>'],
      ["Disclaimer BĐS",'<span class="pill s-ok">Pass</span>'],
      ["Loudness / missing audio",'<span class="pill s-ok">Pass</span>'],
      ["Black / frozen frame",'<span class="pill s-ok">Pass</span>'],
      ["Moderation",'<span class="pill s-ok">Pass</span>'],
    ])
    return f"""
{head("Review & Approval — Peak 16:9 v3", "VID-05 · timecode · QC 9 · matrix · compare · client = Hub",
      btn("vid-08", "Version detail") + '<button class="btn-primary btn" type="button">Brand approve</button>')}
{tabs("vid-05",[("vid-01","Studio"),("vid-05","Review"),("vid-08","Version")])}
<div class="grid2">
  <div>
    <div class="thumb">Player 16:9 · 00:14 · comment @00:14</div>
    <div class="card"><b>Comments</b>
      <p>00:14 · Mai · Open · Caption sát mép — hạ 8px</p>
      <p>00:22 · Minh · Resolved · CTA đã đủ</p>
      <textarea class="inp" placeholder="Comment + mention + attachment"></textarea>
    </div>
  </div>
  <div>
    <div class="card"><b>QC · Warning (không Block)</b>{qc}</div>
    <div class="card"><b>Approval</b>
      <p>internal_review → <b>client_review (Hub cr_8841)</b> → legal → final</p>
      <p class="muted">Sửa draft sau approve → invalidate. Compare v3↔v2: script, kit, asset, cost.</p>
    </div>
  </div>
</div>
"""


def vid_06():
    return f"""
{head("Batch Video Factory", "VID-06 · FR-VID-029…033 · 4 bước · partial retry",
      '<button class="btn-primary btn" type="button">Chạy batch (estimate 1.920 cr)</button>')}
<div class="stepper"><span class="is-on">1 Template</span><span class="is-on">2 Mapping</span><span class="is-on">3 Variants</span><span>4 Review & Run</span></div>
<div class="grid2">
  <div class="card">
    <b>Template</b> <span class="pill s-ok">SKU Reels v4 published</span>
    <p>Biến: <code>{{{{project_name}}}} {{{{price_from}}}} {{{{location}}}} {{{{cta}}}} {{{{hotline}}}}</code></p>
    <p>Nguồn: CSV 48 hàng · 2 invalid (thiếu CTA)</p>
  </div>
  <div class="card">
    <b>Variant matrix</b>
    <p>Ratio 9:16 × Lang vi · en × Voice nữ × CTA A/B = <b>192 output</b> lý thuyết</p>
    <p>Lần này: 9:16 × vi × 1 voice × CTA A = <b>46 valid</b></p>
  </div>
</div>
{table(["Hàng","project_name","price_from","cta","Status"],[
  ["1","The Peak A","Từ 4,2 tỷ","Đăng ký tour",'<span class="pill s-ok">OK</span>'],
  ["2","The Peak B","—","Đăng ký",'<span class="pill s-bad">invalid price</span>'],
])}
<p class="muted">Partial success · retry theo hàng · export error CSV · reconcile ledger không double-charge.</p>
"""


def vid_07():
    return f"""
{head("Template Manager", "VID-07 · version · variables · brand lock · output profile",
      '<button class="btn-primary btn" type="button">Tạo template</button>')}
{table(["Template","Ver","Biến","Brand lock","Status","Dùng"],[
  ["SKU Reels","v4","5",'<span class="pill s-ok">Peak v12</span>',"Published","46 batch"],
  ["TVC cutdown","v2","3","Peak v12","Draft","—"],
  ["Localization EN","v1","6","PTT default","Published","0"],
])}
<p class="note">Dùng template = tạo draft. Completed version không đổi khi template sửa.</p>
"""


def vid_08():
    return f"""
{head("Video Version v3 — Peak 16:9", "VID-08 · snapshot bất biến · download signed URL + audit",
      '<button class="btn" type="button">Tải (signed 15p)</button>')}
<div class="grid2">
  <div class="card"><b>Snapshot</b>
    <p>Draft rev 11 · Brand Kit v12 · Model stub-pro · Pricing 2026-09</p>
    <p>Assets: logo v3 · vo-12 v1 · b-roll v2</p>
    <p>Prompt/script hash <code>sha256:9c…</code></p>
    <p>QC Warning · approval client_review</p>
  </div>
  <div class="card"><b>Output & cost</b>
    <p>URI <code>s3://…/v3.mp4</code> · 42 cr charged</p>
    <p>Downloads: NM 09:12 (Hub) · — runtime không hard-code URL</p>
    <p class="muted">PATCH bị 409 khi immutable=true.</p>
  </div>
</div>
"""


def med_01():
    return f"""
{head("Thư viện media", "MED-01 · grid · inspector · FR-MED-001…010",
      btn("med-03", "Upload", "btn-primary btn"))}
{tabs("med-01",[("med-01","Library"),("med-03","Ingest"),("med-04","Collections"),("med-05","Rights"),("med-06","Quality")])}
<div class="filters"><button class="chip is-on">Tất cả</button><button class="chip">Ảnh</button><button class="chip">Video</button><button class="chip">Audio</button><button class="chip">Docs</button><button class="chip">Output</button></div>
<div class="grid2">
  <div class="media-grid">
    <button class="media-card" type="button" onclick="show('med-02')"><div class="ph"></div><b>logo-peak.svg</b></button>
    <button class="media-card" type="button" onclick="show('med-02')"><div class="ph" style="background:#f59e0b"></div><b>vo-12.wav ⚠</b></button>
    <div class="media-card"><div class="ph"></div><b>b-roll-lobby.mp4</b></div>
    <div class="media-card"><div class="ph"></div><b>disclaimer.pdf</b></div>
    <div class="media-card"><div class="ph"></div><b>out-v3.mp4</b></div>
  </div>
  <div class="card"><b>Inspector — vo-12.wav</b>
    <p>Ready · audio/wav · 48kHz · 12.4s</p>
    <p>Rights: licensed · hết 12/09 · channel social</p>
    <p>Usage: 3 draft · 1 version · 0 template</p>
    <button class="btn" type="button" onclick="show('med-02')">Chi tiết</button>
  </div>
</div>
"""


def med_02():
    return f"""
{head("Asset — vo-12.wav", "MED-02 · metadata · versions · usage · rights · audit",
      '<button class="btn" type="button">Replace = version mới</button>')}
<div class="grid2">
  <div class="card"><div class="thumb">Waveform</div>
    <p>codec PCM · 2.1 MB · hash <code>ab12</code> · owner Hân · project Peak</p>
    <p>AI labels: voice, female, vi-VN (khi AI bật)</p>
  </div>
  <div class="card">
    {table(["Ver","Ngày","Ghi chú"],[["v1","01/09","Upload gốc"],["v2","—","—"]])}
    <p><b>Usage graph.</b> Peak Reels draft · Peak 16:9 v3 · — template</p>
    <p class="muted">Restore = version mới từ blob cũ. Không silent-mutate.</p>
  </div>
</div>
"""


def med_03():
    return f"""
{head("Upload & Ingestion", "MED-03 · MIME allowlist · scan → proxy → thumb → Ready",
      '<button class="btn-primary btn" type="button">Chọn file</button>')}
<div class="card form">
  <label>Gán project<select class="inp"><option>The Peak — Launch Q3</option></select></label>
  <label>Folder / tags<input class="inp" value="audio, vo, peak"/></label>
  <label>License mặc định<select class="inp"><option>Licensed — social VN — 12 tháng</option></select></label>
</div>
{table(["File","MIME","Pipeline","State"],[
  ["hero.jpg","image/jpeg","scan ✓ thumb ✓","Ready"],
  ["raw.mov","video/quicktime","transcode 44%","Processing"],
  ["unknown.exe","—","blocked MIME","Failed"],
])}
<p class="note">W1 MIME: jpeg/png/webp/mp4/mov/webm/mp3/wav/m4a/pdf. Quarantine nếu scan fail. Không Ready trước khi xong ingest.</p>
"""


def med_04():
    return f"""
{head("Collections", "MED-04 · manual + smart filter permission-aware",
      '<button class="btn-primary btn" type="button">Tạo collection</button>')}
{table(["Tên","Loại","Rule","Asset","Share"],[
  ["Peak Launch Q3","Manual","project=Peak","24","Team Peak"],
  ["Rights ≤14 ngày","Smart","expiry<=14d","7","Legal + Producer"],
  ["Ready + unused","Smart","state=ready AND usage=0","11","Của tôi"],
])}
"""


def med_05():
    return f"""
{head("Asset Rights Center", "MED-05 · FR-MED-005/006 · block generate/render/publish",
      '<button class="btn" type="button">Gia hạn</button>')}
{table(["Asset","License","Territory","Channel","Expiry","Release","Policy"],[
  ["vo-12.wav","Licensed","VN","social","12/09","talent ✓",'<span class="pill s-warn">Warn 5d</span>'],
  ["stock-city.mp4","Restricted","VN","paid ads","01/10","—",'<span class="pill s-bad">Block ads</span>'],
  ["logo-peak.svg","Owned","Global","all","—","—",'<span class="pill s-ok">OK</span>'],
])}
"""


def med_06():
    return f"""
{head("Duplicate & Quality", "MED-06 · hash + perceptual · không auto-delete",
      '<button class="btn" type="button">Quarantine tay</button>')}
<div class="tiles"><div class="tile"><span>Thiếu metadata</span><strong>9</strong></div>
  <div class="tile"><span>Duplicate candidate</span><strong>3</strong></div>
  <div class="tile"><span>Quarantined</span><strong>1</strong></div></div>
{table(["Nhóm","File","Lý do","Action"],[
  ["dup-01","lobby-a.mp4 / lobby-b.mp4","phash 0.92","Giữ một"],
  ["meta-04","img_9912.jpg","thiếu rights","Bắt bổ sung"],
  ["q-1","unknown.bin","MIME fail","Quarantine"],
])}
"""


def brk_01():
    return f"""
{head("Brand Kit Portfolio", "BRK-01 · PTT default / khách / project override",
      btn("brk-02", "Mở Peak v12", "btn-primary btn"))}
{tabs("brk-01",[("brk-01","Portfolio"),("brk-02","Editor"),("brk-03","Rules"),("brk-04","Preview"),("brk-05","History")])}
{table(["Kit","Scope","Ver","Status","Usage"],[
  [btn("brk-02", "The Peak", "linkish"),"agency_client","v12",'<span class="pill s-ok">Published</span>',"3 project"],
  ["Bloom Spa","agency_client","v4","Published","1"],
  ["PTT Default","tenant","v8","Published","fallback"],
])}
"""


def brk_02():
    return f"""
{head("Brand Kit Editor — The Peak v12", "BRK-02 · FR-BRK-001 · mọi sửa = version",
      '<button class="btn-primary btn" type="button">Lưu draft v13</button>')}
{tabs("brk-02",[("brk-01","Portfolio"),("brk-02","Editor"),("brk-03","Rules")])}
<div class="grid2">
  <div class="card"><b>Identity / Logo</b><p>Primary · Light · Mark · Icon — file DAM versioned</p>
    <b>Palette</b><p><i class="swatch" style="background:#0f2747"></i> Navy · <i class="swatch" style="background:#c9a227"></i> Gold · <i class="swatch" style="background:#fff"></i> White</p>
    <b>Typography</b><p>Be Vietnam Pro / heading weight 700</p></div>
  <div class="card"><b>Motion / Audio / Legal</b>
    <p>Intro 0.8s · outro CTA · sound logo 1.2s</p>
    <p>Caption style · watermark draft</p>
    <p>CTA: Đăng ký tour · Disclaimer BĐS bắt buộc kênh paid</p>
  </div>
</div>
"""


def brk_03():
    return f"""
{head("Brand Rule Builder", "BRK-03 · condition + action + enforcement",
      '<button class="btn-primary btn" type="button">Thêm rule</button>')}
{table(["Rule","Condition","Action","Enforcement"],[
  ["Logo safe-area","output video","logo 8% góc","Block render"],
  ["Palette lock","all","chỉ 3 màu kit","Warning QC"],
  ["CTA outro","channel social","mandatory CTA","Block publish"],
  ["Disclaimer BĐS","has_claim OR channel=paid","disclaimer 4s","Block publish"],
  ["Watermark draft","status≠final","watermark ON","Block export_final"],
])}
<p class="note">Publish rule cần Brand Lead nếu policy bật (FR-BRK-006).</p>
"""


def brk_04():
    return f"""
{head("Brand Preview Lab", "BRK-04 · 9:16 / 16:9 / 1:1 / 4:5 · contrast / clipping / overflow",
      '<button class="btn" type="button">Chạy QC visual</button>')}
<div class="grid3">
  <div class="card"><div class="thumb" style="min-height:220px">9:16</div><p class="muted">Safe-area OK · contrast 4.8</p></div>
  <div class="card"><div class="thumb">16:9</div><p class="muted">Caption overflow Warning</p></div>
  <div class="card"><div class="thumb">1:1 / 4:5</div><p class="muted">Logo visibility Pass</p></div>
</div>
"""


def brk_05():
    return f"""
{head("Version & Change History", "BRK-05 · diff · restore=version mới · impact",
      '<button class="btn" type="button">Restore v11 → tạo v13</button>')}
{table(["Ver","Ngày","Actor","Diff","Impact"],[
  ["v12","08/05","Mai","Disclaimer + CTA","3 draft · 0 completed đổi"],
  ["v11","01/08","Mai","Gold #C9A227","2 template"],
])}
<p class="muted">Completed VideoVersion giữ snapshot cũ (FR-BRK-007).</p>
"""


def cal_01():
    days = "".join(f'<div class="wd">{d}</div>' for d in "T2 T3 T4 T5 T6 T7 CN".split())
    cells = []
    for i in range(1, 31):
        extra = ""
        if i == 9:
            extra = '<span class="ev">Peak 16:9 · Hub</span>'
        if i == 10:
            extra = '<span class="ev">Batch 46</span>'
        if i == 15:
            extra = '<span class="ev">Reels 09:00</span>'
        cells.append(f'<div class="day"><b>{i}</b>{extra}</div>')
    return f"""
{head("Lịch xuất bản — Tháng 9", "CAL-01 · TZ Asia/Ho_Chi_Minh · month/week/list",
      btn("cal-02", "Composer", "btn-primary btn"))}
{tabs("cal-01",[("cal-01","Calendar"),("cal-02","Composer"),("cal-03","Gate"),("cal-04","Monitor"),("cal-05","Bulk")])}
<div class="filters"><button class="chip is-on">Tháng</button><button class="chip">Tuần</button><button class="chip">List</button>
  <select class="scope"><option>Kênh: tất cả</option><option>TikTok</option><option>Reels</option></select></div>
<div class="cal">{days}{''.join(cells)}</div>
"""


def cal_02():
    return f"""
{head("Publish Composer", "CAL-02 · FR-CAL-002 · chỉ version eligible",
      '<button class="btn-primary btn" type="button">Lên lịch</button>')}
<div class="grid2">
  <div class="card form">
    <label>VideoVersion *<select class="inp"><option>Peak 16:9 v3 — client_review (chưa eligible)</option><option>Peak Reels v2 — Final Approved</option></select></label>
    <label>Kênh / profile<select class="inp"><option>TikTok · @thepeak</option><option>Meta Reels · Campaign Write</option></select></label>
    <label>Schedule + TZ<div class="form-2"><input class="inp" type="datetime-local" value="2026-09-15T09:00"/><input class="inp" value="Asia/Ho_Chi_Minh"/></div></label>
    <label>Caption + hashtag<textarea class="inp">Sống trên mây. #ThePeak</textarea></label>
    <label>CTA / UTM<input class="inp" value="utm_source=tiktok&utm_campaign=peak_q3"/></label>
    <label>Thumbnail DAM<select class="inp"><option>thumb-v3.jpg</option></select></label>
  </div>
  <div class="card"><b>Channel profile validate</b>
    <p>TikTok: 9:16 · 15–60s · &lt;287MB · caption ≤2200</p>
    <p class="pill s-bad">v3 chưa Final Approved → không schedule</p>
    <p class="muted">QC Blocked / rights expired / thiếu disclaimer → khóa.</p>
  </div>
</div>
"""


def cal_03():
    return f"""
{head("Approval Gate", "CAL-03 · checklist trước unlock schedule",
      '')}
{table(["Hạng mục","Kết quả","Lock"],[
  ["QC","Warning (caption)", "Không lock"],
  ["Brand","Approved","—"],
  ["Client Hub","Pending +24h",'<span class="pill s-bad">Lock publish</span>'],
  ["Legal","N/A (no claim)","—"],
  ["Rights","VO-12 còn 5 ngày","Warn"],
  ["Channel profile","Peak Reels v2 OK","—"],
])}
"""


def cal_04():
    return f"""
{head("Distribution Monitor", "CAL-04 · status · retry · history",
      '<button class="btn" type="button">Retry failed</button>')}
{table(["Item","Kênh","Schedule","Status","Ref / lỗi"],[
  ["pub_991","TikTok","15/09 09:00",'<span class="pill s-info">Scheduled</span>',"—"],
  ["pub_988","Reels","08/09 09:00",'<span class="pill s-ok">Published</span>',"cw_2201"],
  ["pub_980","TikTok","07/09 09:00",'<span class="pill s-bad">Failed</span>',"token expired · retry"],
])}
<p class="note">W1: file export + Campaign Write. Native API khi <code>CP_PUBLISH_NATIVE</code>.</p>
"""


def cal_05():
    return f"""
{head("Bulk schedule", "CAL-05 · FR-CAL-006 · n post/ngày · exclude invalid",
      '<button class="btn-primary btn" type="button">Tạo 12 PublishItem</button>')}
<div class="card form">
  <label>Nguồn<select class="inp"><option>Batch job_b12 · 46 version Final</option></select></label>
  <label>Quy tắc<input class="inp" value="2 post/ngày · 09:00 và 18:00 · T2–T6"/></label>
  <label>Kênh<select class="inp"><option>TikTok + Reels</option></select></label>
</div>
<p class="muted">12 item hợp lệ · 2 hàng lỗi loại khỏi lịch · mỗi item audit riêng.</p>
"""


def rpt_01():
    return f"""
{head("Báo cáo điều hành", "RPT-01 · 4 KPI · funnel chỉ khi có ingest",
      '<select class="scope"><option>30 ngày</option></select><button class="btn" type="button">Export CSV</button>')}
{tabs("rpt-01",[("rpt-01","Executive"),("rpt-02","Production"),("rpt-03","Credit"),("rpt-04","Performance"),("rpt-05","Governance")])}
<div class="tiles">
  <div class="tile"><span>Output Final</span><strong>41</strong></div>
  <div class="tile"><span>Credit charged</span><strong>3.840</strong></div>
  <div class="tile"><span>ROI</span><strong>—</strong><em class="muted">Thiếu nguồn ads</em></div>
  <div class="tile"><span>Campaign health</span><strong>2 at risk</strong></div>
</div>
<div class="card"><b>Funnel</b><p class="muted">Views → landing → form → lead = <b>—</b> · source: chưa ingest · freshness: —</p>
  <p>Insight (không nhân quả): Peak 9:16 có 3 Final / tuần — cần nguồn Ads Hub để nói hiệu quả.</p></div>
"""


def rpt_02():
    return f"""
{head("Production Analytics", "RPT-02 · success · p50/p95 · retry · approval SLA",
      '')}
{tabs("rpt-02",[("rpt-01","Executive"),("rpt-02","Production"),("rpt-03","Credit")])}
<div class="tiles">
  <div class="tile"><span>Success</span><strong>94%</strong></div>
  <div class="tile"><span>Queue wait p95</span><strong>4m</strong></div>
  <div class="tile"><span>Render p95</span><strong>11m</strong></div>
  <div class="tile"><span>Approval cycle TB</span><strong>18h</strong></div>
</div>
{table(["Lớp lỗi","Count","Retry OK","Gợi ý"],[
  ["Provider timeout","6","4","fallback stub-b"],
  ["Rights block","3","—","gia hạn VO"],
  ["Moderation","1","0","sửa prompt"],
])}
"""


def rpt_03():
    return f"""
{head("Credit & Budget", "RPT-03 · estimated/reserved/charged/released/refunded",
      '<button class="btn" type="button">Export chargeback</button>')}
<div class="tiles">
  <div class="tile"><span>Charged</span><strong>3.210</strong></div>
  <div class="tile"><span>Reserved</span><strong>630</strong></div>
  <div class="tile"><span>Released</span><strong>180</strong></div>
  <div class="tile"><span>Refunded</span><strong>40</strong></div>
</div>
{table(["Khách","Allocated","Charged","Reserved","Forecast","Threshold"],[
  ["The Peak","2.000","1.280","160","1.720",'<span class="pill s-warn">80%</span>'],
  ["Bloom","800","320","40","410","40%"],
])}
<p class="muted">Forecast = scheduled batch + historical + reserved. Assumption ghi trên report.</p>
"""


def rpt_04():
    return f"""
{head("Content Performance", "RPT-04 · mọi metric có source + freshness · cấm bịa CTR",
      '')}
<div class="card"><b>Kênh</b>
  <p>TikTok views <b>—</b> · source: chưa connector · freshness: —</p>
  <p>Reels (Campaign Write import) <b>12.400</b> · source: ads_hub_csv · freshness: 2026-09-06</p>
</div>
{table(["Template / format","Output","Hiệu quả"],[
  ["SKU Reels 9:16","46","Thiếu nguồn"],
  ["TVC 16:9","3","—"],
])}
"""


def rpt_05():
    return f"""
{head("Governance", "RPT-05 · brand · rights · audit · policy outcome",
      '<button class="btn" type="button">Export audit</button>')}
<div class="tiles">
  <div class="tile"><span>Brand pass</span><strong>91%</strong></div>
  <div class="tile"><span>QC warning</span><strong>14</strong></div>
  <div class="tile"><span>Rights ≤14d</span><strong>7</strong></div>
  <div class="tile"><span>Policy Block</span><strong>3</strong></div>
</div>
{table(["Issue","Object","Outcome"],[
  ["Caption overflow","Peak Reels v2","Warning — đã publish?"],
  ["License VO-12","vo-12.wav","Review Legal"],
  ["High-cost render","job_4401","Allow + cap"],
])}
"""


def set_01():
    return f"""
{head("Cấu hình module — Profile", "SET-01 map · không sửa logo tenant",
      '<button class="btn-primary btn" type="button">Lưu</button>')}
{tabs("set-01",[("set-01","Profile"),("set-02","Members"),("set-03","SSO"),("set-04","Credit"),("set-05","Models"),("set-06","Integrations"),("set-07","Security"),("set-08","Policy")])}
<div class="card form">
  <label>Locale UI<select class="inp"><option>vi-VN</option></select></label>
  <label>Timezone<select class="inp"><option>Asia/Ho_Chi_Minh</option></select></label>
  <label>Default Brand Kit<select class="inp"><option>PTT Default v8</option></select></label>
  <label>Retention asset (ngày)<input class="inp" value="365"/></label>
  <p class="muted">Storage quota: — nếu chưa đo. Tên/logo tenant = Admin.</p>
</div>
"""


def set_02():
    return f"""
{head("Project members", "SET-02 · invite expiry + role CP · staff SoR platform",
      '<button class="btn-primary btn" type="button">Mời vào project</button>')}
{tabs("set-02",[("set-01","Profile"),("set-02","Members")])}
{table(["Staff","Role CP","Project scope","Expiry invite"],[
  ["Lan","producer","Peak, Bloom","—"],
  ["Hân","creator","Peak","—"],
  ["guest@ptt","viewer","Peak","72h"],
])}
<p class="note">Invite member hệ thống = Admin HR/staff. CP chỉ project membership.</p>
"""


def set_03():
    return f"""
{head("SSO & Provisioning", "SET-03 · CP không làm IdP",
      '<button class="btn-primary btn" type="button">Mở Admin SSO</button>')}
<div class="card"><p>SAML/OIDC/SCIM nằm <b>Quản trị hệ thống</b>. CP không form secret SSO, không SCIM, không IP allowlist.</p>
  <p class="muted">FR-SET-003 thỏa bằng deep-link Admin — không tái lập Nova Settings identity.</p></div>
"""


def set_04():
    return f"""
{head("Credit allocation", "SET-04 · grant/reserve/charge · 50/80/100",
      '<button class="btn-primary btn" type="button">Grant</button>')}
{table(["Khách","Allocated","Alert","Hard cap"],[
  ["The Peak","2.000","50/80","100% block"],
  ["Bloom","800","50/80","soft"],
])}
<p class="muted">Ledger kinds: grant, reserve, charge, release, refund, adjustment, expiry. Immutable + idempotent. Không invoice SaaS.</p>
"""


def set_05():
    return f"""
{head("AI Providers & Models", "SET-05 · allowlist · cap · region · fallback",
      '<button class="btn" type="button">Lưu policy</button>')}
{table(["Model","Max res","Max duration","Cap/job","Region","Fallback"],[
  ["stub-pro","1080","60s","200 cr","VN","stub-lite"],
  ["stub-lite","720","30s","40 cr","VN","—"],
])}
<p class="muted">Secret provider = vault. <code>CP_AI_ENABLED</code> unset = không dispatch. Client không thấy key.</p>
"""


def set_06():
    return f"""
{head("Integrations", "SET-06 · webhook CP · Hub · Content OS · Campaign Write",
      '')}
{table(["Hệ","Status","Ghi chú"],[
  ["Creative Hub / portal","ON","submit creative"],
  ["Content OS","ON","cite + ủy quyền generate W2"],
  ["Campaign Write","ON","handoff file + UTM"],
  ["Webhook CP","OFF","signing secret 1 lần"],
  ["Social native","FLAG","CP_PUBLISH_NATIVE"],
])}
"""


def set_07():
    return f"""
{head("Security & Data", "SET-07 · retention · legal hold · signed URL · audit",
      '')}
<div class="card form">
  <label>Signed URL TTL (phút)<input class="inp" value="15"/></label>
  <label>Restore period (ngày)<input class="inp" value="30"/></label>
  <label><input type="checkbox"/> Legal hold (chặn purge)</label>
</div>
<p class="muted">IP allowlist / MFA = platform. Audit query actor/action/resource/time — <code>view_audit</code>.</p>
"""


def set_08():
    return f"""
{head("Content Policy", "SET-08 · Block / Review / Allow · không lộ rule nội bộ",
      '<button class="btn-primary btn" type="button">Lưu</button>')}
{table(["Tín hiệu","Outcome","Escalate"],[
  ["PII / Restricted","Block render","Security"],
  ["Claim giá / ROI","Review Legal","Legal 8h"],
  ["Voice clone thiếu consent","Block","Brand"],
  ["Watermark draft","Allow + force WM","—"],
])}
<p class="note">Client không nhận mô tả rule nhạy (FR-SET-010).</p>
"""


PAGES = {
    "ovr-01": ("Tổng quan", ovr_01),
    "ovr-02": ("Action Center", ovr_02),
    "ovr-03": ("Production Monitor", ovr_03),
    "ovr-04": ("Activity", ovr_04),
    "prj-01": ("Dự án", prj_01),
    "prj-02": ("Tạo project", prj_02),
    "prj-03": ("Workspace", prj_03),
    "prj-04": ("Timeline", prj_04),
    "vid-01": ("Video Studio", vid_01),
    "vid-02": ("Storyboard", vid_02),
    "vid-03": ("Timeline", vid_03),
    "vid-04": ("Render Ops", vid_04),
    "vid-05": ("Review", vid_05),
    "vid-06": ("Batch", vid_06),
    "vid-07": ("Template", vid_07),
    "vid-08": ("Version", vid_08),
    "vid-01": ("Video Studio", vid_01),
    "med-01": ("Thư viện", med_01),
    "med-02": ("Asset", med_02),
    "med-03": ("Ingest", med_03),
    "med-04": ("Collections", med_04),
    "med-05": ("Rights", med_05),
    "med-06": ("Quality", med_06),
    "brk-01": ("Brand Kit", brk_01),
    "brk-02": ("Editor", brk_02),
    "brk-03": ("Rules", brk_03),
    "brk-04": ("Preview Lab", brk_04),
    "brk-05": ("History", brk_05),
    "cal-01": ("Lịch xuất bản", cal_01),
    "cal-02": ("Composer", cal_02),
    "cal-03": ("Gate", cal_03),
    "cal-04": ("Monitor", cal_04),
    "cal-05": ("Bulk", cal_05),
    "rpt-01": ("Báo cáo", rpt_01),
    "rpt-02": ("Production", rpt_02),
    "rpt-03": ("Credit", rpt_03),
    "rpt-04": ("Performance", rpt_04),
    "rpt-05": ("Governance", rpt_05),
    "set-01": ("Cấu hình", set_01),
    "set-02": ("Members", set_02),
    "set-03": ("SSO", set_03),
    "set-04": ("Credit", set_04),
    "set-05": ("Models", set_05),
    "set-06": ("Integrations", set_06),
    "set-07": ("Security", set_07),
    "set-08": ("Policy", set_08),
}

MODULE_FILES = {
    "overview": ["ovr-01", "ovr-02", "ovr-03", "ovr-04"],
    "projects": ["prj-01", "prj-02", "prj-03", "prj-04"],
    "video": ["vid-01", "vid-02", "vid-03", "vid-04", "vid-05", "vid-06", "vid-07", "vid-08"],
    "media": ["med-01", "med-02", "med-03", "med-04", "med-05", "med-06"],
    "brand": ["brk-01", "brk-02", "brk-03", "brk-04", "brk-05"],
    "calendar": ["cal-01", "cal-02", "cal-03", "cal-04", "cal-05"],
    "reports": ["rpt-01", "rpt-02", "rpt-03", "rpt-04", "rpt-05"],
    "settings": [f"set-0{i}" for i in range(1, 9)],
}

FILE_NAME = {
    "overview": "rnosai-cp-os-overview-mockup.html",
    "projects": "rnosai-cp-os-project-workspace-mockup.html",
    "video": "rnosai-cp-os-video-studio-mockup.html",
    "media": "rnosai-cp-os-media-dam-mockup.html",
    "brand": "rnosai-cp-os-brand-kit-mockup.html",
    "calendar": "rnosai-cp-os-calendar-mockup.html",
    "reports": "rnosai-cp-os-reports-mockup.html",
    "settings": "rnosai-cp-os-settings-mockup.html",
    "master": "rnosai-cp-os-srs-mockup.html",
}


CSS = r"""
:root{--navy:#0f2747;--accent:#2563eb;--ok:#16a34a;--warn:#d97706;--hot:#dc2626;--info:#0891b2;--bg:#f4f6f8;--surface:#fff;--border:#e5e7eb;--ink:#111827;--mute:#6b7280;--sidebar:248px}
*{box-sizing:border-box}html,body{margin:0;min-height:100%}
body{font-family:"Be Vietnam Pro",Inter,system-ui,sans-serif;background:var(--bg);color:var(--ink);font-size:13px;line-height:1.45}
button,input,select,textarea{font:inherit}button{cursor:pointer}a{color:inherit;text-decoration:none}
.app{min-height:100vh;display:flex;flex-direction:column}
.topbar{height:56px;display:flex;align-items:center;gap:12px;padding:0 14px;background:#fff;border-bottom:1px solid var(--border);position:sticky;top:0;z-index:40}
.logo{font-weight:800;color:var(--navy)}
.search-btn{flex:1;max-width:520px;height:36px;margin:0 auto;border:1px solid var(--border);border-radius:10px;background:#f9fafb;color:var(--mute);display:flex;justify-content:space-between;align-items:center;padding:0 12px}
.kbd{border:1px solid var(--border);border-radius:5px;padding:1px 6px;background:#fff;font-size:11px}
.top-right{margin-left:auto;display:flex;align-items:center;gap:8px}
.icon-btn{width:36px;height:36px;border:0;background:none;position:relative}
.dot{position:absolute;top:4px;right:4px;width:8px;height:8px;background:var(--hot);border-radius:99px}
.ava{width:32px;height:32px;border-radius:99px;background:var(--navy);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:700}
.catalog{background:#fff;border-bottom:1px solid var(--border);padding:7px 14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.catalog b{font-size:11px;color:var(--mute)}
.sc{border:1px solid var(--border);background:#fff;border-radius:999px;padding:3px 8px;font-size:11px}
.sc.is-on{background:var(--navy);color:#fff;border-color:var(--navy)}
.ops{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto}
.scope{height:30px;border:1px solid var(--border);border-radius:8px;padding:0 8px;background:#f9fafb;font-size:12px;font-weight:600}
.fresh{font-size:11px;color:var(--mute)}
.demo-more{font-size:12px}.demo-more summary{cursor:pointer;color:var(--mute);font-weight:600}
.demo-more[open]{width:100%}.demo-more[open] .sc{margin:3px 3px 0 0}
.shell{display:flex;flex:1;min-height:0}
.sidebar{width:var(--sidebar);flex:0 0 var(--sidebar);background:var(--navy);color:#cbd5e1;display:flex;flex-direction:column}
.nav{padding:10px 8px;display:grid;gap:2px;flex:1}
.grp{font-size:10px;font-weight:800;letter-spacing:.08em;color:#94a3b8;padding:10px 10px 4px}
.nav-btn{display:flex;align-items:center;gap:8px;width:100%;border:0;background:none;color:#e2e8f0;border-radius:10px;padding:8px 10px;text-align:left;font-size:13px}
.nav-btn.is-on{background:var(--accent);color:#fff;font-weight:600}
.sb-foot{padding:10px;border-top:1px solid #16355c;font-size:11px;color:#94a3b8}.sb-foot b{color:#e2e8f0;display:block}
.main{flex:1;min-width:0;padding:18px 22px 40px}
.page{display:none}.page.is-on{display:block}
.subpage{display:none}.subpage.is-on{display:block}
.crumb{font-size:12px;color:var(--mute);margin-bottom:6px}
.head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start;margin-bottom:12px}
h1{margin:0;font-size:22px;letter-spacing:-.03em}h2,h3{margin:0 0 8px;font-size:14px}
.sub{margin:4px 0 0;color:var(--mute);font-size:13px}
.actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.btn{height:34px;padding:0 11px;border-radius:10px;border:1px solid var(--border);background:#fff;font-weight:600}
.btn-primary{background:var(--accent);border-color:var(--accent);color:#fff}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:12px}
.tile{background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px;text-align:left}
.tile span{display:block;font-size:12px;color:var(--mute)}
.tile strong{display:block;margin:4px 0 2px;font-size:20px}
.tile em{font-style:normal;font-size:12px;font-weight:700}
.up{color:var(--ok)}.dn{color:var(--hot)}
.grid2{display:grid;grid-template-columns:1.3fr .9fr;gap:12px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px;min-width:0;margin-bottom:12px}
.card-h{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.linkish{border:0;background:none;color:var(--accent);font-weight:600;padding:0}
.muted{color:var(--mute);font-size:12px}
.tbl-wrap{overflow:auto;border:1px solid var(--border);border-radius:12px;background:#fff;margin-bottom:12px}
table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;color:var(--mute);padding:8px;border-bottom:1px solid var(--border);background:#f8fafc}
td{padding:8px;border-bottom:1px solid #f3f4f6;vertical-align:middle}
.pill{display:inline-flex;border-radius:99px;padding:2px 8px;font-size:12px;font-weight:700}
.s-ok{background:#dcfce7;color:#166534}.s-warn{background:#fef3c7;color:#92400e}.s-bad{background:#fee2e2;color:#991b1b}.s-info{background:#e0f2fe;color:#075985}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.tab{border:1px solid var(--border);background:#fff;border-radius:999px;padding:6px 11px;font-size:12px}
.tab.is-on{background:var(--accent);color:#fff;border-color:var(--accent)}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.chip{border:1px solid var(--border);background:#fff;border-radius:99px;padding:4px 10px;font-size:12px}
.chip.is-on{background:var(--navy);color:#fff;border-color:var(--navy)}
.alert{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:10px;padding:10px 12px;margin-bottom:12px;display:flex;justify-content:space-between;gap:10px;align-items:center}
.tl{border-left:2px solid var(--border);margin-left:8px;padding-left:14px}.tl .ev{margin:0 0 14px}
.form{display:grid;gap:8px}.form label{display:grid;gap:4px;font-size:12px;font-weight:600}
.inp{height:34px;padding:0 10px;border-radius:10px;border:1px solid var(--border);background:#fff}
textarea.inp{height:auto;min-height:88px;padding:8px 10px}
.form-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.studio{display:grid;grid-template-columns:260px minmax(0,1fr) 260px;gap:12px}
.thumb{background:linear-gradient(135deg,#d6e3f0,#94a3b8);border-radius:10px;min-height:160px;display:grid;place-items:center;color:#fff;font-weight:700}
.media-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.media-card{border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#fff;padding:0;text-align:left}
.media-card .ph{height:88px;background:#cbd5e1}
.media-card b{display:block;padding:6px 8px;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cal{display:grid;grid-template-columns:repeat(7,1fr);border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#fff}
.cal .wd{padding:8px;background:#f8fafc;font-size:11px;color:var(--mute);font-weight:700;text-align:center}
.cal .day{min-height:88px;padding:6px;border-top:1px solid var(--border);border-right:1px solid var(--border)}
.cal .ev{display:block;margin-top:4px;padding:2px 5px;border-left:2px solid var(--info);background:#ecfeff;border-radius:4px;font-size:10px}
.note{font-size:11px;color:#9ca3af;margin-top:8px}
.bars{display:flex;align-items:end;gap:8px;height:80px}
.bars i{flex:1;background:var(--accent);border-radius:4px 4px 0 0;display:block}
.track{display:flex;align-items:center;gap:8px;margin:8px 0}
.track b{width:56px;font-size:11px;color:var(--mute)}
.track i{height:18px;background:var(--accent);border-radius:4px;display:inline-block}
.stepper{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.stepper span{border:1px solid var(--border);border-radius:99px;padding:4px 10px;background:#fff;font-size:12px}
.stepper span.is-on{background:var(--navy);color:#fff;border-color:var(--navy)}
.swatch{display:inline-block;width:14px;height:14px;border-radius:4px;border:1px solid var(--border);vertical-align:middle}
.notify{display:none;position:absolute;right:14px;top:56px;width:360px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px;z-index:50;box-shadow:0 8px 24px #0002}
.notify.is-on{display:block}
code{font-size:11px;background:#f3f4f6;padding:1px 4px;border-radius:4px}
@media(max-width:1100px){.grid2,.grid3,.studio{grid-template-columns:1fr}.media-grid{grid-template-columns:repeat(2,1fr)}}
"""


JS = r"""
const HUB_MSG='POST /creatives — không mint portal';
function show(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('is-on'));
  const el=document.getElementById(id);
  if(el) el.classList.add('is-on');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('is-on', b.dataset.page===id || (NAV_MAP[id]&&b.dataset.page===NAV_MAP[id])));
  document.querySelectorAll('.sc').forEach(b=>b.classList.toggle('is-on', b.dataset.page===id));
  const j=document.getElementById('demo-jump'); if(j) j.value=id;
  const t=document.getElementById('page-title');
  if(t && el) t.textContent=el.dataset.title||id;
}
function subtab(btn,id){
  const root=btn.closest('.page');
  root.querySelectorAll('.tab').forEach(t=>t.classList.remove('is-on'));
  btn.classList.add('is-on');
  root.querySelectorAll('.subpage').forEach(p=>p.classList.toggle('is-on', p.id===id));
}
const NAV_MAP={
  'ovr-02':'ovr-01','ovr-03':'ovr-01','ovr-04':'ovr-01',
  'prj-02':'prj-01','prj-03':'prj-01','prj-04':'prj-01',
  'vid-02':'vid-01','vid-03':'vid-01','vid-04':'vid-01','vid-05':'vid-01','vid-06':'vid-01','vid-07':'vid-01','vid-08':'vid-01',
  'med-02':'med-01','med-03':'med-01','med-04':'med-01','med-05':'med-01','med-06':'med-01',
  'brk-02':'brk-01','brk-03':'brk-01','brk-04':'brk-01','brk-05':'brk-01',
  'cal-02':'cal-01','cal-03':'cal-01','cal-04':'cal-01','cal-05':'cal-01',
  'rpt-02':'rpt-01','rpt-03':'rpt-01','rpt-04':'rpt-01','rpt-05':'rpt-01',
  'set-02':'set-01','set-03':'set-01','set-04':'set-01','set-05':'set-01','set-06':'set-01','set-07':'set-01','set-08':'set-01'
};
"""


def chrome(page_ids: list[str], default: str, title: str) -> str:
    nav = []
    for sid, label, _mod in NAV:
        on = " is-on" if sid == default else ""
        nav.append(
            '<button class="nav-btn%s" type="button" data-page="%s" onclick="show(%r)">%s</button>'
            % (on, sid, sid, label)
        )
    jumps = "".join(f'<option value="{sid}">{lab}</option>' for sid, lab in SCREENS if sid in page_ids or True)
    if page_ids != list(PAGES):
        jumps = "".join(
            f'<option value="{sid}">{lab}</option>'
            for sid, lab in SCREENS
            if sid in page_ids
        )
    chips = "".join(
        '<button class="sc%s" type="button" data-page="%s" onclick="show(%r)">%s</button>'
        % (" is-on" if sid == default else "", sid, sid, lab)
        for sid, lab in SCREENS
        if sid in page_ids
    )
    bodies = []
    for sid in page_ids:
        ttl, fn = PAGES[sid]
        on = " is-on" if sid == default else ""
        bodies.append(f'<section class="page{on}" id="{sid}" data-title="{ttl}">{fn()}</section>')
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>{CSS}</style>
</head>
<body>
<div class="app" id="app">
  <header class="topbar">
    <button class="icon-btn" type="button" onclick="document.getElementById('app').classList.toggle('collapsed')">☰</button>
    <span class="logo">RNOSAI <span style="font-weight:500;color:var(--mute);font-size:12px">PTT · CP OS</span></span>
    <button class="search-btn" type="button"><span>Tìm project, video, asset, job…</span><span class="kbd">⌘K</span></button>
    <div class="top-right">
      <span class="fresh">Đồng bộ 09:18 · last_updated ISO</span>
      <button class="icon-btn" type="button" onclick="document.getElementById('notify').classList.toggle('is-on')">🔔<i class="dot"></i></button>
      <span class="ava" title="Nguyễn Minh">NM</span>
    </div>
    <div class="notify" id="notify">
      <div class="card-h"><b>Thông báo</b></div>
      <p>Render job_4412 failed · timeout</p>
      <p>Client review Peak 16:9 +24h</p>
      <p>Credit The Peak 80%</p>
    </div>
  </header>
  <div class="catalog">
    <b>Vận hành</b>
    <select class="scope"><option>Vai trò: Producer — Lan</option><option>AM — Minh</option><option>Brand — Mai</option><option>Finance</option></select>
    <select class="scope"><option>Phạm vi: Của tôi</option><option>Team</option><option>Toàn PTT</option></select>
    <div class="ops">
      <label class="fresh" for="demo-jump">Nhảy màn</label>
      <select class="scope" id="demo-jump" onchange="show(this.value)">{jumps}</select>
      <details class="demo-more"><summary>Toàn catalog</summary>{chips}</details>
    </div>
  </div>
  <div class="shell">
    <aside class="sidebar">
      <div class="nav"><div class="grp">SẢN XUẤT SÁNG TẠO</div>{''.join(nav)}</div>
      <div class="sb-foot">Credit PTT<br><b>1.160 / 5.000</b>storage — nếu chưa đo</div>
    </aside>
    <main class="main" id="page-title-wrap">{''.join(bodies)}</main>
  </div>
</div>
<script>{JS}</script>
</body>
</html>
"""


def main() -> None:
    all_ids = list(PAGES.keys())
    master = chrome(all_ids, "ovr-01", "RNOSAI · Creative Production OS — mockup vận hành enterprise")
    (ROOT / FILE_NAME["master"]).write_text(master, encoding="utf-8")
    print("wrote", FILE_NAME["master"], "screens", len(all_ids))
    for mod, ids in MODULE_FILES.items():
        html = chrome(ids, ids[0], f"RNOSAI · CP OS · {mod}")
        (ROOT / FILE_NAME[mod]).write_text(html, encoding="utf-8")
        print("wrote", FILE_NAME[mod], len(ids))
    (ROOT / "rnosai-cp-os-mockup.css").write_text(CSS.strip() + "\n", encoding="utf-8")
    print("wrote rnosai-cp-os-mockup.css")


if __name__ == "__main__":
    main()
