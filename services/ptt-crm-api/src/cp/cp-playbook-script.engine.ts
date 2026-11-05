import { getPlaybook } from './cp-playbook.registry';
import { CpPlaybookId, CpPlaybookScene, CpPlaybookVars } from './cp-playbook.types';

const OVERLAY_MAX = 42;

export function buildScenesFromPlaybook(
  playbookId: string,
  vars: CpPlaybookVars = {},
): CpPlaybookScene[] {
  const playbook = getPlaybook(playbookId);
  switch (playbook.id) {
    case 'lead_social_916':
      return buildLeadSocialScenes(vars);
    case 'bds_social_916':
      return buildBdsSocialScenes(vars);
    case 'tvc_short_169':
      return buildTvcShortScenes(vars);
    default:
      return [];
  }
}

export function regenerateScene(
  playbookId: string,
  sceneIdx: number,
  vars: CpPlaybookVars = {},
  current?: Partial<CpPlaybookScene>,
): Pick<CpPlaybookScene, 'visual' | 'vo' | 'overlay'> {
  const scenes = buildScenesFromPlaybook(playbookId, vars);
  const generated = scenes.find((scene) => scene.idx === sceneIdx)
    ?? scenes[sceneIdx]
    ?? fallbackScene(sceneIdx, vars);
  return {
    visual: current?.locked ? current.visual ?? generated.visual : generated.visual,
    vo: current?.locked ? current.vo ?? generated.vo : generated.vo,
    overlay: current?.locked ? current.overlay ?? generated.overlay : clipOverlay(generated.overlay),
  };
}

function buildLeadSocialScenes(vars: CpPlaybookVars): CpPlaybookScene[] {
  const hookId = String(vars.hook_id ?? 'h1');
  if (hookId === 'h1' || hookId === 'h1_30') {
    return leadH1Scenes(vars);
  }
  return [
    scene(0, 'hook', 0, 3, 'Advisor face — hook', 'Agency của bạn gửi slide.', 'Agency gửi slide.'),
    scene(1, 'pain', 3, 7, 'Cut to pain point', 'Bạn cần khách.', 'Bạn cần khách.'),
    scene(2, 'ui_proof', 7, 11, 'Ads Ops dashboard UI', 'PTT đo Spend, lead, CPL trên một màn.', 'Spend · lead · CPL'),
    scene(3, 'form_crm', 11, 13, 'Instant Form fields', 'Form lấy đúng người quyết định.', 'Form đúng người'),
    scene(4, 'cta', 13, 15, 'Advisor + form CTA', 'Điền form. Audit funnel không lấy phí.', 'Audit funnel — 0đ'),
  ];
}

function leadH1Scenes(vars: CpPlaybookVars): CpPlaybookScene[] {
  const offer = String(vars.offer ?? 'PTT audit CPL');
  return [
    scene(0, 'hook', 0, 2.5, 'Advisor face AI', 'Bạn đang trả tiền cho click — không phải cho khách.', 'Bạn đang trả tiền cho click.'),
    scene(1, 'pain', 2.5, 3.5, 'Cut UI transition', '(kéo nốt câu trên)', 'Không phải cho khách.'),
    scene(2, 'ui_proof', 3.5, 7.5, 'QC fail → pass animation', 'Creative không đạt QC thì form không ăn.', 'Creative đạt — form mới ăn.'),
    scene(3, 'form_crm', 7.5, 11.5, 'Form → lead in CRM', 'Lead vào CRM trong phút. Không chờ báo cáo thứ Hai.', 'Lead vào CRM trong phút.'),
    scene(4, 'cta', 12, 15, 'Advisor face + type CTA', `Để lại SĐT. ${offer} — 15 phút.`, 'Audit 15 phút — miễn phí.'),
  ];
}

function buildBdsSocialScenes(vars: CpPlaybookVars): CpPlaybookScene[] {
  const projectName = String(vars.project_name ?? 'Dự án BĐS');
  const priceFrom = String(vars.price_from ?? 'từ 3 tỷ');
  const location = String(vars.location ?? 'TP.HCM');
  const hotline = String(vars.hotline ?? '1900');
  const cta = String(vars.cta ?? 'Đăng ký tư vấn');
  return [
    scene(0, 'hook', 0, 3, `Hero căn hộ ${projectName}`, `${projectName} — ${priceFrom}`, projectName),
    scene(1, 'location', 3, 7, `Map / vị trí ${location}`, `Vị trí ${location}`, location),
    scene(2, 'price', 7, 11, 'Giá từ + tiện ích', `${priceFrom} — liên hệ ${hotline}`, priceFrom),
    scene(3, 'cta', 11, 15, 'Logo CĐT + form CTA', `${cta}. Hotline ${hotline}`, cta),
  ];
}

function buildTvcShortScenes(vars: CpPlaybookVars): CpPlaybookScene[] {
  const brand = String(vars.brand_name ?? 'Thương hiệu');
  const tagline = String(vars.tagline ?? 'Tagline thương hiệu');
  const disclaimer = String(vars.legal_disclaimer ?? 'Hình ảnh minh họa.');
  return [
    scene(0, 'intro', 0, 3, `Logo intro ${brand}`, brand, brand),
    scene(1, 'hero', 3, 12, 'Hero cinematic shot', tagline, tagline),
    scene(2, 'outro', 12, 15, 'Logo outro + disclaimer', disclaimer, disclaimer),
  ];
}

function scene(
  idx: number,
  beat: string,
  tStart: number,
  tEnd: number,
  visual: string,
  vo: string,
  overlay: string,
): CpPlaybookScene {
  return {
    idx,
    title: beat,
    beat,
    t_start: tStart,
    t_end: tEnd,
    visual,
    vo,
    overlay: clipOverlay(overlay),
    locked: false,
  };
}

function fallbackScene(idx: number, vars: CpPlaybookVars) {
  return {
    visual: `Scene ${idx} visual`,
    vo: `Scene ${idx} VO`,
    overlay: clipOverlay(String(vars.project_name ?? `Scene ${idx}`)),
  };
}

function clipOverlay(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.slice(0, OVERLAY_MAX);
}
