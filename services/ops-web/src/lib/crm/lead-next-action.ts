export type NextActionKind =
  | 'edit_contact'
  | 'save_company_run_prep'
  | 'select_entity'
  | 'wait_prep'
  | 'open_cockpit'
  | 'call_now'
  | 'copy_script'
  | 'complete_b2'
  | 'open_intake'
  | 'copy_m2_brief'
  | 'open_consult'
  | 'open_deal_room'
  | 'apply_offer_ladder'
  | 'submit_debrief'
  | 'add_activity';

export type LeadNextAction = {
  rule: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  title_vi: string;
  body_vi: string;
  primary: { label_vi: string; action: NextActionKind };
  secondary: Array<{ label_vi: string; action: NextActionKind }>;
};

export type LeadNextActionInput = {
  lmpEnabled: boolean;
  dealRoomEnabled: boolean;
  phone: string;
  email: string;
  leadStatus: string;
  b2Complete: boolean;
  presalesStage: string | null;
  prepStatus: string | null;
  prepStage: string | null;
  debriefPending: boolean;
};

function hasContact(input: LeadNextActionInput): boolean {
  return Boolean(input.phone.trim() || input.email.trim());
}

function terminal(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === 'chot' || s === 'lost';
}

export function resolveLeadNextAction(input: LeadNextActionInput): LeadNextAction {
  const stage = (input.presalesStage ?? '').trim().toLowerCase();
  const prep = (input.prepStatus ?? '').trim().toLowerCase();
  const prepStage = (input.prepStage ?? '').trim().toLowerCase();

  if (!hasContact(input)) {
    return {
      rule: 1,
      title_vi: 'Bổ sung SĐT hoặc email',
      body_vi: 'Không có contact — không gọi và không chạy Discover được.',
      primary: { label_vi: 'Bổ sung contact', action: 'edit_contact' },
      secondary: [],
    };
  }

  if (input.lmpEnabled && prep === 'awaiting_am_input') {
    return {
      rule: 2,
      title_vi: 'Nhập tên công ty để chạy prep',
      body_vi: 'AI chưa đủ pháp nhân. Lưu tên công ty (website tuỳ chọn) rồi chạy prep.',
      primary: { label_vi: 'Lưu lên lead & chạy prep', action: 'save_company_run_prep' },
      secondary: [],
    };
  }

  if (input.lmpEnabled && prep === 'awaiting_entity_choice') {
    return {
      rule: 3,
      title_vi: 'Chọn đúng pháp nhân',
      body_vi: 'Nhiều doanh nghiệp khớp SĐT/email — chọn một rồi tiếp tục SCI.',
      primary: { label_vi: 'Xác nhận & tiếp tục', action: 'select_entity' },
      secondary: [],
    };
  }

  if (input.lmpEnabled && (prep === 'pending' || prep === 'running')) {
    return {
      rule: 4,
      title_vi: 'Đang chuẩn bị SCI',
      body_vi: 'Chờ Discover / research xong. Không dùng script giả.',
      primary: { label_vi: 'Đang chạy…', action: 'wait_prep' },
      secondary: [{ label_vi: 'Xem tiến trình', action: 'open_cockpit' }],
    };
  }

  if (input.debriefPending && terminal(input.leadStatus)) {
    return {
      rule: 9,
      title_vi: 'Học từ cuộc chốt',
      body_vi: 'Lead đã Chốt/Lost — gửi debrief để win loop học objection.',
      primary: { label_vi: 'Gửi debrief', action: 'submit_debrief' },
      secondary: [],
    };
  }

  const m3 =
    input.dealRoomEnabled &&
    input.b2Complete &&
    (prepStage === 'm3_pre_close' || stage === 'proposal');
  if (m3) {
    return {
      rule: 8,
      title_vi: 'Chuẩn bị buổi chốt',
      body_vi: 'Mở Deal Room — narrative, 3 gói, close ask.',
      primary: { label_vi: 'Mở Deal Room', action: 'open_deal_room' },
      secondary:
        prep === 'ready'
          ? [{ label_vi: 'Tạo báo giá 3 gói', action: 'apply_offer_ladder' }]
          : [],
    };
  }

  if (input.b2Complete && stage === 'consult') {
    return {
      rule: 7,
      title_vi: 'Handoff Solution',
      body_vi: 'Intake đã Go. Đẩy brief sang Tư vấn / Solution.',
      primary: { label_vi: 'Mở Tư vấn', action: 'open_consult' },
      secondary: [{ label_vi: 'Copy brief M2', action: 'copy_m2_brief' }],
    };
  }

  if (input.b2Complete && (stage === 'lead' || stage === '')) {
    return {
      rule: 6,
      title_vi: 'Qualify BANT',
      body_vi: 'B2 xong — làm Intake Go trước khi handoff.',
      primary: { label_vi: 'Mở Intake', action: 'open_intake' },
      secondary:
        prep === 'ready' ? [{ label_vi: 'Copy brief M2', action: 'copy_m2_brief' }] : [],
    };
  }

  if (!input.b2Complete && input.phone.trim()) {
    return {
      rule: 5,
      title_vi: 'Gọi đầu trong 15 phút',
      body_vi: 'Hero đã có Gọi ngay. Copy script rồi gọi; sau cuộc gọi hoàn thành B2.',
      primary: input.lmpEnabled
        ? { label_vi: 'Copy script', action: 'copy_script' }
        : { label_vi: 'Thêm hoạt động', action: 'add_activity' },
      secondary: [{ label_vi: 'Hoàn thành B2', action: 'complete_b2' }],
    };
  }

  return {
    rule: 10,
    title_vi: 'Xem SCI hoặc nhật ký',
    body_vi: 'Không còn việc bắt buộc trên funnel.',
    primary: input.lmpEnabled
      ? { label_vi: 'Mở Sales Cockpit', action: 'open_cockpit' }
      : { label_vi: 'Thêm hoạt động', action: 'add_activity' },
    secondary: [{ label_vi: 'Thêm hoạt động', action: 'add_activity' }],
  };
}
