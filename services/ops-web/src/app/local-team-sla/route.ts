import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE } from '@/lib/auth';
import { defaultTeamSlaDocument, normalizeTeamSlaDocument } from '@/lib/crm/team-sla-profiles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function storePath(): string {
  return path.join(process.cwd(), '.data', 'team-sla-profiles.json');
}

function localOnly(): boolean {
  return process.env.NODE_ENV !== 'production' || Boolean(process.env.PTT_LOCAL_API_PROXY_TARGET);
}

function guard(req: NextRequest): NextResponse | null {
  if (!localOnly()) {
    return NextResponse.json({ error: 'local_only' }, { status: 404 });
  }
  if (req.cookies.get(AUTH_COOKIE)?.value !== '1') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return null;
}

async function readDocument() {
  try {
    const text = await fs.readFile(storePath(), 'utf8');
    return normalizeTeamSlaDocument(JSON.parse(text) as unknown);
  } catch {
    return defaultTeamSlaDocument();
  }
}

export async function GET(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  const document = await readDocument();
  return NextResponse.json(document);
}

export async function PUT(req: NextRequest) {
  const denied = guard(req);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const document = normalizeTeamSlaDocument(body);
  const file = storePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return NextResponse.json(document);
}
