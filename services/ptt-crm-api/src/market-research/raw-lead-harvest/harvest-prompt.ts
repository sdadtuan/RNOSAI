import type { RawLeadHarvestJobRow } from './raw-lead-harvest.types';

export function buildDiscoverPrompt(job: RawLeadHarvestJobRow): string {
  const sources = job.sources_json.map((s) => `${s.label} (${s.key})`).join(', ');
  const channels =
    job.channels_json.length > 0
      ? job.channels_json.map((s) => `${s.label} (${s.key})`).join(', ')
      : '(không thu hẹp kênh)';
  const titleLine =
    !job.job_title_key || job.job_title_key === 'all'
      ? '- Chức danh đối tượng: Tất cả (không giới hạn)'
      : `- Chức danh đối tượng: ${job.job_title_label}`;
  const geoLine =
    !job.province_code || job.province_code === 'all'
      ? '- Địa bàn: Tất cả (toàn quốc / không giới hạn tỉnh)'
      : `- Địa bàn: ${job.province_name}${job.ward_name ? `, ${job.ward_name}` : ''}`;
  const marketingLines =
    job.mode === 'marketing'
      ? [
          '',
          'CHẾ ĐỘ MARKETING (ưu tiên liên hệ AM):',
          '- Ưu tiên evidence từ website doanh nghiệp / Facebook page / Google Maps khớp ngành.',
          '- BẮT BUỘC cố lấy ít nhất 1 trong: SĐT (di động 09x/03x… hoặc bàn) HOẶC email công khai trên nguồn.',
          '- Ưu tiên trang /lien-he, /contact, Google Maps (số điện thoại hiện rõ), fanpage có "Gọi điện".',
          '- Email công khai AM dùng gửi marketing — không cần verify trước; vẫn cấm bịa.',
        ]
      : [];
  return [
    'Bạn là trợ lý nghiên cứu thị trường Việt Nam.',
    `Tìm tối đa ${job.target_count} doanh nghiệp khớp ICP:`,
    `- Ngành: ${job.industry_label}`,
    titleLine,
    geoLine,
    `- Nguồn được phép/ưu tiên: ${sources}`,
    `- Kênh: ${channels}`,
    job.notes ? `- Ghi chú ICP: ${job.notes}` : '',
    ...marketingLines,
    '',
    'QUY TẮC CỨNG:',
    '- Cấm bịa SĐT/email/MST. Không có trên nguồn thì để null.',
    '- Ưu tiên SME / cơ sở độc lập địa phương. Tránh chuỗi quốc gia / bệnh viện thẩm mỹ lớn / brand marketplace (vd. Hasaki, Kangnam, DIVA chain) trừ khi ICP ghi rõ.',
    '- Mỗi công ty phải có evidence_url thật (website / Google Maps / Facebook / trang vàng / directory).',
    '- Không dùng URL trang tìm kiếm (google.com/search...).',
    '- evidence_snippet phải chứa tên công ty hoặc contact đã trích.',
    '- Ưu tiên lead CÓ SĐT hoặc email trên nguồn; thiếu cả hai chỉ trả khi không còn ứng viên tốt hơn.',
    '- discovered_via_source_key phải là một trong các source key đã cho (hoặc null).',
    '',
    'Trả về ĐÚNG một JSON array (không markdown), mỗi phần tử:',
    JSON.stringify({
      company_name: 'string',
      address: 'string|null',
      phone: 'string|null',
      email: 'string|null',
      contact_title: 'string|null',
      website: 'string|null',
      evidence_url: 'string',
      evidence_snippet: 'string',
      discovered_via_source_key: 'string|null',
      confidence: 0.0,
      field_sources: { phone: 'evidence_url|null', email: 'evidence_url|null', address: 'evidence_url|null' },
    }),
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildExtractPrompt(input: {
  company_name: string;
  evidence_url: string;
  job: RawLeadHarvestJobRow;
}): string {
  const geo =
    !input.job.province_code || input.job.province_code === 'all'
      ? 'Tất cả (không giới hạn tỉnh)'
      : input.job.province_name;
  const title =
    !input.job.job_title_key || input.job.job_title_key === 'all'
      ? 'Tất cả'
      : input.job.job_title_label;
  const marketingExtra =
    input.job.mode === 'marketing'
      ? [
          'Ưu tiên trích: SĐT di động hoặc bàn; email công khai (AM marketing — không bịa).',
          'Nếu trang chủ không có SĐT/email, ưu tiên trích từ /lien-he hoặc /contact nếu URL đó là evidence_url.',
          'Nếu trang là website/Facebook của DN trong ngành → lấy mọi hotline/liên hệ hiện trên trang.',
        ]
      : [
          'Nếu trang chủ không có SĐT/email nhưng evidence là website DN, ghi rõ trong evidence_snippet những gì nhìn thấy.',
        ];
  return [
    'Chỉ extract thông tin liên hệ CÓ MẶT trên trang/nguồn đã cho. Không bịa.',
    `Công ty: ${input.company_name}`,
    `Evidence URL: ${input.evidence_url}`,
    `Địa bàn filter: ${geo}`,
    `Chức danh ưu tiên: ${title}`,
    ...marketingExtra,
    'Trả JSON array 1 phần tử cùng schema harvest (company_name, address, phone, email, contact_title, website, evidence_url, evidence_snippet, confidence, field_sources).',
    'Nếu không thấy SĐT/email trên nguồn → null.',
  ].join('\n');
}

export function buildCriticPrompt(leadsJson: string): string {
  return [
    'Bạn là critic quality cho raw lead harvest Việt Nam.',
    'Input JSON array (index = vị trí phần tử):',
    leadsJson,
    '',
    'QUY TẮC NỚI (quan trọng):',
    '- Có company_name rõ + evidence_url thật (website/Maps/directory) → KHÔNG reject chỉ vì thiếu SĐT/email.',
    '  Thiếu contact → class=weak_contact (giữ lại để staff review).',
    '- Chỉ dùng likely_fabricated khi SĐT/email trông bịa hoặc không khớp evidence.',
    '- generic_name khi tên công ty quá generic (vd. "Công ty TNHH", "Spa gần đây").',
    '- weak_evidence khi URL là trang tìm kiếm / không phải trang DN.',
    '- keep khi ổn hoặc chỉ thiếu vài field không nghiêm trọng.',
    '',
    'Trả ĐÚNG một JSON array object (không markdown), mỗi phần tử:',
    JSON.stringify({
      index: 0,
      class: 'keep|weak_contact|weak_evidence|generic_name|likely_fabricated|other',
      reason: 'short vi/en',
    }),
    'Phải cover đủ mọi index 0..n-1. Không trả array số thuần [0,2].',
  ].join('\n');
}
