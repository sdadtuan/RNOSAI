import { isOnPath, sameDepartment } from './iwr-org.util';
import type { IwrActor, IwrRecipientRow, IwrReportRow, IwrStaffNode } from './iwr.types';

export type RecipientPolicyError =
  | 'iwr_to_locked'
  | 'iwr_cc_not_allowed'
  | 'iwr_bcc_forbidden'
  | 'iwr_recipient_masked';

export class IwrPolicyError extends Error {
  constructor(public readonly error: RecipientPolicyError) {
    super(error);
  }
}

export type IwrRecipientPolicyRules = {
  allow_bcc: boolean;
  cc_mode: 'w1' | 'open';
};

export function defaultToStaffId(author: IwrStaffNode): number | null {
  return author.reports_to_id;
}

function hasIwrCap(actor: IwrActor, action: string): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === action);
}

function hasIwrManage(actor: IwrActor): boolean {
  return hasIwrCap(actor, 'manage');
}

function assertToLocked(input: {
  author: IwrStaffNode;
  toIds: number[];
}): void {
  const { author, toIds } = input;
  const expectedTo = defaultToStaffId(author);
  if (expectedTo != null) {
    if (toIds.length !== 1 || toIds[0] !== expectedTo) {
      throw new IwrPolicyError('iwr_to_locked');
    }
  } else if (toIds.length > 0) {
    throw new IwrPolicyError('iwr_to_locked');
  }
}

function assertCcW1(input: {
  author: IwrStaffNode;
  actor: IwrActor;
  nodes: IwrStaffNode[];
  toIds: number[];
  ccIds: number[];
}): void {
  const { author, actor, nodes, toIds, ccIds } = input;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const id of [...toIds, ...ccIds]) {
    if (id === author.id) {
      throw new IwrPolicyError('iwr_cc_not_allowed');
    }
  }
  for (const ccId of ccIds) {
    const cc = byId.get(ccId);
    if (!cc) {
      throw new IwrPolicyError('iwr_cc_not_allowed');
    }
    const ok =
      sameDepartment(author, cc) ||
      isOnPath(author.id, ccId, nodes) ||
      hasIwrManage(actor);
    if (!ok) {
      throw new IwrPolicyError('iwr_cc_not_allowed');
    }
  }
}

function assertCcOpen(input: {
  author: IwrStaffNode;
  nodes: IwrStaffNode[];
  ccIds: number[];
}): void {
  const { author, nodes, ccIds } = input;
  const active = new Set(nodes.filter((n) => n.active).map((n) => n.id));
  for (const ccId of ccIds) {
    if (ccId === author.id || !active.has(ccId)) {
      throw new IwrPolicyError('iwr_cc_not_allowed');
    }
  }
}

/** W3 policy-aware recipient validation. Falls back to W1 when policy omitted. */
export function assertCanReceive(input: {
  actor: IwrActor;
  author: IwrStaffNode;
  nodes: IwrStaffNode[];
  toIds: number[];
  ccIds: number[];
  bccIds: number[];
  policy?: IwrRecipientPolicyRules;
  reportSensitivity?: string;
}): void {
  const { actor, author, nodes, toIds, ccIds, bccIds, policy, reportSensitivity } = input;

  if (reportSensitivity === 'hr' || reportSensitivity === 'finance') {
    if (!hasIwrManage(actor) && actor.staffId !== author.id) {
      throw new IwrPolicyError('iwr_recipient_masked');
    }
  }

  if (bccIds.length > 0) {
    const allowBcc = policy?.allow_bcc === true && hasIwrCap(actor, 'bcc');
    if (!allowBcc) {
      throw new IwrPolicyError('iwr_bcc_forbidden');
    }
  }

  assertToLocked({ author, toIds });

  if (policy?.cc_mode === 'open') {
    assertCcOpen({ author, nodes, ccIds });
  } else {
    assertCcW1({ author, actor, nodes, toIds, ccIds });
  }
}

/** W1 hard-coded rules (Bcc always forbidden). */
export function assertW1Recipients(input: {
  author: IwrStaffNode;
  actor: IwrActor;
  nodes: IwrStaffNode[];
  toIds: number[];
  ccIds: number[];
  bccIds: number[];
}): void {
  if (input.bccIds.length > 0) {
    throw new IwrPolicyError('iwr_bcc_forbidden');
  }
  assertToLocked({ author: input.author, toIds: input.toIds });
  assertCcW1(input);
}

export function filterRecipientsForViewer(
  actor: IwrActor,
  report: IwrReportRow,
  recipients: IwrRecipientRow[],
): IwrRecipientRow[] {
  const canSeeAllBcc =
    report.author_staff_id === actor.staffId || hasIwrCap(actor, 'manage');
  return recipients.filter((r) => {
    if (r.kind !== 'bcc') return true;
    if (canSeeAllBcc) return true;
    return r.staff_id === actor.staffId;
  });
}

export function replyAllRecipientIds(
  recipients: IwrRecipientRow[],
  authorStaffId: number,
  selfStaffId: number,
): number[] {
  const ids = new Set<number>();
  ids.add(authorStaffId);
  for (const r of recipients) {
    if (r.kind === 'bcc') continue;
    ids.add(r.staff_id);
  }
  ids.delete(selfStaffId);
  return [...ids];
}
