import type { RawLeadHarvestJobRow } from './raw-lead-harvest.types';

export function buildDiscoverPrompt(job: RawLeadHarvestJobRow): string {
  const sources = job.sources_json.map((s) => `${s.label} (${s.key})`).join(', ');
  const channels =
    job.channels_json.length > 0
      ? job.channels_json.map((s) => `${s.label} (${s.key})`).join(', ')
      : '(không thu hẹp kênh)';
  return [
    'Bạn là trợ lý nghiên cứu thị trường Việt Nam.',
    `Tìm tối đa ${job.target_count} doanh nghiệp khớp ICP:`,
    `- Ngành: ${job.industry_label}`,
    `- Chức danh đối tượng: ${job.job_title_label}`,
    `- Địa bàn: ${job.province_name}${job.ward_name ? `, ${job.ward_name}` : ''}`,
    `- Nguồn được phép/ưu tiên: ${sources}`,
    `- Kênh: ${channels}`,
    job.notes ? `- Ghi chú ICP: ${job.notes}` : '',
    '',
    'QUY TẮC CỨNG:',
    '- Cấm bịa SĐT/email/MST. Không có trên nguồn thì để null.',
    '- Mỗi công ty phải có evidence_url thật (website / Google Maps / trang vàng / directory).',
    '- Không dùng URL trang tìm kiếm (google.com/search...).',
    '- evidence_snippet phải chứa tên công ty hoặc contact đã trích.',
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
  return [
    'Chỉ extract thông tin liên hệ CÓ MẶT trên trang/nguồn đã cho. Không bịa.',
    `Công ty: ${input.company_name}`,
    `Evidence URL: ${input.evidence_url}`,
    `Địa bàn filter: ${input.job.province_name}`,
    `Chức danh ưu tiên: ${input.job.job_title_label}`,
    'Trả JSON array 1 phần tử cùng schema harvest (company_name, address, phone, email, contact_title, website, evidence_url, evidence_snippet, confidence, field_sources).',
    'Nếu không thấy SĐT/email trên nguồn → null.',
  ].join('\n');
}

export function buildCriticPrompt(leadsJson: string): string {
  return [
    'Bạn là critic. Đánh dấu dòng thiếu căn cứ (thiếu evidence, SĐT/email khả năng bịa, tên generic).',
    'Input JSON array:',
    leadsJson,
    'Trả JSON array các index (0-based) cần DROP, ví dụ [0,2]. Chỉ JSON array số.',
  ].join('\n');
}
