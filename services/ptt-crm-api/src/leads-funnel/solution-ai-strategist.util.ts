import {
  emptySolutionAiSections,
  normalizeSolutionAiSections,
  SOLUTION_AI_SECTIONS,
  type AgencySolutionFacts,
  type SolutionAiSections,
} from './solution-ai-draft.util';

export const SOLUTION_STRATEGIST_MODEL = 'gpt-4o';
export const SOLUTION_STRATEGIST_MAX_TOKENS = 8000;

export type StrategistLlm = (input: {
  step: 'analysis' | 'write' | 'review';
  systemPrompt: string;
  userContent: string;
  maxTokens: number;
  temperature: number;
}) => Promise<{ parsed: Record<string, unknown>; stubMode: boolean; modelName: string }>;

type IndustryKind = 'spa' | 'interior' | 'general';
type ChannelKey = 'Facebook' | 'TikTok' | 'Google' | 'YouTube' | 'Website' | 'Zalo';

const CHANNEL_MATCH: Array<{ key: ChannelKey; re: RegExp }> = [
  { key: 'Facebook', re: /facebook|fanpage|meta ads|\bfb\b/i },
  { key: 'TikTok', re: /tiktok/i },
  { key: 'Google', re: /google|search ads|sem\b/i },
  { key: 'YouTube', re: /youtube/i },
  { key: 'Website', re: /website|web\b|landing/i },
  { key: 'Zalo', re: /zalo/i },
];

const EXAMPLE_BRAND = 'Ánh Dương Spa (VÍ DỤ)';

const INTERNAL_NOTE = /không bịa|không thêm giải thưởng|không phải số tiền mới|không đặt thêm kpi|không gán tên|sales gửi các mục|không điền số|không tự nghĩ|không phải cam kết|không phải dữ liệu crm|không thêm mỹ từ|xem khối |phục vụ mục tiêu khách đã ghi/i;

const SCALE_WEIGHT: Record<ChannelKey, number> = {
  Facebook: 35,
  Google: 25,
  TikTok: 20,
  YouTube: 12,
  Website: 8,
  Zalo: 10,
};

export function chosenChannels(channels: string | undefined): ChannelKey[] {
  const text = String(channels ?? '');
  const found = CHANNEL_MATCH.filter((row) => row.re.test(text)).map((row) => row.key);
  return found.length ? found : [];
}

export function industryKind(facts: AgencySolutionFacts): IndustryKind {
  const blob = [facts.industry, facts.need, facts.services, facts.audience, facts.companyName, facts.usp]
    .map((item) => String(item ?? ''))
    .join(' ')
    .toLowerCase();
  if (/spa|thẩm mỹ|tham my|làm đẹp|lam dep|skincare|clinic|massage|đá nóng|da nong/.test(blob)) return 'spa';
  if (/nội thất|noi that|interior|kiến trúc|kien truc|showroom|furniture|decor/.test(blob)) return 'interior';
  return 'general';
}

export function parseBudgetMillion(budget: string | undefined): { low: number; high: number } | null {
  const text = String(budget ?? '').replace(/\s+/g, '').replace(/–/g, '-').toLowerCase();
  const range = text.match(/(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)triệu/);
  if (range) {
    const low = Number(range[1].replace(',', '.'));
    const high = Number(range[2].replace(',', '.'));
    if (low > 0 && high >= low) return { low, high };
  }
  const one = text.match(/(\d+(?:[.,]\d+)?)triệu/);
  if (one) {
    const n = Number(one[1].replace(',', '.'));
    if (n > 0) return { low: n, high: n };
  }
  return null;
}

function triệu(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${String(rounded).replace('.', ',')} triệu`;
}

export function budgetShares(channels: ChannelKey[]): Array<{ channel: ChannelKey; pct: number }> {
  const picked = channels.map((channel) => ({ channel, weight: SCALE_WEIGHT[channel] }));
  const total = picked.reduce((sum, row) => sum + row.weight, 0) || 1;
  const raw = picked.map((row) => ({ channel: row.channel, pct: Math.round((row.weight / total) * 100) }));
  const drift = 100 - raw.reduce((sum, row) => sum + row.pct, 0);
  if (raw[0]) raw[0].pct += drift;
  return raw;
}

function moneyBand(pct: number, range: { low: number; high: number } | null): string {
  if (!range) return '[Cần bổ sung: Ngân sách]';
  return `${triệu((range.low * pct) / 100)}–${triệu((range.high * pct) / 100)}`;
}

function districts(facts: AgencySolutionFacts): string[] {
  const blob = [facts.audience, facts.callNotes, facts.need, facts.website].join(' ');
  const found = blob.match(/quận\s*\d+|quận\s*[a-zà-ỹ]+/gi) ?? [];
  const unique: string[] = [];
  for (const item of found) {
    const nice = item.replace(/\s+/g, ' ').replace(/^quận/i, 'Quận');
    if (!unique.some((row) => row.toLowerCase() === nice.toLowerCase())) unique.push(nice);
  }
  return unique.slice(0, 3);
}

function servicePhrase(facts: AgencySolutionFacts): string {
  const text = [facts.usp, facts.services, facts.need].join(' ');
  if (/đá nóng|da nong/i.test(text)) return 'đá nóng';
  if (/nội thất|thiết kế/i.test(text)) return 'thiết kế nội thất';
  const named = String(facts.usp || facts.services || '').split(/[,.]/)[0]?.trim();
  return named || 'dịch vụ chủ lực';
}

function gap(value: string | undefined, label: string): string {
  const text = String(value ?? '').trim();
  return text || `[Cần bổ sung: ${label}]`;
}

type ChannelCopy = {
  objective: string;
  format: string;
  kpi: string;
  targeting: string;
  ideas: string;
  cadence: string;
  close: string;
  optimize: string;
};

function channelCopy(channel: ChannelKey, facts: AgencySolutionFacts, kind: IndustryKind): ChannelCopy {
  const places = districts(facts);
  const where = places.length ? places.join(' và ') : 'khu vực khách đã nêu';
  const offer = servicePhrase(facts);
  const q1 = places[0] || 'quận khách phục vụ';
  const q2 = places[1] || q1;
  const audience = gap(facts.audience, 'Khách hàng mục tiêu');
  if (kind === 'spa') {
    const book: Record<ChannelKey, ChannelCopy> = {
      Facebook: {
        objective: 'Messages và Leads, kèm retargeting người đã nhắn hoặc xem 50% video.',
        format: 'Click-to-Messenger và lead ad, video 15 giây, carousel không gian.',
        kpi: 'Tỷ lệ hội thoại thành lịch hẹn.',
        targeting: `Bán kính 8–12 km quanh ${where}. Lookalike 1% từ danh sách khách đã đặt lịch. Retargeting: người nhắn trong 14 ngày nhưng chưa chốt giờ, và người xem video. Đối tượng gốc vẫn là ${audience}.`,
        ideas: `1) Hook: "Inbox spa sau 18h mà mãi chưa ai trả — lịch tối đã đầy chỗ khác." Headline: "${offer} ${q1}. Giữ đúng kỹ thuật viên bạn chọn." 2) Caption: "Đặt trước, nhận xác nhận lịch ngay trên Messenger." 3) Góc: cận cảnh khăn nóng và phòng trị liệu, chờ kho ảnh được phép trước khi đăng mặt người.`,
        cadence: '5 ngày/tuần, 1 video + 1 carousel. Đổi mẫu khi tần suất vượt 2,5.',
        close: 'Nút nhắn tin mở kịch bản đặt lịch. Ngoài 18:00, Messenger tự hỏi liệu trình, ngày và giờ, rồi giữ chỗ tạm.',
        optimize: 'Tắt mẫu có nhiều tin nhắn nhưng ít lịch. Đưa người đã nhắn sang tập retargeting riêng.',
      },
      TikTok: {
        objective: 'Reach và video views, sau đó Spark Ads cho clip kéo người vào inbox.',
        format: 'In-feed 12–20 giây, quay dọc, chữ trên hình. Spark Ads khi clip organic giữ người xem.',
        kpi: 'Tỷ lệ xem hết và số phiên inbox từ bio.',
        targeting: `Interest và hành vi: spa, thư giãn, chăm sóc cơ thể, xem video buổi tối. Không dùng bán kính lookalike của Facebook. Ưu tiên người ở ${where} đang lướt sau 18:00.`,
        ideas: `1) Chữ trên hình: "Đừng nhắn spa lúc 9 giờ tối nếu không ai trả." 2) Góc ASMR đá nóng, không nói giá. 3) Caption: "Kỹ thuật viên cố định. ${q1}. Bấm bio để giữ giờ."`,
        cadence: '4 clip/tuần. Chỉ đưa ngân sách vào clip xem hết cao.',
        close: 'Bio về trang đặt lịch. Bình luận được mời sang Messenger để chọn giờ.',
        optimize: 'Tắt clip bị vuốt trong 2 giây. Giữ clip có người hỏi giờ trống.',
      },
      Google: {
        objective: 'Search conversions: người đang tìm chỗ đặt lịch.',
        format: 'Quảng cáo tìm kiếm RSA, một nhóm từ khóa một trang đích.',
        kpi: 'Tỷ lệ click ra form đặt lịch và giá mỗi lịch.',
        targeting: `Từ khóa có chủ đích, không nhắm sở thích. Nhóm 1: "${offer} ${q1.toLowerCase()}", "spa ${offer} ${q2.toLowerCase()}". Nhóm 2: "massage body ${q2.toLowerCase()}", "spa thư giãn gần tôi". Phủ định: tuyển dụng, học nghề, thiết bị.`,
        ideas: `1) Tiêu đề: "${offer} ${q1} — đặt lịch trước". 2) Mô tả: "Kỹ thuật viên cố định. Mở đến 21:00." 3) Trang đích một liệu trình, form tên, số điện thoại, khung giờ.`,
        cadence: 'Rà từ khóa phủ định hai lần mỗi tuần.',
        close: 'Form trên trang đích. Tin nhắn xác nhận giờ gửi ngay, kể cả sau 18:00.',
        optimize: 'Tách từ khóa có chữ "đặt lịch" khỏi từ khóa chỉ tìm giá. Tăng nhóm nào ra lịch.',
      },
      YouTube: {
        objective: 'Video views và remarketing người đã xem.',
        format: 'In-stream 15 giây bỏ qua được, cộng Shorts cắt từ TikTok đang chạy tốt.',
        kpi: 'View rate và số người xem được đưa sang tìm kiếm hoặc Messenger.',
        targeting: `Custom intent theo đúng cụm "${offer} ${q1.toLowerCase()}" và "spa thư giãn". Remarketing người đã xem 50% video hoặc đã vào website. Không copy tập lookalike Facebook.`,
        ideas: `1) Mở đầu: tiếng khăn nóng, dòng chữ "${offer}, một kỹ thuật viên". 2) Không đọc bảng giá. 3) Kết: "Nhắn giờ bạn rảnh. Có người nhận lịch sau 18h."`,
        cadence: '2 video ngắn mỗi tuần.',
        close: 'Thẻ cuối video dẫn về trang đặt lịch. Người xem được nhắc lại bằng tin nhắn.',
        optimize: 'Cắt 3 giây đầu nếu view rate thấp. Đưa người xem sang nhóm tìm kiếm.',
      },
      Website: {
        objective: 'Điểm chuyển đổi: mọi quảng cáo đổ về một trang đặt lịch.',
        format: 'Landing một liệu trình, nút Messenger nổi, form 3 trường.',
        kpi: 'Tỷ lệ phiên ra lịch đã xác nhận.',
        targeting: 'Không mua thêm đối tượng. Trang nhận người từ Facebook, TikTok, Google và YouTube. Remarketing chỉ cho người đã vào trang mà chưa gửi form.',
        ideas: `1) Tiêu đề trang: "${offer}. Chọn giờ, giữ kỹ thuật viên." 2) Khối dưới nút: "Sau 18:00 vẫn nhận lịch tự động." 3) Ảnh không gian và giường, chờ kho ảnh được phép trước khi đăng mặt người.`,
        cadence: 'Một URL cho mỗi chiến dịch. Xem form mỗi tuần.',
        close: 'Gửi form là giữ chỗ tạm. Trang cảm ơn nói rõ tin nhắn xác nhận sẽ tới.',
        optimize: 'Nếu nhiều người mở form rồi thoát, để lại đúng 3 trường.',
      },
      Zalo: {
        objective: 'Chốt giờ sau khi kênh khác đã tạo hội thoại.',
        format: 'Zalo OA và tin xác nhận lịch.',
        kpi: 'Tỷ lệ hội thoại OA thành lịch xác nhận.',
        targeting: 'Không chạy quảng cáo lạnh. Chỉ người đã để lại số hoặc đã nhắn.',
        ideas: '1) Tin đầu: "Mình giữ giúp khung giờ tối nay." 2) Tin hai: hỏi liệu trình đá nóng hay nhu cầu khách vừa nêu. 3) Tin ba: xác nhận giờ và kỹ thuật viên.',
        cadence: 'Trả trong vài phút, cả sau 18:00 bằng kịch bản sẵn.',
        close: 'OA ghi nhận giờ, CRM nhận cùng nguồn.',
        optimize: 'Sửa câu hỏi nếu khách bỏ giữa chừng.',
      },
    };
    return book[channel];
  }
  const genericTarget =
    channel === 'Facebook'
      ? `Bán kính quanh ${where}, lookalike từ danh sách khách, retargeting người đã nhắn.`
      : channel === 'TikTok'
        ? `Interest và hành vi xem video, ưu tiên ${where}, không dùng lookalike Facebook.`
        : channel === 'Google'
          ? `Từ khóa "${offer} ${q1.toLowerCase()}" và nhóm có chữ đặt lịch.`
          : channel === 'YouTube'
            ? `Custom intent "${offer}" và remarketing người đã xem.`
            : channel === 'Website'
              ? 'Trang nhận traffic từ các kênh đã chọn, không mua đối tượng mới.'
              : 'Chỉ người đã để lại liên hệ.';
  return {
    objective:
      channel === 'Facebook'
        ? 'Messages và Leads.'
        : channel === 'TikTok'
          ? 'Reach và video views, rồi Spark Ads.'
          : channel === 'Google'
            ? 'Search conversions.'
            : channel === 'YouTube'
              ? 'Video views và remarketing.'
              : channel === 'Website'
                ? 'Điểm chuyển đổi của mọi quảng cáo.'
                : 'Chốt lịch trên hội thoại đã có.',
    format:
      channel === 'Google'
        ? 'RSA tìm kiếm.'
        : channel === 'TikTok'
          ? 'Video dọc 15 giây.'
          : channel === 'YouTube'
            ? 'In-stream 15 giây.'
            : channel === 'Website'
              ? 'Landing và form.'
              : 'Tin nhắn và video ngắn.',
    kpi:
      channel === 'Google'
        ? 'Tỷ lệ click thành form.'
        : channel === 'TikTok' || channel === 'YouTube'
          ? 'Tỷ lệ xem hết.'
          : 'Tỷ lệ hội thoại thành lịch.',
    targeting: `${genericTarget} Đối tượng khách đã nêu: ${audience}.`,
    ideas: `1) Headline gắn "${offer}". 2) Câu mở nói đúng tình huống khách đang gặp. 3) Lời kêu gọi chọn giờ, không gắn quà.`,
    cadence: 'Nhiều mẫu mỗi tuần, tắt mẫu không ra lịch.',
    close: 'Hội thoại được mời chọn giờ. Sau giờ làm, kịch bản sẵn trả tin.',
    optimize: 'Giữ mẫu nào ra lịch, tắt mẫu chỉ lấy click.',
  };
}

function bookingBlock(facts: AgencySolutionFacts): string {
  const offer = servicePhrase(facts);
  const incentive = /ưu đãi|giảm giá|voucher|tặng/i.test(
    [facts.need, facts.callNotes, facts.usp, facts.goal, facts.currentResults].join(' '),
  );
  return [
    '## Chuyển tin nhắn thành lịch hẹn',
    '',
    `Khách đang gặp đúng việc này: ${gap(facts.need, 'Nhu cầu cụ thể')} Hiện trạng: ${gap(facts.currentResults, 'Kết quả hiện tại')}.`,
    '',
    '| Việc | Cách làm |',
    '| Sau 18:00 | Messenger và Zalo OA tự trả trong vòng 5 phút: hỏi liệu trình, ngày, giờ. |',
    `| Kịch bản | "Bạn muốn ${offer} hay một liệu trình khác? Mình đọc 2 khung giờ còn trống." Giữ chỗ tạm, nhân sự xác nhận trước giờ mở cửa hôm sau nếu khách nhắn sau 21:00. |`,
    '| SLA | Tin đầu dưới 5 phút. Tin chốt giờ dưới 10 phút trong ca trực. |',
    `| Ưu đãi | ${incentive ? 'Dùng đúng chương trình khách đã nêu trong hồ sơ.' : 'Chưa có chương trình trong hồ sơ. Lịch được giữ bằng khung giờ và kỹ thuật viên, chưa gắn quà.'} |`,
    '| KPI | Tỷ lệ ra lịch = lịch xác nhận / hội thoại mới. |',
    '',
  ].join('\n');
}

export function buildChannelPlan(facts: AgencySolutionFacts): string {
  const channels = chosenChannels(facts.channels);
  if (!channels.length) {
    return ['[Cần bổ sung: Kênh muốn chạy và cách chốt đơn]', '', bookingBlock(facts)].join('\n');
  }
  const kind = industryKind(facts);
  const range = parseBudgetMillion(facts.budget);
  const shares = budgetShares(channels);
  const lines = [
    'Đề xuất của PTT',
    '',
    bookingBlock(facts),
    `Ngân sách truyền thông khách đã nêu: ${gap(facts.budget, 'Ngân sách')}.`,
    '',
    '| Kênh | Mục tiêu chiến dịch | Định dạng chính | KPI chính | % khi tăng tốc | Ngân sách/tháng |',
    ...shares.map((row) => {
      const copy = channelCopy(row.channel, facts, kind);
      return `| ${row.channel} | ${copy.objective} | ${copy.format} | ${copy.kpi} | ${row.pct}% | ${moneyBand(row.pct, range)} |`;
    }),
    '',
    'Tháng 1 là tháng thử: 50% ngân sách tháng cho Facebook, 30% cho Google, phần còn lại cho TikTok và YouTube. Tháng 2–3 mới chuyển sang cột % khi tăng tốc, nếu tỷ lệ tin nhắn thành lịch ổn định.',
    '',
  ];
  for (const row of shares) {
    const copy = channelCopy(row.channel, facts, kind);
    lines.push(
      `## ${row.channel}`,
      '',
      '| Hạng mục | Nội dung |',
      `| Vai trò trong funnel | ${copy.objective} |`,
      `| Đối tượng và cách nhắm | ${copy.targeting} |`,
      `| Mục tiêu chiến dịch | ${copy.objective} |`,
      `| Định dạng | ${copy.format} |`,
      `| Ý tưởng | ${copy.ideas} |`,
      `| Nhịp | ${copy.cadence} |`,
      `| Cách lấy lịch | ${copy.close} |`,
      `| Ngân sách | ${row.pct}% khi tăng tốc, tương đương ${moneyBand(row.pct, range)} mỗi tháng trên khoản khách đã nêu. Tháng 1 dùng tỷ lệ thử ở trên. |`,
      `| KPI | ${copy.kpi} |`,
      `| Tối ưu | ${copy.optimize} |`,
      '',
    );
  }
  lines.push(
    '## Các kênh tiếp tay nhau',
    '',
    'TikTok và YouTube lấy người xem. Người xem 50% video hoặc mở website được đưa sang Facebook (tin nhắn) và Google (tìm "đặt lịch").',
    'Mọi URL có UTM. Facebook dùng Pixel và CAPI. Website dùng GA4, sự kiện gửi form. Lead về một CRM, một hàng chờ lịch.',
    'Tham chiếu ngành: CPL spa tại thành phố lớn thường dao động rộng; chỉ dùng để đối chiếu sau khi có số của chính spa này.',
  );
  return lines.join('\n');
}

function assumptions(facts: AgencySolutionFacts): string {
  const items = [
    facts.competitors ? '' : 'Đối thủ',
    facts.metrics ? '' : 'Chỉ số đang theo dõi ngoài mục tiêu lịch',
    /ưu đãi|giảm|voucher|tặng/i.test([facts.need, facts.usp, facts.callNotes].join(' ')) ? '' : 'Chương trình ưu đãi đặt lịch',
    'Danh sách khách để tạo lookalike',
    'Kho ảnh được phép đăng',
    'Quyền Pixel, CAPI và GA4',
  ].filter(Boolean);
  return ['## Giả định & thông tin cần bổ sung', '', ...items.map((item) => `- [Cần bổ sung: ${item}]`)].join('\n');
}

export function buildLocalAgencySolution(facts: AgencySolutionFacts): { title: string; sections: SolutionAiSections } {
  const company = gap(facts.companyName, 'Tên công ty');
  const need = gap(facts.need, 'Nhu cầu cụ thể');
  const goal = gap(facts.goal, 'Mục tiêu đo được');
  const audience = gap(facts.audience, 'Khách hàng mục tiêu');
  const usp = gap(facts.usp, 'Điểm khác biệt');
  const current = gap(facts.currentResults, 'Kết quả hiện tại');
  const offer = servicePhrase(facts);
  const sections = emptySolutionAiSections();
  sections.executive_summary = [
    `${company} cần biến tin nhắn từ quảng cáo thành lịch đã xác nhận. Hiện ${current.toLowerCase().replace(/\.$/, '')}. Mục tiêu đã chốt: ${goal}.`,
    `Đề xuất của PTT: sau 18:00, Messenger và Zalo OA tự hỏi liệu trình và khung giờ, phản hồi đầu trong 5 phút. Facebook lấy hội thoại, Google bắt người đang tìm "${offer}", TikTok và YouTube đưa người xem sang hai kênh đó. Website là nơi chốt giờ.`,
    `Ngân sách dùng đúng khoản ${gap(facts.budget, 'Ngân sách')}. Tháng 1 dồn vào Facebook và Google. Tháng 2–3 mới mở tỷ lệ tăng tốc.`,
  ].join('\n\n');
  sections.client_context = [
    `- ${company}, ngành ${gap(facts.industry, 'Ngành')}.`,
    `- Liên hệ: ${gap(facts.contactName, 'Người liên hệ')}.`,
    `- Khách muốn gặp: ${audience}.`,
    `- Dịch vụ nêu trong hồ sơ: ${usp}.`,
    `- Việc đang kẹt: ${need}.`,
    `- Ghi chú vận hành: ${gap(facts.callNotes, 'Ghi chú cuộc gọi')}.`,
    '',
    'Hai nhóm để viết mẫu: người đặt lịch sau giờ làm, và người quay lại với cùng kỹ thuật viên. Nhóm này bám đúng độ tuổi và quận khách đã nêu.',
  ].join('\n');
  sections.strategy = [
    'Đề xuất của PTT',
    '',
    `Thông điệp: "${usp}. Chọn giờ, giữ đúng người làm."`,
    'Trọng tâm không phải tăng nhận diện chung. Trọng tâm là đường đi từ tin nhắn đến lịch: câu hỏi liệu trình, hai khung giờ, xác nhận.',
    'Facebook và Google mang việc chốt. TikTok và YouTube chỉ đưa người sang cuộc hội thoại đó.',
  ].join('\n');
  sections.objectives = [
    'Đề xuất của PTT',
    '',
    `Mục tiêu khách đã ghi: ${goal}.`,
    '',
    '| Chỉ số | Định nghĩa | Công cụ | Nhịp |',
    '| Tỷ lệ ra lịch | Lịch xác nhận chia cho hội thoại mới | CRM | Mỗi ngày |',
    '| Thời gian trả tin sau 18:00 | Phút từ tin khách đến tin đề xuất giờ | Messenger, Zalo OA | Mỗi ngày |',
    '| Giá mỗi lịch | Chi phí quảng cáo chia cho lịch xác nhận | Trình quản lý quảng cáo | Mỗi tuần |',
    '| Tỷ lệ xem hết | Lượt xem đủ trên lượt hiển thị video | TikTok, YouTube | Mỗi tuần |',
    '| Tỷ lệ form | Form gửi chia cho phiên trang đặt lịch | GA4 | Mỗi tuần |',
  ].join('\n');
  sections.channel_plan = buildChannelPlan(facts);
  sections.timeline = [
    'Đề xuất của PTT',
    '',
    `Khách muốn triển khai trong ${gap(facts.timeline, 'Thời điểm triển khai')}.`,
    '',
    '| Tuần | Bàn giao | Vai trò |',
    '| 1 | Kịch bản trả tin sau 18:00, form 3 trường, hàng chờ CRM | CRM |',
    '| 2 | Sáu mẫu: hai Facebook, hai TikTok, hai nhóm từ khóa | Content |',
    '| 3 | Bật Messenger và tìm kiếm dịch vụ chủ lực | Ads |',
    '| 4 | Đọc tỷ lệ tin nhắn thành lịch, sửa câu hỏi giờ | Strategist |',
    '| 5 | Spark Ads cho clip giữ người xem, lookalike nếu đã có danh sách | Ads |',
    '| 6 | Trang đích một liệu trình, UTM đủ nguồn | Content |',
    '| 7 | Tắt mẫu không ra lịch, giữ mẫu có người chọn giờ | Strategist |',
    '| 8 | Chuyển ngân sách sang tỷ lệ tăng tốc hoặc giữ tháng thử | AM |',
  ].join('\n');
  sections.budget = [
    'Đề xuất của PTT',
    '',
    `Khoản khách đã nêu: ${gap(facts.budget, 'Ngân sách')}. Số tiền từng kênh là % nhân với hai đầu khoản này.`,
    'Tháng 1: Facebook 50%, Google 30%, TikTok 15%, YouTube 5%.',
    'Tháng 2–3: dùng cột % khi tăng tốc trong bảng kênh.',
  ].join('\n');
  sections.team = [
    'Đề xuất của PTT',
    '',
    '| Vai trò | Việc trong kế hoạch này |',
    '| AM | Chốt khung giờ SLA với spa và lịch báo cáo tuần |',
    '| Strategist | Sửa kịch bản nếu tỷ lệ ra lịch giảm |',
    '| Content | Mẫu Facebook, TikTok, tiêu đề tìm kiếm |',
    '| Ads | Bật chiến dịch, tần suất, từ khóa phủ định |',
    '| CRM | Hội thoại, lịch xác nhận, nguồn UTM |',
  ].join('\n');
  sections.risks = [
    'Đề xuất của PTT',
    '',
    '| Rủi ro | Cách xử lý |',
    '| Inbox người thật ngắt sau 18:00 | Kịch bản tự động hỏi giờ, người trực xác nhận sáng hôm sau |',
    '| Ảnh liệu trình cũ | Dùng không gian và khăn nóng, chờ ảnh mới |',
    '| Chưa có pixel | Search và form vẫn chạy; retargeting bật sau khi gắn xong |',
    '| Nhiều tin nhắn, ít lịch | Đổi câu mở sang hai khung giờ cụ thể |',
  ].join('\n');
  sections.next_steps = [
    'Đề xuất của PTT',
    '',
    '| Việc | Vai trò |',
    '| Duyệt kịch bản 5 phút và 10 phút | AM cùng quản lý spa |',
    '| Gắn Pixel, CAPI, GA4 | Ads |',
    '| Viết 6 mẫu tuần 2 | Content |',
    '| Bật tháng thử Facebook và Google | Ads |',
    '| Báo cáo tỷ lệ ra lịch mỗi tuần | Strategist |',
    '',
    assumptions(facts),
  ].join('\n');
  return { title: `Solution PTT Ads — ${company}`, sections };
}

export function factSheet(facts: AgencySolutionFacts): string {
  const math = budgetShares(chosenChannels(facts.channels))
    .map((row) => `${row.channel} ${row.pct}% = ${moneyBand(row.pct, parseBudgetMillion(facts.budget))}`)
    .join('; ');
  return [
    `- Công ty: ${facts.companyName || '(không có)'}`,
    `- Ngành: ${facts.industry || '(không có)'}`,
    `- Liên hệ: ${facts.contactName || '(không có)'}`,
    `- Nhu cầu: ${facts.need || '(không có)'}`,
    `- Mục tiêu: ${facts.goal || '(không có)'}`,
    `- Kênh: ${facts.channels || '(không có)'}`,
    `- Đối tượng: ${facts.audience || '(không có)'}`,
    `- Điểm khác biệt: ${facts.usp || '(không có)'}`,
    `- Dịch vụ: ${facts.services || '(không có)'}`,
    `- Ngân sách: ${facts.budget || '(không có)'}`,
    `- Phép tính % trên ngân sách đã nêu: ${math || '(chưa đủ số)'}`,
    `- Thời điểm: ${facts.timeline || '(không có)'}`,
    `- Kết quả hiện tại: ${facts.currentResults || '(không có)'}`,
    `- Khó khăn: ${facts.difficulties || '(không có)'}`,
    `- Ghi chú: ${facts.callNotes || '(không có)'}`,
    `- Website: ${facts.website || '(không có)'}`,
  ].join('\n');
}

const CLIENT_RULES = [
  'Bạn là strategist của PTT Ads, viết proposal gửi khách.',
  'Tiếng Việt, câu ngắn, cụ thể, có headline trong ngoặc kép.',
  'Sự kiện của khách chỉ lấy từ hồ sơ. Thiếu thì để một lần trong mục Giả định & thông tin cần bổ sung, dạng [Cần bổ sung: …].',
  'Không viết vào bài các câu nội bộ: không bịa, không thêm giải thưởng, không phải số tiền mới, không đặt thêm KPI, không gán tên, Sales gửi các mục.',
  'Cụm "Đề xuất của PTT" chỉ đứng một lần ở đầu mỗi mục, không lặp từng dòng.',
  'Không chép ví dụ Ánh Dương. Không bịa ưu đãi, giảm giá, voucher nếu hồ sơ không có. Không đặt KPI dạng "tỷ lệ 30%".',
  'Kế hoạch kênh: mỗi kênh một cách nhắm khác nhau. Facebook là bán kính + lookalike + retargeting. TikTok là interest và hành vi. Google là từ khóa tiếng Việt. YouTube là custom intent và remarketing. Website là điểm đến.',
  'Bảng tổng không được dùng câu "Phục vụ mục tiêu khách đã ghi" hay "Xem khối".',
  'Nếu hồ sơ nói tin nhắn nhiều mà ít lịch, hoặc lễ tân chậm sau 18h, phải có mục Chuyển tin nhắn thành lịch hẹn: trả tin tự động, SLA 5 phút, kịch bản chọn giờ, KPI tỷ lệ ra lịch.',
  'Ngân sách: ghi % và khoảng tiền = % nhân hai đầu khoản khách đã nêu. Có tháng thử và tháng tăng tốc.',
  'Trả JSON.',
].join(' ');

const FEW_SHOT = `
VÍ DỤ CÁCH VIẾT — KHÔNG PHẢI HỒ SƠ KHÁCH. Không chép tên ${EXAMPLE_BRAND} hay số của ví dụ.
Facebook của một spa khác: mục tiêu Messages. Nhắm bán kính 10 km, lookalike khách cũ, retargeting người đã nhắn. Headline: "Giữ giường tối nay, trả tin trong 5 phút." KPI: tỷ lệ hội thoại thành lịch.
`.trim();

export function analysisPrompt(facts: AgencySolutionFacts): { systemPrompt: string; userContent: string } {
  return {
    systemPrompt: CLIENT_RULES + ' Bước phân tích. JSON: problem (string), booking_flow (string), message (string).',
    userContent: `${factSheet(facts)}\n\n${FEW_SHOT}`,
  };
}

export function writePrompt(facts: AgencySolutionFacts, analysis: string): { systemPrompt: string; userContent: string } {
  return {
    systemPrompt:
      CLIENT_RULES +
      ' Viết đủ executive_summary, client_context, objectives, strategy, channel_plan, timeline, budget, team, risks, next_steps. ' +
      'channel_plan là chuỗi markdown dài, không phải một đoạn. Bắt buộc: bảng | Kênh | Mục tiêu chiến dịch | Định dạng chính | KPI chính | % khi tăng tốc | Ngân sách/tháng | với một dòng mỗi kênh; ' +
      'dòng tiền = % nhân hai đầu khoản khách đã nêu; câu Tháng 1 (Facebook 50%, Google 30%, TikTok 15%, YouTube 5%). ' +
      'Rồi mục ## Chuyển tin nhắn thành lịch hẹn với bảng Việc | Cách làm: sau 18:00 tự trả 5 phút, kịch bản chọn giờ, SLA, ưu đãi chỉ khi hồ sơ có, KPI tỷ lệ ra lịch. ' +
      'Rồi ## từng kênh với bảng Hạng mục | Nội dung: vai trò, đối tượng riêng (Facebook bán kính + lookalike + retargeting; TikTok interest và hành vi; Google từ khóa tiếng Việt; YouTube custom intent và remarketing; Website là điểm đến), định dạng, 2–3 headline trong ngoặc kép, nhịp, cách lấy lịch, ngân sách, KPI, tối ưu. ' +
      'Cuối là các kênh tiếp tay: Pixel, CAPI, GA4, UTM. ' +
      'objectives là bảng | Chỉ số | Định nghĩa | Công cụ | Nhịp |. timeline là bảng | Tuần | Bàn giao | Vai trò |. ' +
      'next_steps kết bằng Giả định & thông tin cần bổ sung. JSON { title, sections } với mỗi section là một chuỗi.',
    userContent: `HỒ SƠ:\n${factSheet(facts)}\n\nPHÂN TÍCH:\n${analysis}\n\n${FEW_SHOT}`,
  };
}

export function reviewPrompt(
  facts: AgencySolutionFacts,
  sections: SolutionAiSections,
  issues: string[],
  raw = '',
): { systemPrompt: string; userContent: string } {
  return {
    systemPrompt:
      CLIENT_RULES +
      ' Đây là bước viết lại. Bản dưới bị loại vì các lỗi liệt kê. Viết lại toàn bộ 10 mục cho hết lỗi. Không rút ngắn kế hoạch kênh. ' +
      'JSON { title, sections }. sections là object, mỗi khóa executive_summary, client_context, objectives, strategy, channel_plan, timeline, budget, team, risks, next_steps có giá trị là một chuỗi markdown.',
    userContent: `LỖI CẦN XÓA:\n${issues.map((item) => `- ${item}`).join('\n')}\n\nHỒ SƠ:\n${factSheet(facts)}\n\nBẢN CŨ:\n${SOLUTION_AI_SECTIONS.map((row) => `## ${row.key}\n${sections[row.key]}`).join('\n\n')}${raw ? `\n\nJSON GỐC:\n${raw.slice(0, 12000)}` : ''}`,
  };
}

export function clientVoiceIssues(sections: SolutionAiSections, facts: AgencySolutionFacts): string[] {
  const issues: string[] = [];
  const blob = Object.values(sections).join('\n');
  if (INTERNAL_NOTE.test(blob)) issues.push('Còn câu nội bộ hoặc câu đệm trong bảng kênh.');
  const labels = (blob.match(/Đề xuất của PTT/g) ?? []).length;
  if (labels > 12) issues.push('Lặp "Đề xuất của PTT" quá dày. Chỉ để một lần ở đầu mỗi mục.');
  const channelPlan = sections.channel_plan || '';
  const channels = chosenChannels(facts.channels);
  for (const channel of channels) {
    if (!channelPlan.includes(channel)) issues.push(`Thiếu kênh ${channel}.`);
  }
  if (!/Chuyển tin nhắn thành lịch/.test(blob)) issues.push('Thiếu mục Chuyển tin nhắn thành lịch hẹn.');
  if (channels.includes('Facebook') && !/lookalike|bán kính/i.test(channelPlan)) {
    issues.push('Facebook chưa có bán kính hoặc lookalike.');
  }
  if (channels.includes('Google') && !/từ khóa|spa .*quận|quận \d/i.test(channelPlan)) {
    issues.push('Google chưa có nhóm từ khóa tiếng Việt.');
  }
  if (channels.includes('TikTok') && !/interest|hành vi|lướt/i.test(channelPlan)) {
    issues.push('TikTok chưa có cách nhắm theo interest hoặc hành vi.');
  }
  const repeated = repeatedLines(channelPlan);
  if (repeated.length) issues.push(`Câu lặp giữa các kênh: ${repeated[0]}`);
  const range = parseBudgetMillion(facts.budget);
  if (range && !/\d+(?:,\d+)?\s*triệu/.test(channelPlan)) {
    issues.push('Chưa có khoảng tiền từng kênh tính từ ngân sách khách.');
  }
  if (range && !/tháng 1/i.test(blob)) issues.push('Thiếu pha tháng thử và tháng tăng tốc.');
  if (!/\|/.test(channelPlan) || channelPlan.length < 1500) {
    issues.push('Kế hoạch kênh quá ngắn hoặc chưa có bảng. Viết bảng tổng và một bảng cho từng kênh.');
  }
  for (const channel of channels) {
    if (!new RegExp(`##\\s*${channel}`, 'i').test(channelPlan)) issues.push(`Thiếu mục ## ${channel}.`);
  }
  if (/tin nhắn|18h|18:00/i.test(String(facts.need ?? '')) && !/5 phút/.test(blob)) {
    issues.push('Thiếu SLA 5 phút trong mục chuyển tin nhắn thành lịch.');
  }
  if ((sections.executive_summary || '').length < 220) issues.push('Tóm tắt quá ngắn.');
  if ((sections.strategy || '').length < 180) issues.push('Chiến lược quá ngắn.');
  if (!/\|/.test(sections.timeline || '')) issues.push('Lộ trình chưa là bảng tuần.');
  if (!/\|/.test(sections.objectives || '')) issues.push('KPI chưa là bảng chỉ số / định nghĩa / công cụ / nhịp.');
  const offer = servicePhrase(facts);
  if (offer !== 'dịch vụ chủ lực' && !channelPlan.toLowerCase().includes(offer.toLowerCase())) {
    issues.push(`Kế hoạch kênh chưa gắn dịch vụ khách đã nêu (${offer}).`);
  }
  if (channels.includes('TikTok') && !/spark|reach|video view|lượt xem/i.test(channelPlan)) {
    issues.push('TikTok chưa có Reach, video views hoặc Spark Ads.');
  }
  if (channels.includes('YouTube') && !/custom intent|remarketing/i.test(channelPlan)) {
    issues.push('YouTube chưa có custom intent và remarketing.');
  }
  if (channels.includes('Website') && /\|\s*0%\s*\|/.test(channelPlan)) {
    issues.push('Website đang 0%. Ghi phần ngân sách đề xuất, không để 0%.');
  }
  if (!/tuần/i.test(sections.timeline || '') || !/vai trò|content|ads|strategist|\bam\b/i.test(sections.timeline || '')) {
    issues.push('Lộ trình phải là bảng tuần, bàn giao và vai trò.');
  }
  const quotes = channelPlan.match(/"[^"]{8,}"/g) ?? [];
  if (quotes.length < 2) issues.push('Thiếu headline tiếng Việt trong ngoặc kép cho từng kênh.');
  const promoInFacts = /ưu đãi|giảm giá|voucher|tặng/i.test(
    [facts.need, facts.usp, facts.callNotes, facts.goal, facts.currentResults].join(' '),
  );
  if (!promoInFacts && /ưu đãi hấp dẫn|ưu đãi đặc biệt|giảm giá|voucher/i.test(blob)) {
    issues.push('Đang bịa chương trình ưu đãi. Hồ sơ không có ưu đãi.');
  }
  if (/tỷ lệ[^|\n]{0,48}\d+\s*%/i.test(blob)) {
    issues.push('Đang đặt KPI số phần trăm. Chỉ dùng % cho phân bổ ngân sách.');
  }
  return issues;
}

function repeatedLines(text: string): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^\|\s*/, '').replace(/\s*\|$/, '').trim();
    if (line.length < 50 || line.startsWith('Hạng mục')) continue;
    counts.set(line, (counts.get(line) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([line]) => line);
}

export function channelPlanIsStrong(plan: string, channels: ChannelKey[]): boolean {
  const fake: SolutionAiSections = emptySolutionAiSections();
  fake.channel_plan = plan;
  fake.executive_summary = plan;
  fake.strategy = 'Đề xuất của PTT';
  fake.next_steps = '## Giả định & thông tin cần bổ sung';
  const issues = clientVoiceIssues(fake, {
    channels: channels.join(', '),
    budget: plan.includes('triệu') ? '50–100 triệu/tháng' : '',
    need: 'tin nhắn',
  });
  return issues.filter((item) => !item.startsWith('Thiếu pha') && !item.startsWith('Chưa có khoảng tiền')).length === 0
    && channels.every((channel) => plan.includes(channel));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function scrubExample(text: string): string {
  return text.split(EXAMPLE_BRAND).join('').replace(/Ánh Dương Spa/g, '').trim();
}

function vietnameseTitle(candidate: string, fallback: string): string {
  const text = scrubExample(candidate).trim();
  if (/[àáạảãâầăèéêìíòóôơùúưỳýđ]/i.test(text)) return text;
  return fallback;
}

function sectionsFromParsed(parsed: Record<string, unknown>, fallback: SolutionAiSections): SolutionAiSections {
  const incoming = normalizeSolutionAiSections(parsed.sections ?? parsed);
  const next = { ...fallback };
  for (const row of SOLUTION_AI_SECTIONS) {
    const text = scrubExample(incoming[row.key] || '');
    if (text.length > 80) next[row.key] = text;
  }
  return next;
}

export async function generateAgencySolution(
  facts: AgencySolutionFacts,
  llm?: StrategistLlm,
): Promise<{ title: string; sections: SolutionAiSections; modelName: string; stubMode: boolean }> {
  const local = buildLocalAgencySolution(facts);
  if (!llm) return { ...local, modelName: 'ptt-strategist-local', stubMode: true };
  try {
    const analysis = await llm({ step: 'analysis', ...analysisPrompt(facts), maxTokens: 2500, temperature: 0.4 });
    if (analysis.stubMode) return { ...local, modelName: analysis.modelName, stubMode: true };
    const draft = await llm({
      step: 'write',
      ...writePrompt(facts, JSON.stringify(analysis.parsed)),
      maxTokens: SOLUTION_STRATEGIST_MAX_TOKENS,
      temperature: 0.5,
    });
    let raw = JSON.stringify(draft.parsed);
    let sections = sectionsFromParsed(asRecord(draft.parsed), emptySolutionAiSections());
    let title = vietnameseTitle(String(asRecord(draft.parsed).title ?? ''), local.title);
    let modelName = draft.modelName;
    for (let pass = 0; pass < 3; pass += 1) {
      const issues = clientVoiceIssues(sections, facts);
      if (Object.values(sections).join('').trim().length < 200) {
        issues.push('Các mục đang trống. Viết lại đủ 10 chuỗi, không trả object lồng nhau.');
      }
      if (!issues.length) break;
      const review = await llm({
        step: 'review',
        ...reviewPrompt(facts, sections, issues, raw),
        maxTokens: SOLUTION_STRATEGIST_MAX_TOKENS,
        temperature: 0.3,
      });
      if (review.stubMode) break;
      raw = JSON.stringify(review.parsed);
      sections = sectionsFromParsed(asRecord(review.parsed), sections);
      title = vietnameseTitle(String(asRecord(review.parsed).title ?? ''), title);
      modelName = review.modelName || modelName;
    }
    return { title, sections, modelName, stubMode: false };
  } catch {
    return { ...local, modelName: 'ptt-strategist-local', stubMode: true };
  }
}
