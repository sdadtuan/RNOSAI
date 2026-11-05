/** Env P13_* with an optional settings map that overrides the same key. Default false. */

export function p13Flag(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
  settings?: Record<string, boolean | undefined>,
): boolean {
  const upper = name.startsWith('P13_') ? name.toUpperCase() : `P13_${name.toUpperCase()}`;
  if (settings && Object.prototype.hasOwnProperty.call(settings, upper) && typeof settings[upper] === 'boolean') {
    return settings[upper] === true;
  }
  const raw = String(env[upper] ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function p13FlagsFromPolicy(flags: unknown): Record<string, boolean> {
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(flags as Record<string, unknown>)) {
    if (typeof value !== 'boolean') continue;
    const upper = key.toUpperCase().startsWith('P13_') ? key.toUpperCase() : `P13_${key.toUpperCase()}`;
    out[upper] = value;
  }
  return out;
}
