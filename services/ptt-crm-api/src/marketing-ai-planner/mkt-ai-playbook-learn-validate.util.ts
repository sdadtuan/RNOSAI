import { validateMktAiPlaybookDocument } from './marketing-ai-playbook.util';

export function rejectLearnedPlaybook(
  doc: Record<string, unknown>,
  serviceSlug: string,
  clientNames: string[],
): string[] {
  const errors = validateMktAiPlaybookDocument(doc, String(doc.slug ?? serviceSlug));
  const defaults = (doc.brief_defaults ?? {}) as Record<string, unknown>;
  if (String(defaults.brand_name ?? '').trim()) errors.push('brand_name must be empty');
  const blob = JSON.stringify(doc).toLowerCase();
  for (const name of clientNames) {
    if (name.trim().length >= 4 && blob.includes(name.trim().toLowerCase())) {
      errors.push('client_name_leak');
    }
  }
  if (/\b0\d{8,10}\b/.test(blob) || /@/.test(blob)) errors.push('pii_phone_or_email');
  const slugs = doc.service_slugs as string[] | undefined;
  if (!slugs || slugs.length !== 1 || slugs[0] !== serviceSlug) {
    errors.push('service_slugs must be exactly the learned slug');
  }
  return errors;
}
