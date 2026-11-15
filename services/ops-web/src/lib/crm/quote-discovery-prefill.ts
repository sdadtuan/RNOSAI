/** Map exact Sales Discovery "Dịch vụ quan tâm" picks onto quote service/item codes. */

import { p13CodeForIntakeService } from './p13-intake-service';

export type QuotePrefillDiscoveryGroup = {
  services?: Array<{
    slug?: string;
    name?: string;
    children?: Array<{ slug?: string; name?: string }>;
  }>;
};

export type QuotePrefillService = { code: string; name?: string };

export type QuotePrefillItem = {
  item_code: string;
  service_code: string;
  task: string;
  subtask: string;
};

export type QuotePrefillScope = {
  service_code: string;
  item_codes: string[];
} | null;

export type QuoteDiscoveryPrefill = {
  serviceCodes: string[];
  itemCodes: string[];
};

function norm(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function quoteServiceCode(
  slug: string,
  name: string,
  quoteServices: QuotePrefillService[],
): string | null {
  const direct = p13CodeForIntakeService({ slug, label: name }, quoteServices);
  if (direct) return direct;
  const needle = norm(name || slug);
  if (!needle) return null;
  const exact = quoteServices.filter((service) => {
    const label = norm(service.name ?? '');
    const code = norm(service.code);
    return label === needle || code === needle;
  });
  if (exact.length === 1) return exact[0].code.toUpperCase();
  const loose = quoteServices.filter((service) => {
    const label = norm(service.name ?? '');
    return Boolean(label && (label.includes(needle) || needle.includes(label)));
  });
  return loose.length === 1 ? loose[0].code.toUpperCase() : null;
}

function matchItemCode(
  needle: { slug: string; name: string },
  items: QuotePrefillItem[],
  serviceCode?: string,
): string | null {
  const slug = needle.slug.trim().toLowerCase();
  const name = norm(needle.name);
  const pool = serviceCode
    ? items.filter((item) => item.service_code.toUpperCase() === serviceCode.toUpperCase())
    : items;
  if (!pool.length) return null;
  if (slug) {
    const byCode = pool.find((item) => item.item_code.trim().toLowerCase() === slug);
    if (byCode) return byCode.item_code;
  }
  if (!name) return null;
  const exact = pool.filter((item) => {
    const task = norm(item.task);
    const sub = norm(item.subtask);
    return task === name || sub === name || norm(`${item.task} ${item.subtask}`) === name;
  });
  if (exact.length === 1) return exact[0].item_code;
  if (exact.length > 1) return null;
  const loose = pool.filter((item) => {
    const task = norm(item.task);
    const sub = norm(item.subtask);
    return Boolean(task && (task.includes(name) || name.includes(task))) || Boolean(sub && (sub.includes(name) || name.includes(sub)));
  });
  return loose.length === 1 ? loose[0].item_code : null;
}

/**
 * Parent-only discovery picks become the parent service with no children.
 * Scope / hạng mục picks become only those matched items, never the whole catalog.
 */
export function suggestQuotePrefillFromDiscovery(input: {
  discoveryServices: string[];
  serviceGroups?: QuotePrefillDiscoveryGroup[] | null;
  quoteServices: QuotePrefillService[];
  quoteItems?: QuotePrefillItem[] | null;
  p13Scope?: QuotePrefillScope;
}): QuoteDiscoveryPrefill {
  const serviceCodes = new Set<string>();
  const itemCodes = new Set<string>();
  const items = input.quoteItems ?? [];

  const parents: Array<{ slug: string; name: string; children: Array<{ slug: string; name: string }> }> = [];
  const parentByChild = new Map<string, { slug: string; name: string; childName: string }>();
  const parentByCode = new Map<string, { slug: string; name: string }>();

  for (const group of input.serviceGroups ?? []) {
    for (const service of group.services ?? []) {
      const slug = String(service.slug ?? '').trim();
      const name = String(service.name ?? '').trim();
      if (!slug && !name) continue;
      const children = (service.children ?? [])
        .map((child) => ({
          slug: String(child.slug ?? '').trim(),
          name: String(child.name ?? '').trim(),
        }))
        .filter((child) => child.slug || child.name);
      const parent = { slug, name, children };
      parents.push(parent);
      if (slug) parentByCode.set(slug.toLowerCase(), parent);
      if (name) parentByCode.set(name.toLowerCase(), parent);
      for (const child of children) {
        if (child.slug) parentByChild.set(child.slug.toLowerCase(), { slug, name, childName: child.name });
        if (child.name) parentByChild.set(child.name.toLowerCase(), { slug, name, childName: child.name });
      }
    }
  }

  const scope = input.p13Scope;
  if (scope?.service_code) {
    serviceCodes.add(scope.service_code.trim().toUpperCase());
    for (const code of scope.item_codes) {
      const item = code.trim();
      if (item) itemCodes.add(item);
    }
  }

  for (const raw of input.discoveryServices ?? []) {
    const token = String(raw ?? '').trim();
    if (!token) continue;
    const child = parentByChild.get(token.toLowerCase());
    if (child) {
      const code = quoteServiceCode(child.slug, child.name, input.quoteServices);
      if (code) serviceCodes.add(code);
      const item = matchItemCode({ slug: token, name: child.childName }, items, code ?? undefined);
      if (item) itemCodes.add(item);
      continue;
    }
    const parent = parentByCode.get(token.toLowerCase());
    const code = quoteServiceCode(parent?.slug || token, parent?.name || token, input.quoteServices);
    if (code) serviceCodes.add(code);
    // Parent-only: never add the parent's catalog children.
  }

  return {
    serviceCodes: [...serviceCodes],
    itemCodes: [...itemCodes],
  };
}
