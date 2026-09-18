import {
  mergeScrapedContacts,
  scrapeContactsFromText,
  type ScrapedContacts,
} from './scrape-contact.util';
import { normalizePhoneDigits } from './literal-contact.util';
import { isDenylistedEvidenceHost } from './brq-patterns.util';

export type ContactEnrichLead = {
  phone?: string | null;
  phone_norm?: string | null;
  email?: string | null;
  website?: string | null;
  fanpage_url?: string | null;
  evidence_url?: string | null;
};

export type PlacesContactHint = {
  phone?: string | null;
  website?: string | null;
};

export type ContactEnrichPatch = {
  phone: string | null;
  phone_norm: string | null;
  email: string | null;
  website: string | null;
  fanpage_url: string | null;
  contactable: boolean;
  changed: boolean;
  sources: string[];
};

/** Maps / social listed as website → fanpage channel. */
export function splitWebChannels(website: string | null | undefined): {
  website: string | null;
  fanpage_url: string | null;
} {
  const raw = String(website ?? '').trim();
  if (!raw) return { website: null, fanpage_url: null };
  try {
    const host = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.toLowerCase();
    if (
      /(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)instagram\.com$|(^|\.)tiktok\.com$/i.test(
        host,
      )
    ) {
      return {
        website: null,
        fanpage_url: raw.startsWith('http') ? raw : `https://${raw}`,
      };
    }
  } catch {
    /* keep as website */
  }
  return { website: raw, fanpage_url: null };
}

export function mergeContactEnrichment(input: {
  lead: ContactEnrichLead;
  places?: PlacesContactHint | null;
  scraped?: ScrapedContacts | null;
}): ContactEnrichPatch {
  const sources: string[] = [];
  let phone = input.lead.phone ?? null;
  let email = input.lead.email ?? null;
  let website = input.lead.website ?? null;
  let fanpage = input.lead.fanpage_url ?? null;

  if (input.places?.phone && !phone) {
    phone = input.places.phone;
    sources.push('places_phone');
  }
  if (input.places?.website) {
    const channels = splitWebChannels(input.places.website);
    if (channels.website && !website) {
      website = channels.website;
      sources.push('places_website');
    }
    if (channels.fanpage_url && !fanpage) {
      fanpage = channels.fanpage_url;
      sources.push('places_fanpage');
    }
  }

  if (input.scraped) {
    const beforePhone = phone;
    const beforeEmail = email;
    const merged = mergeScrapedContacts(
      { phone, email },
      input.scraped,
    );
    phone = merged.phone;
    email = merged.email;
    if (phone && phone !== beforePhone) sources.push('scrape_phone');
    if (email && email !== beforeEmail) sources.push('scrape_email');
  }

  // If lead website is actually social, move to fanpage.
  if (website && isDenylistedEvidenceHost(website) && !fanpage) {
    const ch = splitWebChannels(website);
    if (ch.fanpage_url) {
      fanpage = ch.fanpage_url;
      website = null;
      sources.push('normalize_social');
    }
  }

  const phone_norm = phone ? normalizePhoneDigits(phone) : null;
  const contactable = Boolean(
    (phone_norm && phone_norm.length >= 9) ||
      (email && String(email).includes('@')),
  );

  const changed =
    phone !== (input.lead.phone ?? null) ||
    email !== (input.lead.email ?? null) ||
    website !== (input.lead.website ?? null) ||
    fanpage !== (input.lead.fanpage_url ?? null);

  return {
    phone,
    phone_norm: phone_norm && phone_norm.length >= 9 ? phone_norm : null,
    email,
    website,
    fanpage_url: fanpage,
    contactable,
    changed,
    sources,
  };
}

export function scrapeFromFetchedText(text: string): ScrapedContacts {
  return scrapeContactsFromText(text);
}
