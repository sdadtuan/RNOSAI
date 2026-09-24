export type CsdChatShell = 'crm' | 'pwa' | 'desktop';

export function detectCsdChatShell(input: {
  search: string;
  displayMode?: string;
  iosStandalone?: boolean;
}): CsdChatShell {
  const shell = new URLSearchParams(input.search).get('shell');
  if (shell === 'desktop') return 'desktop';
  if (shell === 'pwa' || input.displayMode === 'standalone' || input.iosStandalone === true) {
    return 'pwa';
  }
  return 'crm';
}

export function readCsdChatShell(): CsdChatShell {
  if (typeof window === 'undefined') return 'crm';
  const ios = window.navigator as Navigator & { standalone?: boolean };
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches
    ? 'standalone'
    : 'browser';
  return detectCsdChatShell({
    search: window.location.search,
    displayMode,
    iosStandalone: ios.standalone === true,
  });
}
