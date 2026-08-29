const MONEY_PATTERN =
  /(?<![\p{L}\d])\d[\d.,]*\s*(?:tr|triệu|tỉ|tỷ|k|vnđ|vnd|đồng|đ)(?![\p{L}])/giu;

const ALLOWED_MONEY_CITATION_KINDS = new Set(['pricing', 'qa', 'case']);

export function assertNoInventedMoney(
  reply: string,
  citations: Array<{ kind: string }>,
): boolean {
  if (!MONEY_PATTERN.test(reply)) return true;
  MONEY_PATTERN.lastIndex = 0;
  return citations.some((c) => ALLOWED_MONEY_CITATION_KINDS.has(String(c.kind ?? '').trim()));
}

export function stripInventedMoney(reply: string): string {
  return String(reply ?? '')
    .replace(MONEY_PATTERN, '[số đã ẩn]')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function buildKitLlmSystemPrompt(): string {
  return `Bạn là trợ lý Sales Kit nội bộ trên phiên Intake CRM.
Quy tắc bắt buộc:
- Cấm bịa số tiền, KPI, case study hoặc cam kết không có trong citation.
- Mỗi câu trả lời một ý rõ ràng; không lan man.
- Không draft tin nhắn/email outbound gửi khách — chỉ gợi ý nội bộ cho rep.
- Mask SĐT / số điện thoại khách (ví dụ ***1234); không lặp lại PII đầy đủ.
- Chỉ dùng thông tin từ excerpt citation được cung cấp; không suy diễn ngoài excerpt.
- Nếu thiếu giá/case trong citation, nói "hỏi kho" hoặc hỏi ngân sách — không tự đưa mức giá.
Trả JSON theo schema user message.`;
}
