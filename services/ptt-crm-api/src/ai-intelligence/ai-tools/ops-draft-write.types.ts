export type OpsDraftWriteMeta = {
  actor: string;
  approvedAt: string;
};

export type OpsDraftWriteResult = {
  ok: true;
  wired: true;
  phase: 'P3';
  status: 'persisted';
  tool: string;
  requires_human_approval: true;
  human_approved: true;
  entity_ids: Record<string, number | string>;
  links: string[];
};
