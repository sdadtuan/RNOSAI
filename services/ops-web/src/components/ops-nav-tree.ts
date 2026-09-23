/**
 * Ops sidebar IA tree — SoT: docs/superpowers/specs/2026-09-16-ops-sidebar-accordion-design.md
 */
import { buildAdminSidebarLinks } from '@/lib/admin/admin-nav';
import type { StoredStaffUser } from '@/lib/auth';
import {
  hasCap,
  canGenerateMktAiPlanner,
  canApproveMktAiPlanner,
} from '@/lib/auth';
import { isOpsDvFeEnabled } from '@/lib/ops-dv-flags';
import { emailGateAEnabled, emailJourneysEnabled, emailModuleEnabled } from '@/lib/email-flags';
import { winKpiSolutionEnabled } from '@/lib/win/flags';
import { canViewEmailGateA, canViewEmailHub, canWriteEmailHub } from '@/lib/email/caps';
import { canViewMetaAdsOps, canViewMetaHub, canViewMetaIntelligence, canViewMetaTracking } from '@/lib/meta/caps';
import { ceoCommandEnabled } from '@/lib/crm/ceo-command-flags';
import { canSeeAmNav } from '@/lib/crm/am-nav.util';
import { canSeeQtNav } from '@/lib/crm/qt-nav.util';
import { resolvePresalesSolutionCaps } from '@/lib/crm/presales-solution-caps';
import { canSeeRevopsNav } from '@/lib/crm/revops-nav.util';
import { isRevopsShellEnabled } from '@/lib/crm/revops-flags';
import { canSeeCsdNav } from '@/lib/crm/csd-nav.util';
import { canSeeIwrNav } from '@/lib/crm/iwr-nav.util';
import { canSeeCeoNav } from '@/lib/crm/ceo-command-thread.util';
import {
  canViewSeoAeo,
  canViewSeoAuthority,
  canViewSeoAutomations,
  canViewSeoContent,
  canViewSeoBi,
  canViewSeoCms,
  canViewSeoGateA,
  canViewSeoExperiments,
  canViewSeoFreshness,
  canViewSeoGovernance,
  canViewSeoHub,
  canViewSeoRanks,
  canViewSeoReports,
  canViewSeoResearch,
  canViewSeoStrategy,
  canViewSeoTechnical,
} from '@/lib/seo/caps';
import {
  seoAeoEnabled,
  seoAuthorityEnabled,
  seoAutomationsEnabled,
  seoBiEnabled,
  seoCmsEnabled,
  seoGateAEnabled,
  seoContentEnabled,
  seoExperimentsEnabled,
  seoFreshnessEnabled,
  seoGovernanceEnabled,
  seoHubEnabled,
  seoRanksEnabled,
  seoReportsEnabled,
  seoResearchEnabled,
  seoStrategyEnabled,
  seoTechnicalEnabled,
} from '@/lib/seo/flags';
import { metaAdsOpsEnabled, metaIntelligenceEnabled, metaTrackingEnabled } from '@/lib/meta/flags';
import { isMarketResearchFeEnabled } from '@/lib/market-research-flags';
import { shouldShowTaxonomyNav } from '@/components/research/taxonomy-pane.util';
import { canViewGtmCms, canViewGtmDemos } from '@/lib/gtm/caps';
import { shouldShowContentOsNav } from '@/components/ops-nav-content-os';
import { shouldShowMediaOsNav } from '@/components/ops-nav-media-os';
import { shouldShowVideoSopNav } from '@/components/ops-nav-video-sop';
import { shouldShowImageSopNav } from '@/components/ops-nav-image-sop';
import { shouldShowCpNav } from '@/components/ops-nav-cp';
import type { NavChild, NavItem, NavParent } from './ops-nav-tree.types';

export type BuildNavTreeOpts = {
  emailPendingApprovals?: number;
  agencyUnread?: number;
  reviewQueueCount?: number;
  csdChatUnread?: number;
  imageSopEnabled?: boolean;
};

/** Icon resolved at render via iconForHref — avoid importing JSX nav-icons in this pure module. */
function child(id: string, label: string, href: string, badge?: number): NavChild {
  return {
    id,
    label,
    href,
    icon: 'dot',
    ...(badge != null && badge > 0 ? { badge } : {}),
  };
}

function parent(id: string, label: string, icon: string, children: NavChild[]): NavParent {
  return { kind: 'parent', id, label, icon, children };
}

export function collapseThinParents(items: NavItem[]): NavItem[] {
  return items.map((item) => {
    if (item.kind !== 'parent') return item;
    if (item.children.length >= 2) return item;
    if (item.children.length === 1) {
      const only = item.children[0];
      return {
        kind: 'leaf' as const,
        id: item.id,
        label: item.label,
        href: only.href,
        icon: item.icon,
        ...(only.badge != null ? { badge: only.badge } : {}),
      };
    }
    return item;
  }).filter((item) => {
    if (item.kind === 'parent') return item.children.length > 0;
    return Boolean(item.href);
  });
}

export function collectHrefs(items: NavItem[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (item.kind === 'leaf') out.push(item.href);
    else for (const c of item.children) out.push(c.href);
  }
  return out;
}

function pushSeoChildren(user: StoredStaffUser | null, children: NavChild[]): void {
  if (!seoHubEnabled() || !canViewSeoHub(user)) return;
  children.push(child('seo-hub', 'Hub', '/seo/hub'));
  children.push(child('seo-clients', 'Khách hàng SEO', '/seo/clients'));
  if (seoResearchEnabled() && canViewSeoResearch(user)) {
    children.push(child('seo-research', 'Nghiên cứu', '/seo/research'));
  }
  if (seoContentEnabled() && canViewSeoContent(user)) {
    children.push(child('seo-content', 'Nội dung', '/seo/content'));
  }
  if (seoTechnicalEnabled() && canViewSeoTechnical(user)) {
    children.push(child('seo-tech', 'Technical', '/seo/technical'));
  }
  if (seoReportsEnabled() && canViewSeoReports(user)) {
    children.push(child('seo-reports', 'Báo cáo', '/seo/reports'));
  }
  if (seoStrategyEnabled() && canViewSeoStrategy(user)) {
    children.push(child('seo-strategy', 'Chiến lược', '/seo/strategy'));
  }
  if (seoGovernanceEnabled() && canViewSeoGovernance(user)) {
    children.push(child('seo-gov', 'Governance', '/seo/governance'));
  }
  if (seoAeoEnabled() && canViewSeoAeo(user)) {
    children.push(child('seo-aeo', 'AEO Console', '/seo/aeo'));
  }
  if (seoAuthorityEnabled() && canViewSeoAuthority(user)) {
    children.push(child('seo-auth', 'Authority', '/seo/authority'));
  }
  if (seoRanksEnabled() && canViewSeoRanks(user)) {
    children.push(child('seo-ranks', 'Rank Tracker', '/seo/ranks'));
  }
  if (seoAutomationsEnabled() && canViewSeoAutomations(user)) {
    children.push(child('seo-auto', 'Automations', '/seo/automations'));
  }
  if (seoFreshnessEnabled() && canViewSeoFreshness(user)) {
    children.push(child('seo-fresh', 'Freshness', '/seo/freshness'));
  }
  if (seoExperimentsEnabled() && canViewSeoExperiments(user)) {
    children.push(child('seo-exp', 'Experiments', '/seo/experiments'));
  }
  if (seoBiEnabled() && canViewSeoBi(user)) {
    children.push(child('seo-bi', 'SEO BI', '/seo/bi'));
  }
  if (seoCmsEnabled() && canViewSeoCms(user)) {
    children.push(child('seo-cms', 'CMS Pilot', '/seo/cms'));
  }
  if (seoGateAEnabled() && canViewSeoGateA(user)) {
    children.push(child('seo-gate', 'Gate A', '/seo/gate-a'));
  }
}

export function buildNavTree(user: StoredStaffUser | null, opts: BuildNavTreeOpts = {}): NavItem[] {
  const {
    emailPendingApprovals,
    agencyUnread,
    reviewQueueCount,
    csdChatUnread,
    imageSopEnabled,
  } = opts;

  const items: NavItem[] = [];

  // 1. Tổng quan — leaf
  items.push({ kind: 'leaf', id: 'overview', label: 'Tổng quan', href: '/', icon: 'home' });

  // 2. Bán hàng
  const sales: NavChild[] = [];
  if (hasCap(user, 'crm_leads', 'view')) {
    sales.push(child('sales-b2b', 'Lead B2B', '/crm/b2b/leads'));
    sales.push(child('sales-inbox', 'Inbox B2B', '/crm/b2b-inbox'));
    if (hasCap(user, 'crm_presales_solution', 'view') || hasCap(user, 'crm_leads', 'view')) {
      const solLabel = resolvePresalesSolutionCaps(user).isAeTrackOnly
        ? 'Theo dõi Solution'
        : 'Hàng đợi Solution';
      sales.push(child('sales-solution', solLabel, '/crm/solution/queue'));
    }
  }
  if (hasCap(user, 'crm_sales_overview', 'view') || hasCap(user, 'crm_sales_plans', 'view')) {
    sales.push(child('sales-kd', 'Kinh doanh', '/crm/sales'));
  }
  if (canSeeQtNav(user)) {
    sales.push(child('sales-quote', 'Báo giá', '/crm/proposals'));
  }
  if (hasCap(user, 'crm_board', 'view') && isOpsDvFeEnabled()) {
    sales.push(child('sales-svc', 'Tra cứu dịch vụ', '/crm/sales/services'));
  }
  if (hasCap(user, 'crm_agency', 'view')) {
    sales.push(child('sales-hub', 'Hub hợp đồng', '/crm/hub'));
  }
  if (hasCap(user, 'crm_leads', 'view')) {
    sales.push(child('sales-intake', 'Lead Intake', '/crm/intake'));
  }
  if (hasCap(user, 'crm_b2b_projects', 'view')) {
    sales.push(child('sales-projects', 'Dự án PTT', '/crm/b2b-projects'));
    sales.push(child('sales-ingest-dv', 'Lead ingest DV', '/crm/delivery-projects?capability=lead_ingest'));
    sales.push(child('sales-speed', 'Speed-to-lead', '/crm/b2b-speed'));
  }
  if (isRevopsShellEnabled() && canSeeRevopsNav(user)) {
    sales.push(child('sales-revops', 'Revenue Ops', '/crm/revenue-ops'));
  }
  if (hasCap(user, 'crm_board', 'view')) {
    sales.push(child('sales-orders', 'Đơn hàng', '/crm/orders'));
  }
  if (hasCap(user, 'crm_re_projects', 'view') || hasCap(user, 'crm_re_projects_products', 'view')) {
    sales.push(child('sales-re', 'Dự án BĐS', '/crm/re-projects'));
  }
  if (hasCap(user, 'crm_b2b_projects', 'view')) {
    sales.push(child('sales-gdkd', 'GDKD command', '/crm/b2b-gdkd'));
  }
  if (hasCap(user, 'crm_b2b_projects', 'manage')) {
    sales.push(child('sales-unmatched', 'Ingress chưa map', '/crm/b2b-unmatched'));
  }
  if (hasCap(user, 'crm_leads', 'edit')) {
    sales.push(child('sales-b2b-new', 'Tạo lead B2B', '/crm/b2b/leads/new'));
  }
  if (sales.length) items.push(parent('sales', 'Bán hàng', 'sales', sales));

  // 3. CRM
  const crm: NavChild[] = [];
  if (hasCap(user, 'crm_board', 'view')) {
    crm.push(child('crm-board', 'Bảng CSKH', '/crm'));
  }
  if (hasCap(user, 'crm_leads', 'view')) {
    crm.push(child('crm-ops-leads', 'Lead vận hành', '/crm/operational/leads'));
    crm.push(child('crm-cskh-sla', 'Bảng CSKH SLA', '/crm/cskh-board'));
    if (hasCap(user, 'crm_leads', 'assign')) {
      crm.push(
        child('crm-review', 'Phải tra soát (B2)', '/crm/leads/review-queue', reviewQueueCount),
      );
    }
    crm.push(child('crm-all-leads', 'Tất cả leads', '/crm/leads'));
    crm.push(child('crm-catalog', 'Catalog', '/crm/catalog'));
  }
  if (hasCap(user, 'crm_board_customers', 'view')) {
    crm.push(child('crm-customers', 'Khách hàng', '/crm/customers'));
  }
  if (hasCap(user, 'crm_board', 'view')) {
    crm.push(child('crm-tickets', 'Ticket CS', '/crm/tickets'));
  }
  if (hasCap(user, 'crm_leads', 'view')) {
    if (hasCap(user, 'crm_kpi_records', 'view') || hasCap(user, 'crm_business_dashboard', 'view')) {
      crm.push(child('crm-gdkd-ent', 'KPI GDKD Enterprise', '/crm/gdkd-enterprise'));
    }
    if (hasCap(user, 'crm_leads', 'edit')) {
      crm.push(child('crm-ops-new', 'Tạo lead vận hành', '/crm/operational/leads/new'));
    }
  }
  if (crm.length) items.push(parent('crm', 'CRM', 'board', crm));

  // 4. Service Desk
  const csd: NavChild[] = [];
  if (canSeeCsdNav(user)) {
    csd.push(child('csd-home', 'Tổng quan', '/crm/csd'));
    csd.push(child('csd-tickets', 'Ticket', '/crm/csd/tickets'));
    csd.push(child('csd-chat', 'Chat nội bộ', '/crm/csd/chat', csdChatUnread));
    csd.push(child('csd-email', 'Email', '/crm/csd/email'));
    csd.push(child('csd-reports', 'Báo cáo', '/crm/csd/reports'));
    if (hasCap(user, 'csd', 'manage')) {
      csd.push(child('csd-templates', 'Mẫu báo cáo', '/crm/csd/reports/templates'));
    }
  }
  if (csd.length) items.push(parent('csd', 'Service Desk', 'ticket', csd));

  // 5. Account Management
  if (canSeeAmNav(user)) {
    items.push(
      parent('am', 'Account Management', 'customers', [
        child('am-hub', 'Trung tâm AM', '/crm/account-management'),
      ]),
    );
  }

  // 6. Agency
  const agency: NavChild[] = [];
  if (hasCap(user, 'crm_agency', 'view')) {
    agency.push(child('agency-hub', 'Agency Hub', '/agency'));
    agency.push(child('agency-ingest', 'Ingest', '/agency/ingest'));
    agency.push(child('agency-notif', 'Thông báo', '/agency/notifications', agencyUnread));
    agency.push(child('agency-kpi', 'Định nghĩa KPI', '/agency/kpi-definitions'));
  }
  if (agency.length) items.push(parent('agency', 'Agency', 'agency', agency));

  // 7. Quảng cáo — explicit ads caps only (not crm_agency.view)
  const ads: NavChild[] = [];
  const canMetaAds = canViewMetaHub(user);
  if (canMetaAds) {
    ads.push(child('ads-meta', 'Meta Ads', '/meta/facebook-ads'));
    if (metaAdsOpsEnabled() && canViewMetaAdsOps(user)) {
      ads.push(child('ads-ops', 'Meta Ads Ops', '/meta/ads-ops'));
    }
    if (metaTrackingEnabled() && canViewMetaTracking(user)) {
      ads.push(child('ads-track', 'Meta Tracking', '/meta/tracking'));
    }
    if (metaIntelligenceEnabled() && canViewMetaIntelligence(user)) {
      ads.push(child('ads-intel', 'Meta Intelligence', '/meta/intelligence'));
    }
  }
  if (hasCap(user, 'crm_google_ads', 'view')) {
    ads.push(child('ads-google', 'Google Ads', '/google/google-ads'));
    ads.push(child('ads-cpl', 'Ads CPL', '/meta/ads-combined'));
  }
  if (hasCap(user, 'crm_zalo_ads', 'view')) {
    ads.push(child('ads-zalo', 'Zalo Ads', '/zalo/zalo-ads'));
    ads.push(child('ads-zalo-leads', 'Zalo Leads', '/zalo/leads'));
  }
  if (canMetaAds) {
    ads.push(child('ads-migrate', 'Meta Migration', '/meta/migration'));
  }
  if (ads.length) items.push(parent('ads', 'Quảng cáo', 'megaphone', ads));

  // 8. SEO / AEO
  const seo: NavChild[] = [];
  pushSeoChildren(user, seo);
  if (seo.length) items.push(parent('seo', 'SEO / AEO', 'seo', seo));

  // 9. Email Marketing
  const emailView = canViewEmailHub(user);
  const emailWrite = canWriteEmailHub(user);
  const emailDeliverability =
    hasCap(user, 'crm_email_mkt', 'deliverability') ||
    hasCap(user, 'crm_email_mkt', 'settings') ||
    hasCap(user, 'crm_agency', 'create');
  const emailReports =
    hasCap(user, 'crm_email_mkt', 'reports') || hasCap(user, 'crm_email_mkt', 'write');

  if (emailView && emailModuleEnabled()) {
    const email: NavChild[] = [child('email-hub', 'Hub', '/email/hub', emailPendingApprovals)];
    if (emailWrite) {
      email.push(child('email-campaigns', 'Chiến dịch', '/email/campaigns', emailPendingApprovals));
    }
    if (emailJourneysEnabled() && emailWrite) {
      email.push(child('email-journeys', 'Hành trình', '/email/journeys'));
    }
    email.push(child('email-contacts', 'Liên hệ', '/email/contacts'));
    if (emailWrite) {
      email.push(child('email-segments', 'Phân khúc', '/email/segments'));
      email.push(child('email-templates', 'Mẫu thư', '/email/templates'));
    }
    email.push(child('email-clients', 'Khách hàng Email', '/email/clients'));
    email.push(child('email-consent', 'Đồng thuận', '/email/consent'));
    email.push(child('email-supp', 'Suppression', '/email/suppression'));
    if (emailDeliverability) {
      email.push(child('email-deliv', 'Deliverability', '/email/deliverability'));
    }
    email.push(child('email-gov', 'Governance', '/email/governance'));
    if (emailReports) {
      email.push(child('email-reports', 'Báo cáo', '/email/reports'));
    }
    if (emailGateAEnabled() && canViewEmailGateA(user)) {
      email.push(child('email-gate', 'Gate A', '/email/gate-a'));
    }
    items.push(parent('email', 'Email Marketing', 'email', email));
  }

  // 10. Sản xuất
  const production: NavChild[] = [];
  if (hasCap(user, 'crm_board', 'view')) {
    production.push(child('prod-delivery', 'Triển khai dịch vụ', '/crm/service-delivery'));
  }
  if (shouldShowContentOsNav(user)) {
    production.push(child('prod-content', 'Content OS', '/crm/content-os'));
  }
  if (shouldShowCpNav(user)) {
    production.push(child('prod-cp', 'Creative OS', '/crm/creative-os'));
  }
  if (shouldShowImageSopNav(user, imageSopEnabled ?? false)) {
    production.push(child('prod-image', 'Image SOP', '/crm/creative-os/image'));
  }
  if (shouldShowMediaOsNav(user)) {
    production.push(child('prod-media', 'Media OS', '/crm/media-os'));
  }
  if (shouldShowVideoSopNav(user)) {
    production.push(child('prod-video', 'Video SOP', '/crm/video'));
  }
  if (hasCap(user, 'crm_board', 'view')) {
    production.push(child('prod-creatives', 'Creative Hub', '/crm/creatives'));
    production.push(child('prod-writes', 'Campaign Write', '/crm/campaign-writes'));
    production.push(child('prod-sop', 'Quy trình SOP', '/crm/sop'));
    production.push(child('prod-qa', 'Launch QA', '/crm/launch-qa'));
    if (isOpsDvFeEnabled()) {
      production.push(child('prod-ops-cat', 'Catalog DV21', '/crm/ops/catalog'));
      production.push(child('prod-ops-dash', 'Ops Dashboard', '/crm/ops/dashboard'));
      production.push(child('prod-ops-tasks', 'Ops tasks', '/crm/ops/my-tasks'));
      production.push(child('prod-ops-alerts', 'Ops alerts', '/crm/ops/alerts'));
    }
  }
  if (production.length) items.push(parent('production', 'Sản xuất', 'lifecycle', production));

  // 11. Kế hoạch — matrix AE = — (need research / mktplan / gtm, not board alone)
  const plan: NavChild[] = [];
  if (isMarketResearchFeEnabled() && hasCap(user, 'crm_research', 'view')) {
    plan.push(child('plan-research', 'Nghiên cứu thị trường', '/crm/research'));
    plan.push(child('plan-analytics', 'Phân tích nghiên cứu', '/crm/research/analytics'));
    if (shouldShowTaxonomyNav(hasCap(user, 'crm_research', 'configure'))) {
      plan.push(child('plan-tax', 'Taxonomy', '/crm/research/taxonomy'));
    }
  }
  if (hasCap(user, 'crm_mktplan', 'view')) {
    plan.push(child('plan-mkt', 'Kế hoạch marketing', '/crm/marketing-plan'));
  }
  if (canViewGtmDemos(user)) {
    plan.push(child('plan-gtm-demo', 'Demo GTM', '/crm/gtm/demos'));
  }
  if (canViewGtmCms(user)) {
    plan.push(child('plan-gtm-cms', 'CMS marketing', '/crm/gtm/cms'));
  }
  if (plan.length) items.push(parent('plan', 'Kế hoạch', 'search', plan));

  // 12. KPI Hub
  const kpi: NavChild[] = [];
  if (hasCap(user, 'crm_kpi_hub', 'view')) {
    kpi.push(child('kpi-exec', 'Executive', '/crm/kpi-hub/executive'));
    kpi.push(child('kpi-mkt', 'Marketing', '/crm/kpi-hub/marketing'));
    kpi.push(child('kpi-sales', 'Sales', '/crm/kpi-hub/sales'));
    kpi.push(child('kpi-home', 'Trang chủ Hub', '/crm/kpi-hub'));
    kpi.push(child('kpi-perf', 'Operating Dashboard', '/crm/kpi-hub/performance'));
    kpi.push(child('kpi-assign', 'Assignment Registry', '/crm/kpi-hub/performance/assignments'));
    kpi.push(child('kpi-score', 'Scorecard Builder', '/crm/kpi-hub/performance/scorecards'));
    kpi.push(child('kpi-checkin', 'Check-in Ritual', '/crm/kpi-hub/performance/check-ins'));
    kpi.push(child('kpi-mkt-os', 'Marketing OS', '/crm/kpi-hub/performance/marketing'));
    kpi.push(child('kpi-camp', 'Campaign Control', '/crm/kpi-hub/performance/campaigns'));
    kpi.push(child('kpi-crm-src', 'CRM Source Map', '/crm/kpi-hub/performance/crm-source'));
    kpi.push(child('kpi-snap', 'Snapshot Report', '/crm/kpi-hub/performance/reports'));
    kpi.push(child('kpi-policy', 'Policy', '/crm/kpi-hub/performance/settings'));
    kpi.push(child('kpi-war', 'War Room', '/crm/kpi-hub/service-kpi'));
    kpi.push(child('kpi-svc-tpl', 'Service KPI Template', '/crm/kpi-hub/service-templates'));
    kpi.push(child('kpi-inst', 'KPI Instances', '/crm/kpi-hub/instances'));
    kpi.push(child('kpi-meas', 'Measurement Plan', '/crm/kpi-hub/measurement'));
    kpi.push(child('kpi-track', 'Actual Tracking', '/crm/kpi-hub/tracking'));
    kpi.push(child('kpi-contract', 'KPI Contract & Risk', '/crm/kpi-hub/kpi-contracts'));
    kpi.push(child('kpi-recon', 'Quoted vs Actual', '/crm/kpi-hub/reconcile'));
    kpi.push(child('kpi-packs', 'Policy Pack', '/crm/kpi-hub/policy-packs'));
  }
  if (hasCap(user, 'crm_kpi_dictionary', 'view')) {
    kpi.push(child('kpi-dict', 'Dictionary', '/crm/kpi-hub/dictionary'));
  }
  if (hasCap(user, 'crm_kpi_hub_targets', 'view')) {
    kpi.push(child('kpi-targets', 'Target & Cảnh báo', '/crm/kpi-hub/targets'));
  }
  if (hasCap(user, 'crm_kpi_hub_sources', 'view')) {
    kpi.push(child('kpi-sources', 'Nguồn dữ liệu', '/crm/kpi-hub/sources'));
  }
  if (hasCap(user, 'crm_kpi_quality', 'view')) {
    kpi.push(child('kpi-quality', 'Data Quality', '/crm/kpi-hub/quality'));
  }
  if (hasCap(user, 'crm_kpi_hub_reports', 'view')) {
    kpi.push(child('kpi-reports', 'Báo cáo', '/crm/kpi-hub/reports'));
  }
  if (hasCap(user, 'crm_kpi_hub_settings', 'view')) {
    kpi.push(child('kpi-settings', 'Cài đặt', '/crm/kpi-hub/settings'));
  }
  if (kpi.length) items.push(parent('kpi', 'KPI Hub', 'kpi', kpi));

  // 13. Nhân sự
  const hr: NavChild[] = [];
  const canHrHub =
    hasCap(user, 'crm_staff_roster', 'view') ||
    hasCap(user, 'crm_payroll_salary', 'view') ||
    hasCap(user, 'crm_payroll_attendance', 'view') ||
    hasCap(user, 'crm_kpi_records', 'view') ||
    hasCap(user, 'crm_staff_kpi_am_sp', 'view') ||
    hasCap(user, 'crm_data_config', 'view');
  if (canHrHub) {
    hr.push(child('hr-hub', 'HR Hub', '/crm/hr'));
  }
  if (hasCap(user, 'crm_staff_roster', 'view')) {
    hr.push(child('hr-staff', 'Nhân viên', '/crm/staff'));
  }
  if (hasCap(user, 'crm_kpi_records', 'view')) {
    hr.push(child('hr-kpi', 'KPI', '/crm/kpi'));
  }
  if (hasCap(user, 'crm_staff_kpi_am_sp', 'view')) {
    hr.push(child('hr-am-sp', 'KPI AM/SP', '/crm/staff-kpi'));
  }
  if (
    hasCap(user, 'crm_payroll_salary', 'view') ||
    hasCap(user, 'crm_payroll_attendance', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view')
  ) {
    hr.push(child('hr-payroll', 'Chấm công & lương', '/crm/payroll'));
  }
  if (hasCap(user, 'crm_kpi_records', 'view')) {
    if (hasCap(user, 'crm_kpi_groups', 'view')) {
      hr.push(child('hr-kpi-groups', 'Nhóm KPI', '/crm/kpi/groups'));
    }
    if (hasCap(user, 'crm_kpi_types', 'view')) {
      hr.push(child('hr-kpi-types', 'Loại KPI', '/crm/kpi/types'));
    }
    if (winKpiSolutionEnabled()) {
      hr.push(child('hr-kpi-sol', 'KPI Solution', '/crm/kpi/solution'));
    }
    hr.push(child('hr-ai', 'AI Insights', '/crm/ai/insights'));
    hr.push(child('hr-coach', 'Coach digest', '/crm/ai/coach'));
  } else if (hasCap(user, 'crm_business_dashboard', 'view')) {
    hr.push(child('hr-coach', 'Coach digest', '/crm/ai/coach'));
  }
  if (hr.length) items.push(parent('hr', 'Nhân sự', 'staff', hr));

  // 14. Tài chính — not opened by crm_agency.view alone (AE matrix = —)
  const finance: NavChild[] = [];
  if (hasCap(user, 'crm_business_dashboard', 'view')) {
    finance.push(child('fin-dash', 'Dashboard kinh doanh', '/crm/business-dashboard'));
    finance.push(child('fin-forecast', 'Forecast', '/crm/forecast'));
    finance.push(child('fin-fin', 'Tài chính', '/crm/financials'));
    finance.push(child('fin-inv', 'Hóa đơn', '/crm/invoices'));
    finance.push(child('fin-nl', 'NL Analytics', '/crm/ai/query'));
  } else if (hasCap(user, 'ai_analytics', 'query')) {
    finance.push(child('fin-nl', 'NL Analytics', '/crm/ai/query'));
  }
  if (
    hasCap(user, 'crm_board', 'view') ||
    hasCap(user, 'ai_admin', 'view') ||
    hasCap(user, 'crm_am', 'view') ||
    hasCap(user, 'crm_am.finance', 'view') ||
    hasCap(user, 'crm_quote.finance', 'view')
  ) {
    finance.push(child('fin-health', 'CS Health', '/crm/health'));
  }
  if (hasCap(user, 'crm_owner_weekly_dashboard', 'view')) {
    finance.push(child('fin-weekly', 'BC tuần chủ DN', '/crm/owner-weekly'));
  }
  if (finance.length) items.push(parent('finance', 'Tài chính', 'finance', finance));

  // 15. CEO leaf
  if (ceoCommandEnabled() && canSeeCeoNav(user)) {
    items.push({ kind: 'leaf', id: 'ceo', label: 'CEO', href: '/crm/ceo', icon: 'dashboard' });
  }

  // 16. Báo cáo nội bộ
  const iwr: NavChild[] = [];
  if (canSeeIwrNav(user)) {
    iwr.push(child('iwr-home', 'Báo cáo công việc', '/crm/internal-reports'));
    iwr.push(child('iwr-inbox', 'Hộp thư', '/crm/internal-reports/inbox'));
    iwr.push(child('iwr-dash', 'Dashboard', '/crm/internal-reports/dashboards'));
    iwr.push(child('iwr-team', 'Cây kỳ', '/crm/internal-reports/team'));
    if (hasCap(user, 'iwr', 'schedule') || hasCap(user, 'iwr', 'manage')) {
      iwr.push(child('iwr-sched', 'Lịch BC', '/crm/internal-reports/schedules'));
    }
    if (hasCap(user, 'iwr', 'lists') || hasCap(user, 'iwr', 'manage')) {
      iwr.push(child('iwr-lists', 'DS phân phối', '/crm/internal-reports/lists'));
    }
    iwr.push(child('iwr-builder', 'Report builder', '/crm/internal-reports/builder'));
    if (hasCap(user, 'iwr', 'manage')) {
      iwr.push(child('iwr-tpl', 'Mẫu BC nội bộ', '/crm/internal-reports/templates'));
    }
    iwr.push(child('iwr-risk', 'Blocker & Rủi ro', '/crm/internal-reports/risks'));
  }
  if (iwr.length) items.push(parent('iwr', 'Báo cáo nội bộ', 'report', iwr));

  // 17. Tự động hóa
  const automation: NavChild[] = [];
  if (hasCap(user, 'automation_workflows', 'view')) {
    automation.push(child('auto-wf', 'Workflows', '/crm/automation'));
  }
  if (hasCap(user, 'playbooks', 'view')) {
    automation.push(child('auto-pb', 'Playbooks', '/crm/playbooks'));
  }
  if (canGenerateMktAiPlanner(user) || canApproveMktAiPlanner(user)) {
    automation.push(child('auto-dv', 'Playbook DV', '/crm/admin/mkt-ai/playbooks'));
  }
  if (automation.length) items.push(parent('automation', 'Tự động hóa', 'workflow', automation));

  // 18. Admin
  const adminLinks = buildAdminSidebarLinks(user);
  if (adminLinks.length) {
    items.push(
      parent(
        'admin',
        'Admin',
        'settings',
        adminLinks.map((l, i) => child(`admin-${i}`, l.label, l.href)),
      ),
    );
  }

  return collapseThinParents(items);
}
