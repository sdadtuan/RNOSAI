const AM_M01_CLASS = /\.am-m01(?![\w-])/;

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function isMaxWidth767(query: string): boolean {
  return /\(\s*max-width:\s*767px\s*\)/.test(query);
}

/** Drop `@media (max-width: 767px)` blocks so leftover CSS can be scanned. */
export function stripMaxWidth767Media(css: string): string {
  let out = '';
  let i = 0;
  const re = /@media\s*([^{]+)\{/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css))) {
    out += css.slice(i, match.index);
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let j = bodyStart;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    if (!isMaxWidth767(match[1])) {
      out += css.slice(match.index, j);
    }
    i = j;
    re.lastIndex = j;
  }
  return out + css.slice(i);
}

export function amM01RulesOnlyInMax767(css: string): boolean {
  const stripped = stripCssComments(css);
  if (!AM_M01_CLASS.test(stripped)) return false;
  if (!/@media\s*\(\s*max-width:\s*767px\s*\)/.test(stripped)) return false;
  return !AM_M01_CLASS.test(stripMaxWidth767Media(stripped));
}

function digits(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '');
}

export function amM01TelHref(phone: string | null | undefined): string | null {
  const value = digits(phone);
  return value ? `tel:${value}` : null;
}

export function amM01MailtoHref(email: string | null | undefined): string | null {
  const value = String(email ?? '').trim();
  return value ? `mailto:${value}` : null;
}

export function amM01ZaloHref(phone: string | null | undefined): string | null {
  const value = digits(phone);
  return value ? `https://zalo.me/${value}` : null;
}

export function amM01NearestEndsOn(contracts: Array<{ ends_on: string | null }>): string | null {
  const dates = contracts
    .map((row) => row.ends_on)
    .filter((value): value is string => Boolean(value && value.trim()));
  if (!dates.length) return null;
  return dates.slice().sort()[0] ?? null;
}
