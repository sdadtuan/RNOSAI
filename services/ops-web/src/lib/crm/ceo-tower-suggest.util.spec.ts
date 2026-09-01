import { describe, expect, it } from 'vitest';
import {
  TOWER_UPCOMING_TOOLTIP,
  mapTowerSuggestAction,
  parseOwnerStaffIdInput,
} from './ceo-tower-suggest.util';

describe('mapTowerSuggestAction', () => {
  it('maps assign_lead to lead_id + owner_staff_id from the row', () => {
    const out = mapTowerSuggestAction({
      suggest_action: 'assign_lead',
      suggest_params: { lead_id: 11, owner_staff_id: 7 },
      href: '/crm/leads/11',
      title_vi: 'Lead #11 chưa owner 5h',
    });
    expect(out).toEqual({
      kind: 'ready',
      action_id: 'assign_lead',
      params: { lead_id: 11, owner_staff_id: 7 },
    });
  });

  it('assign_lead without owner needs a staff id prompt (S1)', () => {
    const out = mapTowerSuggestAction({
      suggest_action: 'assign_lead',
      suggest_params: { lead_id: 1 },
      href: '/crm/leads/1',
      title_vi: 'Lead #1 chưa owner 5h',
    });
    expect(out).toEqual({
      kind: 'needs_owner',
      action_id: 'assign_lead',
      params: { lead_id: 1 },
    });
  });

  it('maps remind_staff to staff_id + title + body + link_href', () => {
    const out = mapTowerSuggestAction({
      suggest_action: 'remind_staff',
      suggest_params: { lead_id: 70, staff_id: 3 },
      href: '/crm/hub/70',
      title_vi: 'Lead #70 ops quá hạn',
    });
    expect(out).toEqual({
      kind: 'ready',
      action_id: 'remind_staff',
      params: {
        staff_id: 3,
        title: 'Lead #70 ops quá hạn',
        body: 'Lead #70 ops quá hạn',
        link_href: '/crm/hub/70',
      },
    });
  });

  it('ownerless remind_staff is not ready', () => {
    const out = mapTowerSuggestAction({
      suggest_action: 'remind_staff',
      suggest_params: { lead_id: 70, staff_id: null },
      href: '/crm/hub/70',
      title_vi: 'Lead #70 ops quá hạn',
    });
    expect(out.kind).not.toBe('ready');
    expect(out).toEqual({ kind: 'hidden' });
  });

  it('hides sla_remind_lead when lead_id, tier, or suggested_action is missing', () => {
    const base = {
      suggest_action: 'sla_remind_lead',
      href: '/crm/cskh-board?lead=200',
      title_vi: 'Lead #200 vỡ SLA CSKH 2h',
    };
    expect(
      mapTowerSuggestAction({
        ...base,
        suggest_params: { tier: 'first_call_15m', suggested_action: 'log_call' },
      }),
    ).toEqual({ kind: 'hidden' });
    expect(
      mapTowerSuggestAction({
        ...base,
        suggest_params: { lead_id: 200, suggested_action: 'log_call' },
      }),
    ).toEqual({ kind: 'hidden' });
    expect(
      mapTowerSuggestAction({
        ...base,
        suggest_params: { lead_id: 200, tier: 'first_call_15m' },
      }),
    ).toEqual({ kind: 'hidden' });
  });

  it('hides ack_ops_alert when alert_id is missing', () => {
    expect(
      mapTowerSuggestAction({
        suggest_action: 'ack_ops_alert',
        suggest_params: { lead_id: 70 },
        href: '/crm/ops?alert=88',
        title_vi: 'Lead #70 ops quá hạn',
      }),
    ).toEqual({ kind: 'hidden' });
  });

  it('maps sla_remind_lead from S9 params', () => {
    const out = mapTowerSuggestAction({
      suggest_action: 'sla_remind_lead',
      suggest_params: {
        lead_id: 200,
        tier: 'first_call_15m',
        suggested_action: 'log_call',
      },
      href: '/crm/cskh-board?lead=200',
      title_vi: 'Lead #200 vỡ SLA CSKH 2h',
    });
    expect(out).toEqual({
      kind: 'ready',
      action_id: 'sla_remind_lead',
      params: {
        lead_id: 200,
        tier: 'first_call_15m',
        suggested_action: 'log_call',
      },
    });
  });

  it('maps ack_ops_alert to alert_id', () => {
    const out = mapTowerSuggestAction({
      suggest_action: 'ack_ops_alert',
      suggest_params: { lead_id: 70, alert_id: 88 },
      href: '/crm/ops?alert=88',
      title_vi: 'Lead #70 ops quá hạn',
    });
    expect(out).toEqual({
      kind: 'ready',
      action_id: 'ack_ops_alert',
      params: { alert_id: 88 },
    });
  });

  it('treats S3/S4 actions as disabled upcoming', () => {
    expect(
      mapTowerSuggestAction({
        suggest_action: 'prioritize_solution_queue',
        suggest_params: { lead_id: 30 },
        href: '/crm/leads/30#consult',
        title_vi: 'Lead #30 Tư vấn 26h',
      }),
    ).toEqual({
      kind: 'upcoming',
      tooltip: TOWER_UPCOMING_TOOLTIP,
    });
    expect(
      mapTowerSuggestAction({
        suggest_action: 'remind_contract_approval',
        suggest_params: { lead_id: 42 },
        href: '/crm/leads/42#lead-contract',
        title_vi: 'HĐ #42 chờ duyệt 36h',
      }),
    ).toEqual({
      kind: 'upcoming',
      tooltip: TOWER_UPCOMING_TOOLTIP,
    });
    expect(TOWER_UPCOMING_TOOLTIP).toBe('Sắp có — nhắc duyệt HĐ / ưu tiên queue');
  });

  it('hides the chip when CEO cannot act', () => {
    expect(
      mapTowerSuggestAction(
        {
          suggest_action: 'remind_staff',
          suggest_params: { staff_id: 3, lead_id: 70 },
          href: '/crm/hub/70',
          title_vi: 'Lead #70 ops quá hạn',
        },
        { can_act: false },
      ),
    ).toEqual({ kind: 'hidden' });
  });
});

describe('parseOwnerStaffIdInput', () => {
  it('parses a positive staff id and rejects cancel/invalid', () => {
    expect(parseOwnerStaffIdInput('9')).toBe(9);
    expect(parseOwnerStaffIdInput(' 12 ')).toBe(12);
    expect(parseOwnerStaffIdInput(null)).toBeNull();
    expect(parseOwnerStaffIdInput('')).toBeNull();
    expect(parseOwnerStaffIdInput('0')).toBeNull();
    expect(parseOwnerStaffIdInput('abc')).toBeNull();
  });
});
