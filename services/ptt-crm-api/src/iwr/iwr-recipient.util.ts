import { isOnPath, sameDepartment } from './iwr-org.util';
import type { IwrActor, IwrStaffNode } from './iwr.types';

export type RecipientPolicyError =
  | 'iwr_to_locked'
  | 'iwr_cc_not_allowed'
  | 'iwr_bcc_forbidden';

export class IwrPolicyError extends Error {
  constructor(public readonly error: RecipientPolicyError) {
    super(error);
  }
}

export function defaultToStaffId(author: IwrStaffNode): number | null {
  return author.reports_to_id;
}

function hasIwrManage(actor: IwrActor): boolean {
  return actor.caps.some((c) => c.section === 'iwr' && c.action === 'manage');
}

export function assertW1Recipients(input: {
  author: IwrStaffNode;
  actor: IwrActor;
  nodes: IwrStaffNode[];
  toIds: number[];
  ccIds: number[];
  bccIds: number[];
}): void {
  const { author, actor, nodes, toIds, ccIds, bccIds } = input;

  if (bccIds.length > 0) {
    throw new IwrPolicyError('iwr_bcc_forbidden');
  }

  const expectedTo = defaultToStaffId(author);
  if (expectedTo != null) {
    if (toIds.length !== 1 || toIds[0] !== expectedTo) {
      throw new IwrPolicyError('iwr_to_locked');
    }
  } else if (toIds.length > 0) {
    throw new IwrPolicyError('iwr_to_locked');
  }

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
