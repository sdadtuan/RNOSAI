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
  | 'handoff_solution'
  | 'wait_handoff'
  | 'advance_presales'
  | 'open_deal_room'
  | 'apply_offer_ladder'
  | 'submit_debrief'
  | 'add_activity'
  | 'create_contract'
  | 'submit_contract'
  | 'wait_contract_approval'
  | 'open_contract_hub';

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
  handoffStatus: string | null;
  hasContract: boolean;
  contractStatus: string | null;
  pendingApproval: boolean;
  submitReady: boolean;
  createReady: boolean;
};

function hasContact(input: LeadNextActionInput): boolean {
  return Boolean(input.phone.trim() || input.email.trim());
}

function terminal(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === 'chot' || s === 'lost' || s === 'won';
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
      body_vi: 'Lead đã Won/Chốt/Lost — gửi debrief để win loop học objection.',
      primary: { label_vi: 'Gửi debrief', action: 'submit_debrief' },
      secondary: [],
    };
  }

  const contractStatus = (input.contractStatus ?? '').trim().toLowerCase();

  if (input.pendingApproval) {
    return {
      rule: 8,
      title_vi: 'Chờ GDKD duyệt',
      body_vi: 'Đã gửi — không submit lại.',
      primary: { label_vi: 'Chờ GDKD duyệt', action: 'wait_contract_approval' },
      secondary: [{ label_vi: 'Hub · HĐ chờ duyệt', action: 'open_contract_hub' }],
    };
  }

  if (input.hasContract && contractStatus === 'draft' && input.submitReady) {
    return {
      rule: 8,
      title_vi: 'Gửi GDKD duyệt',
      body_vi: 'Gate đủ — gửi HĐ, GDKD duyệt trên Hub.',
      primary: { label_vi: 'Gửi GDKD duyệt', action: 'submit_contract' },
      secondary: [{ label_vi: 'Hub · HĐ chờ duyệt', action: 'open_contract_hub' }],
    };
  }

  const m3 =
    input.dealRoomEnabled &&
    input.b2Complete &&
    (prepStage === 'm3_pre_close' || stage === 'proposal');
  if (m3) {
    const secondary: LeadNextAction['secondary'] =
      stage === 'proposal' && !input.hasContract
        ? [{ label_vi: 'Tạo HĐ draft', action: 'create_contract' }]
        : prep === 'ready'
          ? [{ label_vi: 'Tạo báo giá 3 gói', action: 'apply_offer_ladder' }]
          : [];
    return {
      rule: 8,
      title_vi: 'Chuẩn bị buổi chốt',
      body_vi: 'Mở Deal Room — narrative, 3 gói, close ask.',
      primary: { label_vi: 'Mở Deal Room', action: 'open_deal_room' },
      secondary,
    };
  }

  if (stage === 'proposal' && !input.hasContract && !input.dealRoomEnabled && input.createReady) {
    return {
      rule: 8,
      title_vi: 'Tạo HĐ draft',
      body_vi: 'Deal Room tắt — tạo draft trên panel HĐ.',
      primary: { label_vi: 'Tạo HĐ draft', action: 'create_contract' },
      secondary: [],
    };
  }

  if (input.b2Complete && stage === 'consult') {
    const handoff = (input.handoffStatus ?? '').trim().toLowerCase();
    const briefSecondary: LeadNextAction['secondary'] =
      prep === 'ready' ? [{ label_vi: 'Copy brief M2', action: 'copy_m2_brief' }] : [];
    if (handoff === 'pending') {
      return {
        rule: 7,
        title_vi: 'Chờ Solution nhận case',
        body_vi: 'Đã giao queue. Không giao lại — Solution sẽ claim trên /crm/solution/queue.',
        primary: { label_vi: 'Đang chờ nhận…', action: 'wait_handoff' },
        secondary: [{ label_vi: 'Mở Tư vấn', action: 'open_consult' }],
      };
    }
    if (handoff === 'with_solution') {
      return {
        rule: 7,
        title_vi: 'Solution đang tư vấn',
        body_vi: 'Case đã có owner Solution. Mở workspace Tư vấn.',
        primary: { label_vi: 'Mở Tư vấn', action: 'open_consult' },
        secondary: briefSecondary,
      };
    }
    if (handoff === 'released') {
      return {
        rule: 7,
        title_vi: 'Chuyển → Báo giá',
        body_vi: 'Solution đã trả Sales. Chuyển giai đoạn pre-sales sang báo giá.',
        primary: { label_vi: 'Chuyển → Báo giá', action: 'advance_presales' },
        secondary: [{ label_vi: 'Mở Tư vấn', action: 'open_consult' }],
      };
    }
    return {
      rule: 7,
      title_vi: 'Giao Solution/MKT',
      body_vi: 'Intake đã Go. Giao queue Solution — Tư vấn là chỗ làm việc, không thay nút giao.',
      primary: { label_vi: 'Giao Solution/MKT', action: 'handoff_solution' },
      secondary: (
        [
          { label_vi: 'Mở Tư vấn', action: 'open_consult' },
          ...briefSecondary,
        ] satisfies LeadNextAction['secondary']
      ).slice(0, 2),
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
      primary:
        input.lmpEnabled && prep === 'ready'
          ? { label_vi: 'Copy script', action: 'copy_script' }
          : { label_vi: 'Thêm hoạt động', action: 'add_activity' },
      secondary: [{ label_vi: 'Xong B2', action: 'complete_b2' }],
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
