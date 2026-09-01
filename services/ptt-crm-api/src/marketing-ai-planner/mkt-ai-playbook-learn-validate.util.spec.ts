import { readPlaybookFile } from './marketing-ai-playbook.util';
import { rejectLearnedPlaybook } from './mkt-ai-playbook-learn-validate.util';

const SERVICE_SLUG = 'meta-lead-gen';

function cleanLearnedClone(): Record<string, unknown> {
  const pb = readPlaybookFile('meta-lead-gen');
  return JSON.parse(JSON.stringify(pb)) as Record<string, unknown>;
}

describe('rejectLearnedPlaybook', () => {
  it('rejects when brand_name is set in brief_defaults', () => {
    const doc = cleanLearnedClone();
    (doc.brief_defaults as Record<string, unknown>).brand_name = 'ACME Corp';
    const errors = rejectLearnedPlaybook(doc, SERVICE_SLUG, []);
    expect(errors).toContain('brand_name must be empty');
  });

  it('rejects client name leak in strategy hints', () => {
    const doc = cleanLearnedClone();
    (doc.strategy_prompt_hints as string[]).push('Case study Công ty Bất Động Sản Hoàng Gia');
    const errors = rejectLearnedPlaybook(doc, SERVICE_SLUG, ['Bất Động Sản Hoàng Gia']);
    expect(errors).toContain('client_name_leak');
  });

  it('rejects phone or email PII in document blob', () => {
    const doc = cleanLearnedClone();
    (doc.strategy_prompt_hints as string[]).push('Liên hệ hotline 0901234567');
    expect(rejectLearnedPlaybook(doc, SERVICE_SLUG, [])).toContain('pii_phone_or_email');

    const doc2 = cleanLearnedClone();
    (doc2.governance_notes_vi as string[]).push('Không gửi mail sales@client.vn');
    expect(rejectLearnedPlaybook(doc2, SERVICE_SLUG, [])).toContain('pii_phone_or_email');
  });

  it('rejects wrong service_slugs', () => {
    const doc = cleanLearnedClone();
    doc.service_slugs = ['bds-lead-gen'];
    const errors = rejectLearnedPlaybook(doc, SERVICE_SLUG, []);
    expect(errors).toContain('service_slugs must be exactly the learned slug');
  });

  it('passes clean meta-lead-gen clone for learned slug', () => {
    const doc = cleanLearnedClone();
    doc.slug = SERVICE_SLUG;
    doc.service_slugs = [SERVICE_SLUG];
    const errors = rejectLearnedPlaybook(doc, SERVICE_SLUG, ['Bất Động Sản Hoàng Gia']);
    expect(errors).toEqual([]);
  });
});
