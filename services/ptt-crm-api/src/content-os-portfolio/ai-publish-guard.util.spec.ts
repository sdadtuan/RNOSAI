import { readFileSync } from 'fs';
import { join } from 'path';
import { ContentGenerateService } from '../content-marketing/content-generate.service';
import { AI_PUBLISH_FORBIDDEN_IMPORTS } from './ai-publish-guard.util';

const GENERATE_FILES = [
  'content-marketing/content-repurpose.service.ts',
  'content-marketing/content-brand-context.service.ts',
  'content-marketing/content-marketing-prompt.util.ts',
  'content-marketing/content-job-worker.service.ts',
  'content-marketing/content-generate.service.ts',
  'content-marketing/content-media-generate.service.ts',
];

const GENERATE_METHOD_NAME = /generate|copilot|planner/i;
const KEYWORD_NAMES = new Set(['constructor', 'if', 'for', 'while', 'switch', 'catch', 'return']);

function skipStringOrComment(
  src: string,
  i: number,
  state: { inStr: string | null; inLine: boolean; inBlock: boolean },
): number | null {
  const c = src[i];
  const n = src[i + 1];
  if (state.inLine) return c === '\n' ? ((state.inLine = false), i) : i;
  if (state.inBlock) {
    if (c === '*' && n === '/') {
      state.inBlock = false;
      return i + 1;
    }
    return i;
  }
  if (state.inStr) {
    if (c === '\\') return i + 1;
    if (c === state.inStr) state.inStr = null;
    return i;
  }
  if (c === '/' && n === '/') {
    state.inLine = true;
    return i + 1;
  }
  if (c === '/' && n === '*') {
    state.inBlock = true;
    return i + 1;
  }
  if (c === '"' || c === "'" || c === '`') {
    state.inStr = c;
    return i;
  }
  return null;
}

function matchingDelimiter(src: string, openIdx: number, open: string, close: string): number {
  const state = { inStr: null as string | null, inLine: false, inBlock: false };
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const skipped = skipStringOrComment(src, i, state);
    if (skipped != null) {
      i = skipped;
      continue;
    }
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function extractClassMethods(src: string): { name: string; body: string }[] {
  const classIdx = src.search(/export class \w+/);
  if (classIdx < 0) return [];
  const classOpen = src.indexOf('{', classIdx);
  if (classOpen < 0) return [];
  const classClose = matchingDelimiter(src, classOpen, '{', '}');
  const classBody = src.slice(classOpen + 1, classClose < 0 ? src.length : classClose);
  const methods: { name: string; body: string }[] = [];
  const sig =
    /(?:^|\n)[ \t]+(?:private |public |protected )?(?:async )?([A-Za-z_][A-Za-z0-9_]*)\s*(?:<[^>\n]*>)?\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = sig.exec(classBody))) {
    const name = match[1];
    if (KEYWORD_NAMES.has(name)) continue;
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchingDelimiter(classBody, openParen, '(', ')');
    if (closeParen < 0) continue;
    const brace = classBody.indexOf('{', closeParen);
    if (brace < 0) continue;
    const between = classBody.slice(closeParen + 1, brace);
    if (between.includes(';')) continue;
    const closeBrace = matchingDelimiter(classBody, brace, '{', '}');
    if (closeBrace < 0) continue;
    methods.push({ name, body: classBody.slice(brace + 1, closeBrace) });
  }
  return methods;
}

it('generate services do not import execute or Facebook connector', () => {
  for (const rel of GENERATE_FILES) {
    const src = readFileSync(join(__dirname, '..', rel), 'utf8');
    for (const needle of AI_PUBLISH_FORBIDDEN_IMPORTS) {
      expect(src).not.toContain(needle);
    }
  }
});

it('portfolio generate/copilot/planner methods do not call execute or Facebook connector', () => {
  const src = readFileSync(join(__dirname, 'content-os-portfolio.service.ts'), 'utf8');
  const methods = extractClassMethods(src);
  expect(methods.map((m) => m.name)).toEqual(
    expect.arrayContaining(['enqueuePublicationExecute', 'runPublicationExecute']),
  );
  const locked = methods.filter((m) => GENERATE_METHOD_NAME.test(m.name));
  for (const method of locked) {
    for (const needle of AI_PUBLISH_FORBIDDEN_IMPORTS) {
      expect(method.body).not.toContain(needle);
    }
  }
});

it('generate facade does not expose execute even if a portfolio is injected', () => {
  const fakePortfolio = {
    enqueuePublicationExecute: jest.fn(),
    runPublicationExecute: jest.fn(),
    createFacebookPageConnector: jest.fn(),
  };
  const proto = Object.getOwnPropertyNames(ContentGenerateService.prototype);
  expect(proto).not.toContain('enqueuePublicationExecute');
  expect(proto).not.toContain('runPublicationExecute');

  const GenerateFacade = ContentGenerateService as unknown as new (
    ...args: unknown[]
  ) => ContentGenerateService;
  const facade = new GenerateFacade(
    { contentMarketingAiEnabled: true },
    { ensureLifecycleEnabled: jest.fn() },
    { resolveForLifecycle: jest.fn() },
    {},
    { processJob: jest.fn() },
    fakePortfolio,
  );
  const exposed = facade as {
    enqueuePublicationExecute?: unknown;
    runPublicationExecute?: unknown;
  };
  expect(exposed.enqueuePublicationExecute).toBeUndefined();
  expect(exposed.runPublicationExecute).toBeUndefined();
  expect(fakePortfolio.enqueuePublicationExecute).not.toHaveBeenCalled();
  expect(fakePortfolio.runPublicationExecute).not.toHaveBeenCalled();
});
