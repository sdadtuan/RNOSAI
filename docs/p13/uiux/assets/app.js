// P13 mockup shell — vanilla JS, không phụ thuộc thư viện
const NAV = [
  {sec:'Chung', items:[['dash','S8-dashboard.html','Tổng quan',0]]},
  {sec:'Bán hàng & CRM', items:[['x1','#','Lead',2],['x2','#','Sales funnel',2],['x3','#','Khách hàng',2],['s3','S3-danh-sach-bao-gia.html','Báo giá (/crm/proposals)',1],['s5','S5-duyet-bao-gia.html','Duyệt báo giá',1,'CEO']]},
  {sec:'Dịch vụ & Báo giá', items:[['s1','S1-danh-muc-dich-vu.html','Danh mục dịch vụ',1],['s2','S2-tham-so-gia.html','Tham số giá',1,'CEO']]},
  {sec:'Triển khai', items:[['x5','#','Service Delivery',2],['s7','S7-checklist-du-an.html','Checklist dự án',1],['x6','#','Delivery Projects',2],['x7','#','Hợp đồng (P12)',2]]},
  {sec:'Khác', items:[['x8','#','KPI Hub',2],['x9','#','Tài chính',2],['x10','#','Admin',2]]}
];
function shell(active, crumb, role, initials){
  const sb = document.getElementById('sb');
  sb.className='sidebar';
  sb.innerHTML = `<div class="brand"><div class="logo">PTT</div>PTT CRM <span style="font-weight:400;opacity:.6;font-size:12px">Ops</span></div>` +
    NAV.map(g=>`<div class="nav-sec">${g.sec}</div><nav class="nav">`+g.items.map(([id,href,label,kind,tag])=>
      `<a href="${href}" class="${id===active?'active':''} ${kind===2?'muted':''}" ${id===active?'aria-current="page"':''}>${label}${kind===1?`<span class="new">${tag||'P13'}</span>`:''}</a>`).join('')+`</nav>`).join('') +
    `<div class="nav-sec" style="margin-top:12px"><a href="index.html" style="color:#8FB394">← Mục lục mockup</a></div>`;
  const tb = document.getElementById('tb');
  tb.className='topbar';
  tb.innerHTML = `<div class="crumb">${crumb}</div><div class="grow"></div>
    <span class="sample" title="Toàn bộ số liệu là giả lập">DỮ LIỆU MẪU — không phải giá thật</span>
    <span class="role">Vai trò: ${role}</span><div class="avatar" aria-hidden="true">${initials||'KT'}</div>`;
}
function tabs(root){
  document.querySelectorAll(root+' [data-tab]').forEach(t=>t.addEventListener('click',()=>{
    const grp=t.closest('[data-tabs]');
    grp.querySelectorAll('[data-tab]').forEach(x=>{x.classList.toggle('on',x===t);x.setAttribute('aria-selected',x===t)});
    document.querySelectorAll(`[data-panel-of="${grp.dataset.tabs}"]`).forEach(p=>p.classList.toggle('on',p.dataset.panel===t.dataset.tab));
  }));
}
function openEl(id){document.getElementById(id).classList.add('on'); const bg=document.getElementById(id+'-bg'); if(bg) bg.classList.add('on');}
function closeEl(id){document.getElementById(id).classList.remove('on'); const bg=document.getElementById(id+'-bg'); if(bg) bg.classList.remove('on');}
function chips(){document.querySelectorAll('.chip.filter').forEach(c=>c.addEventListener('click',()=>{
  if(c.dataset.single){c.parentElement.querySelectorAll('.chip.filter').forEach(x=>x.classList.remove('on'));}
  c.classList.toggle('on'); if(window.applyFilters) applyFilters();}));}
const vnd = n => n==null?'—':n.toLocaleString('vi-VN');
document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.querySelectorAll('.drawer.on,.modal-bg.on,.drawer-bg.on').forEach(x=>x.classList.remove('on'));}});
document.addEventListener('DOMContentLoaded',()=>{tabs('body');chips();});
