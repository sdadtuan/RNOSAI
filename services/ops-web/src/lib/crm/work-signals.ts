export const WORK_SIGNALS = {
  ptt: '#17692f',
  pttDeep: '#114d24',
  hot: '#e11d48',
  warm: '#ea580c',
  gold: '#ca8a04',
  sky: '#0284c7',
  iris: '#7c3aed',
  won: '#059669',
  cold: '#94a3b8',
} as const;

export type WorkSignalKey = keyof typeof WORK_SIGNALS;
