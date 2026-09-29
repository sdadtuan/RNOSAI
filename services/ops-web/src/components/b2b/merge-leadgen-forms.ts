export type LeadgenFormDraft = {
  form_id: string;
  name: string;
  active: boolean;
};

/** Gộp form Graph vào bản nháp. Form đã có giữ trạng thái Active, chỉ cập nhật tên. */
export function mergeLeadgenForms(
  existing: LeadgenFormDraft[],
  fetched: LeadgenFormDraft[],
): LeadgenFormDraft[] {
  const incoming = fetched
    .map((f) => ({ form_id: f.form_id.trim(), name: f.name.trim(), active: f.active }))
    .filter((f) => f.form_id);
  if (!incoming.length) {
    return existing.length ? existing : [{ form_id: '', name: '', active: true }];
  }
  const kept = existing
    .map((f) => ({ ...f, form_id: f.form_id.trim() }))
    .filter((f) => f.form_id);
  const byId = new Map(kept.map((f) => [f.form_id, f]));
  const order = kept.map((f) => f.form_id);
  for (const form of incoming) {
    const prev = byId.get(form.form_id);
    if (prev) {
      byId.set(form.form_id, { ...prev, name: form.name || prev.name });
    } else {
      byId.set(form.form_id, form);
      order.push(form.form_id);
    }
  }
  return order.map((id) => byId.get(id)!);
}
