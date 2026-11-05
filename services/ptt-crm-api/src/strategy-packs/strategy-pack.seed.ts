/** P11 industry/service pack seed. Text hints only — no client baseline/target/budget numbers. */

export type StrategyPackSeed = {
  key: string;
  name_vi: string;
  journey_focus: string;
  marketing_priorities: string;
  defaults_json: Record<string, unknown>;
};

function defaults(input: {
  journey_focus: string;
  marketing_priorities: string;
  metric_key: string;
  metric_label: string;
  unit: string;
  problems: string[];
  pillars: string[];
  segment: string;
  journey: Array<{ stage: string; customer_thinks: string; touchpoints: string; kpi_key: string }>;
  offers: Array<{ tier: string; goal: string; example: string; customer_action: string }>;
  channels: Array<{ channel_key: string; role: string; activities: string }>;
  pillarsContent: Array<{ name: string; purpose: string; examples: string }>;
  risks: Array<{ risk: string; early_signal: string; mitigation: string }>;
  roadmap: { d1_30: string[]; d31_60: string[]; d61_90: string[] };
}): Record<string, unknown> {
  return {
    schema_version: 1,
    north_star_suggestions: [
      { metric_key: input.metric_key, label: input.metric_label, unit: input.unit },
    ],
    executive_summary_hints: {
      typical_problems: input.problems,
      pillar_templates: input.pillars,
    },
    icp_hints: {
      segments: [{ name: input.segment, description: '', needs: '', barriers: '' }],
    },
    journey_stages: input.journey,
    offer_ladder_examples: input.offers,
    channel_mix_defaults: input.channels.map((row) => ({ ...row, budget_pct: null })),
    content_pillars: input.pillarsContent,
    sla_defaults: [{ lead_type: 'hot', response_target: 'trong giờ làm việc đã thống nhất', owner_role: 'am' }],
    retain_journeys: [],
    risk_defaults: input.risks,
    roadmap_90d_skeleton: input.roadmap,
    discovery_questions: [],
    section15: {
      journey_focus: input.journey_focus,
      marketing_priorities: input.marketing_priorities,
    },
  };
}

const SIX = (
  examples: Record<string, string>,
): Array<{ tier: string; goal: string; example: string; customer_action: string }> =>
  [
    ['free_value', 'Cho giá trị trước khi bán'],
    ['first_offer', 'Lần mua / trải nghiệm đầu'],
    ['core', 'Dịch vụ chính'],
    ['upsell', 'Nâng gói'],
    ['retain', 'Giữ chân'],
    ['referral', 'Giới thiệu'],
  ].map(([tier, goal]) => ({
    tier,
    goal,
    example: examples[tier] ?? '',
    customer_action: 'Liên hệ tư vấn',
  }));

export const INDUSTRY_PACK_SEEDS: StrategyPackSeed[] = [
  {
    key: 'spa_beauty',
    name_vi: 'Spa / Beauty',
    journey_focus: 'Nhận biết liệu trình → quan tâm kết quả → đặt lịch → trải nghiệm → tái mua và giới thiệu',
    marketing_priorities: 'Nội dung trước/sau, booking, CRM chăm sóc lại, membership',
    defaults_json: defaults({
      journey_focus: 'Nhận biết liệu trình → quan tâm kết quả → đặt lịch → trải nghiệm → tái mua và giới thiệu',
      marketing_priorities: 'Nội dung trước/sau, booking, CRM chăm sóc lại, membership',
      metric_key: 'completed_bookings',
      metric_label: 'Số lịch hoàn tất',
      unit: 'count',
      problems: ['Khách so sánh giá và kết quả', 'Tỷ lệ quay lại phụ thuộc chăm sóc sau liệu trình'],
      pillars: ['Bằng chứng kết quả', 'Đặt lịch dễ', 'Chăm sóc sau dịch vụ'],
      segment: 'Khách quan tâm liệu trình làm đẹp có lịch lặp',
      journey: [
        { stage: 'aware', customer_thinks: 'Mình cần cải thiện điều gì?', touchpoints: 'Mạng xã hội, review', kpi_key: 'reach' },
        { stage: 'book', customer_thinks: 'Đặt lịch có dễ không?', touchpoints: 'Inbox, hotline, web', kpi_key: 'booking' },
      ],
      offers: SIX({
        free_value: 'Tư vấn da / checklist chăm sóc tại nhà',
        first_offer: 'Buổi trải nghiệm liệu trình ngắn',
        core: 'Liệu trình chuẩn theo phác đồ',
        upsell: 'Gói kết hợp chăm sóc chuyên sâu',
        retain: 'Lịch nhắc tái khám / membership',
        referral: 'Ưu đãi khi giới thiệu bạn',
      }),
      channels: [
        { channel_key: 'facebook', role: 'Thu hút và nuôi dưỡng', activities: 'Before-after, FAQ, booking' },
        { channel_key: 'zalo', role: 'Chăm sóc và nhắc lịch', activities: 'Nhắc tái khám' },
      ],
      pillarsContent: [{ name: 'Kết quả thật', purpose: 'Chứng minh liệu trình', examples: 'Case trước/sau có đồng ý' }],
      risks: [{ risk: 'Kỳ vọng kết quả quá nhanh', early_signal: 'Phàn nàn sau buổi đầu', mitigation: 'Làm rõ lộ trình trước khi chốt' }],
      roadmap: { d1_30: ['Chốt ICP và offer chữ'], d31_60: ['Lịch nội dung và booking'], d61_90: ['CRM tái mua'] },
    }),
  },
  {
    key: 'retail_ecommerce',
    name_vi: 'Bán lẻ / TMĐT',
    journey_focus: 'Khám phá sản phẩm → so sánh → mua → đánh giá → mua lại',
    marketing_priorities: 'Catalog rõ, quảng cáo chuyển đổi, giữ chân, review',
    defaults_json: defaults({
      journey_focus: 'Khám phá sản phẩm → so sánh → mua → đánh giá → mua lại',
      marketing_priorities: 'Catalog rõ, quảng cáo chuyển đổi, giữ chân, review',
      metric_key: 'repeat_orders',
      metric_label: 'Đơn mua lại',
      unit: 'count',
      problems: ['Khách so sánh nhiều shop', 'Giỏ bỏ ngang'],
      pillars: ['Sản phẩm rõ lợi ích', 'Tin cậy giao hàng', 'Chăm sóc sau mua'],
      segment: 'Người mua online so sánh giá trị và đánh giá',
      journey: [{ stage: 'discover', customer_thinks: 'Món này có hợp không?', touchpoints: 'Ads, sàn, web', kpi_key: 'product_view' }],
      offers: SIX({
        free_value: 'Hướng dẫn chọn size / dùng thử nội dung',
        first_offer: 'Sản phẩm cửa ngõ',
        core: 'Dòng sản phẩm chủ lực',
        upsell: 'Combo / phụ kiện',
        retain: 'Nhắc mua lại theo chu kỳ dùng',
        referral: 'Chia sẻ mã giới thiệu',
      }),
      channels: [{ channel_key: 'meta_ads', role: 'Chuyển đổi', activities: 'Catalog ads' }],
      pillarsContent: [{ name: 'Cách dùng', purpose: 'Giảm phân vân', examples: 'Clip unbox, FAQ' }],
      risks: [{ risk: 'Quảng cáo không khớp tồn kho', early_signal: 'Hết hàng vẫn chạy ads', mitigation: 'Đối soát SKU trước khi bật' }],
      roadmap: { d1_30: ['Làm rõ ICP và offer'], d31_60: ['Kênh và nội dung'], d61_90: ['Luồng mua lại'] },
    }),
  },
  {
    key: 'real_estate',
    name_vi: 'Bất động sản',
    journey_focus: 'Tìm hiểu dự án → tham quan → đàm phán → chốt → chăm sóc sau bán',
    marketing_priorities: 'Nội dung dự án, lead đủ thông tin, sales kit, nurturing',
    defaults_json: defaults({
      journey_focus: 'Tìm hiểu dự án → tham quan → đàm phán → chốt → chăm sóc sau bán',
      marketing_priorities: 'Nội dung dự án, lead đủ thông tin, sales kit, nurturing',
      metric_key: 'qualified_site_visits',
      metric_label: 'Lượt tham quan đủ điều kiện',
      unit: 'count',
      problems: ['Lead thiếu nhu cầu thật', 'Chu kỳ quyết định dài'],
      pillars: ['Minh bạch sản phẩm', 'Hẹn tham quan', 'Theo dõi sau hẹn'],
      segment: 'Người đang tìm nhà / đầu tư và cần tham quan',
      journey: [{ stage: 'consider', customer_thinks: 'Dự án này có phù hợp không?', touchpoints: 'Bài viết, sales kit', kpi_key: 'qualified_lead' }],
      offers: SIX({
        free_value: 'Bảng so sánh khu vực dạng chữ',
        first_offer: 'Buổi tham quan có hướng dẫn',
        core: 'Sản phẩm phù hợp nhu cầu đã lọc',
        upsell: 'Gói nội thất / dịch vụ sau mua',
        retain: 'Cập nhật tiến độ cho khách đã cọc',
        referral: 'Giới thiệu người thân cùng nhu cầu',
      }),
      channels: [{ channel_key: 'facebook', role: 'Thu lead', activities: 'Nội dung dự án, form' }],
      pillarsContent: [{ name: 'Thật về dự án', purpose: 'Giảm kỳ vọng sai', examples: 'Mặt bằng, pháp lý tóm tắt' }],
      risks: [{ risk: 'Lead ảo từ form', early_signal: 'Hẹn nhiều, đến ít', mitigation: 'Gọi xác nhận nhu cầu trước hẹn' }],
      roadmap: { d1_30: ['ICP và thông điệp'], d31_60: ['Sales kit và lịch hẹn'], d61_90: ['Nurturing sau tham quan'] },
    }),
  },
  {
    key: 'education',
    name_vi: 'Giáo dục',
    journey_focus: 'Tìm hiểu chương trình → tư vấn → đăng ký → học → giới thiệu',
    marketing_priorities: 'Nội dung cho phụ huynh / học viên, funnel tư vấn, CRM follow-up',
    defaults_json: defaults({
      journey_focus: 'Tìm hiểu chương trình → tư vấn → đăng ký → học → giới thiệu',
      marketing_priorities: 'Nội dung cho phụ huynh / học viên, funnel tư vấn, CRM follow-up',
      metric_key: 'enrolled_learners',
      metric_label: 'Học viên nhập học',
      unit: 'count',
      problems: ['Phụ huynh cần bằng chứng đầu ra', 'Tư vấn không kịp sau để lại thông tin'],
      pillars: ['Lộ trình học rõ', 'Tư vấn đúng người', 'Chăm sóc trong khóa'],
      segment: 'Phụ huynh hoặc học viên đang so sánh chương trình',
      journey: [{ stage: 'consult', customer_thinks: 'Chương trình có hợp con / mình không?', touchpoints: 'Web, webinar, tư vấn', kpi_key: 'consult_held' }],
      offers: SIX({
        free_value: 'Buổi học thử hoặc bài đánh giá trình độ',
        first_offer: 'Khóa ngắn nhập môn',
        core: 'Chương trình chính',
        upsell: 'Luyện thêm / học liệu',
        retain: 'Lộ trình khóa tiếp',
        referral: 'Giới thiệu bạn học',
      }),
      channels: [{ channel_key: 'facebook', role: 'Thu hút tư vấn', activities: 'Nội dung đầu ra, form tư vấn' }],
      pillarsContent: [{ name: 'Đầu ra', purpose: 'Giảm phân vân', examples: 'Lộ trình, FAQ phụ huynh' }],
      risks: [{ risk: 'Hứa đầu ra không kiểm chứng', early_signal: 'Nội dung tuyệt đối hóa', mitigation: 'Chỉ dùng case đã được duyệt' }],
      roadmap: { d1_30: ['ICP và thông điệp tuyển sinh'], d31_60: ['Kịch bản tư vấn'], d61_90: ['CRM sau đăng ký'] },
    }),
  },
  {
    key: 'fnb',
    name_vi: 'F&B',
    journey_focus: 'Biết thương hiệu → ghé quán hoặc đặt món → trải nghiệm → quay lại',
    marketing_priorities: 'Nội dung món, hiện diện địa phương, membership, review',
    defaults_json: defaults({
      journey_focus: 'Biết thương hiệu → ghé quán hoặc đặt món → trải nghiệm → quay lại',
      marketing_priorities: 'Nội dung món, hiện diện địa phương, membership, review',
      metric_key: 'returning_guests',
      metric_label: 'Khách quay lại',
      unit: 'count',
      problems: ['Khách thử một lần rồi quên', 'Giờ cao điểm không đều'],
      pillars: ['Món signature', 'Lý do quay lại', 'Cộng đồng địa phương'],
      segment: 'Khách quanh điểm bán, thích trải nghiệm lặp',
      journey: [{ stage: 'visit', customer_thinks: 'Hôm nay ăn gì gần đây?', touchpoints: 'Maps, mạng xã hội, giao hàng', kpi_key: 'visit' }],
      offers: SIX({
        free_value: 'Gợi ý combo theo khẩu vị',
        first_offer: 'Món cửa ngõ để thử',
        core: 'Set món chủ lực',
        upsell: 'Món kèm / đồ uống',
        retain: 'Thẻ quen hoặc nhắc món yêu thích',
        referral: 'Mời bạn cùng order',
      }),
      channels: [{ channel_key: 'google_maps', role: 'Hiện diện địa phương', activities: 'Ảnh món, giờ mở cửa, review' }],
      pillarsContent: [{ name: 'Món thật', purpose: 'Kéo lượt ghé', examples: 'Ảnh món, hậu trường bếp' }],
      risks: [{ risk: 'Nội dung không khớp món đang bán', early_signal: 'Khách đến không thấy món ads', mitigation: 'Đối soát menu trước khi đăng' }],
      roadmap: { d1_30: ['Món chủ lực và ICP'], d31_60: ['Lịch nội dung địa phương'], d61_90: ['Cơ chế quay lại'] },
    }),
  },
  {
    key: 'b2b_services',
    name_vi: 'B2B dịch vụ',
    journey_focus: 'Nhận ra vấn đề → đánh giá năng lực → nhận đề xuất → ký → mở rộng',
    marketing_priorities: 'Insight ngành, case study, CRM theo deal, nuôi dưỡng người quyết định',
    defaults_json: defaults({
      journey_focus: 'Nhận ra vấn đề → đánh giá năng lực → nhận đề xuất → ký → mở rộng',
      marketing_priorities: 'Insight ngành, case study, CRM theo deal, nuôi dưỡng người quyết định',
      metric_key: 'qualified_opportunities',
      metric_label: 'Cơ hội đủ điều kiện',
      unit: 'count',
      problems: ['Chu kỳ bán dài', 'Nhiều người cùng quyết định'],
      pillars: ['Chứng minh năng lực', 'Đề xuất sát vấn đề', 'Theo dõi sau họp'],
      segment: 'Doanh nghiệp có người phụ trách đang tìm đối tác',
      journey: [{ stage: 'evaluate', customer_thinks: 'Đơn vị này làm được việc của mình không?', touchpoints: 'Insight, họp, proposal', kpi_key: 'meeting' }],
      offers: SIX({
        free_value: 'Bản chẩn đoán vấn đề ngắn',
        first_offer: 'Hạng mục pilot có phạm vi rõ',
        core: 'Gói triển khai chính',
        upsell: 'Hạng mục mở rộng sau pilot',
        retain: 'Báo cáo định kỳ và gia hạn',
        referral: 'Giới thiệu đơn vị cùng ngành',
      }),
      channels: [{ channel_key: 'linkedin', role: 'Tiếp cận người quyết định', activities: 'Insight, case' }],
      pillarsContent: [{ name: 'Case có bối cảnh', purpose: 'Giảm rủi ro cảm nhận', examples: 'Bài vấn đề → cách làm → kết quả định tính' }],
      risks: [{ risk: 'Hứa số kết quả khi chưa đo', early_signal: 'Proposal có KPI không nguồn', mitigation: 'Để TBD đến khi có baseline' }],
      roadmap: { d1_30: ['ICP và vấn đề'], d31_60: ['Case và kịch bản họp'], d61_90: ['CRM sau đề xuất'] },
    }),
  },
  {
    key: 'auto_detailing',
    name_vi: 'Auto detailing',
    journey_focus: 'Thấy xe cần bảo vệ hoặc làm đẹp → tìm studio → đặt lịch → giao xe → gói bảo dưỡng định kỳ hoặc giới thiệu',
    marketing_priorities: 'Before-after có đồng ý, booking lịch, gói ceramic/PPF mô tả bằng chữ, CRM nhắc bảo dưỡng, referral',
    defaults_json: defaults({
      journey_focus: 'Thấy xe cần bảo vệ hoặc làm đẹp → tìm studio → đặt lịch → giao xe → gói bảo dưỡng định kỳ hoặc giới thiệu',
      marketing_priorities: 'Before-after có đồng ý, booking lịch, gói ceramic/PPF mô tả bằng chữ, CRM nhắc bảo dưỡng, referral',
      metric_key: 'completed_detail_bookings',
      metric_label: 'Số booking detailing hoàn tất',
      unit: 'count',
      problems: ['Khách không phân biệt rửa xe và phủ bảo vệ', 'Lịch xưởng đầy nhưng lead không được gọi lại'],
      pillars: ['Bằng chứng mặt sơn', 'Đặt lịch rõ quy trình', 'Nhắc bảo dưỡng'],
      segment: 'Chủ xe muốn giữ lớp sơn và sẵn sàng đặt lịch studio',
      journey: [
        { stage: 'aware', customer_thinks: 'Xe mình có cần phủ bảo vệ không?', touchpoints: 'Before-after, Maps, reel', kpi_key: 'profile_visit' },
        { stage: 'book', customer_thinks: 'Studio nào làm đúng xe mình?', touchpoints: 'Inbox, gọi, form lịch', kpi_key: 'booking' },
        { stage: 'return', customer_thinks: 'Khi nào nên bảo dưỡng lại?', touchpoints: 'CRM, Zalo', kpi_key: 'repeat_booking' },
      ],
      offers: SIX({
        free_value: 'Checklist kiểm tra lớp sơn tại chỗ',
        first_offer: 'Gói rửa và xử lý cơ bản để khách thấy quy trình',
        core: 'Gói detailing hoặc phủ bảo vệ mô tả theo hạng xe, chưa gắn số tiền',
        upsell: 'Hạng mục ceramic hoặc PPF vùng nguy cơ, mô tả bằng chữ',
        retain: 'Lịch nhắc bảo dưỡng định kỳ',
        referral: 'Chủ xe giới thiệu bạn cùng garage hoặc hội xe',
      }),
      channels: [
        { channel_key: 'facebook', role: 'Thu hút trước-sau', activities: 'Reel mặt sơn, FAQ thời gian xe nằm xưởng' },
        { channel_key: 'google_maps', role: 'Khách tìm studio gần', activities: 'Ảnh xưởng, giờ nhận xe' },
        { channel_key: 'zalo', role: 'Chốt lịch và nhắc bảo dưỡng', activities: 'Xác nhận giờ nhận xe' },
      ],
      pillarsContent: [
        { name: 'Mặt sơn thật', purpose: 'Phân biệt detailing với rửa xe', examples: 'Before-after có phép chủ xe' },
        { name: 'Quy trình nhận xe', purpose: 'Giảm lo xe nằm xưởng', examples: 'Checklist bàn giao' },
      ],
      risks: [
        { risk: 'Hứa độ bền phủ khi chưa khảo sát sơn', early_signal: 'Nội dung ghi mốc thời gian tuyệt đối', mitigation: 'Ghi điều kiện xe và để số đo là TBD' },
      ],
      roadmap: {
        d1_30: ['Chốt ICP chủ xe và thông điệp khác rửa xe'],
        d31_60: ['Lịch before-after và kịch bản đặt lịch'],
        d61_90: ['CRM nhắc bảo dưỡng và giới thiệu'],
      },
    }),
  },
  {
    key: 'generic',
    name_vi: 'Đa ngành (fallback)',
    journey_focus: 'Nhận biết → cân nhắc → chuyển đổi → giữ chân',
    marketing_priorities: 'Thông điệp, kênh chính, CRM, đo lường để trống đến khi có nguồn',
    defaults_json: defaults({
      journey_focus: 'Nhận biết → cân nhắc → chuyển đổi → giữ chân',
      marketing_priorities: 'Thông điệp, kênh chính, CRM, đo lường để trống đến khi có nguồn',
      metric_key: 'primary_conversions',
      metric_label: 'Chuyển đổi chính',
      unit: 'count',
      problems: ['Chưa chốt một chỉ số north star có nguồn'],
      pillars: ['Khách hàng ưu tiên', 'Thông điệp', 'Kênh và chăm sóc'],
      segment: 'Nhóm khách ưu tiên chưa đặt tên ngành',
      journey: [{ stage: 'aware', customer_thinks: 'Mình có cần dịch vụ này không?', touchpoints: 'Kênh chính', kpi_key: 'response' }],
      offers: SIX({
        free_value: 'Tài liệu hoặc tư vấn ngắn',
        first_offer: 'Gói bắt đầu',
        core: 'Gói chính',
        upsell: 'Hạng mục thêm',
        retain: 'Chăm sóc sau mua',
        referral: 'Giới thiệu',
      }),
      channels: [{ channel_key: 'owned', role: 'Kênh chính chưa chốt', activities: 'Nội dung và điểm liên hệ' }],
      pillarsContent: [{ name: 'Vấn đề khách', purpose: 'Làm rõ thông điệp', examples: 'Câu hỏi khám phá' }],
      risks: [{ risk: 'Điền số khi chưa có baseline', early_signal: 'File có tiền hoặc % không nguồn', mitigation: 'Giữ null + TBD' }],
      roadmap: { d1_30: ['Chốt vấn đề và ICP'], d31_60: ['Thông điệp và kênh'], d61_90: ['Cách giữ chân'] },
    }),
  },
];

export const SERVICE_PACK_SEEDS: Array<{
  key: string;
  name_vi: string;
  defaults_json: Record<string, unknown>;
}> = [
  {
    key: 'growth_full',
    name_vi: 'Growth đầy đủ',
    defaults_json: {
      schema_version: 1,
      scope: 'Chiến lược tăng trưởng đủ khối: nghiên cứu, thông điệp, offer, kênh, vận hành, ngân sách để trống đến khi có nguồn.',
      includes: ['research', 'positioning', 'offer_ladder', 'channel_mix', 'crm', 'roadmap'],
    },
  },
  {
    key: 'ads_crm',
    name_vi: 'Ads + CRM',
    defaults_json: {
      schema_version: 1,
      scope: 'Tập trung kênh quảng cáo và chăm sóc lead/khách. Ngân sách và CPL để null cho đến khi có số đã biết nguồn.',
      includes: ['channel_mix', 'ops_checklist', 'retain_journeys'],
    },
  },
];
