export type CsdChatShell = 'crm' | 'pwa' | 'desktop' | 'native';

export function detectCsdChatShell(input: {
  search: string;
  displayMode?: string;
  iosStandalone?: boolean;
}): CsdChatShell {
  const shell = new URLSearchParams(input.search.startsWith('?') ? input.search.slice(1) : input.search).get('shell');
  if (shell === 'desktop') return 'desktop';
  if (shell === 'native') return 'native';
  if (shell === 'pwa' || input.displayMode === 'standalone' || input.iosStandalone === true) {
    return 'pwa';
  }
  return 'crm';
}

export function isNativeChatPublicPath(pathname: string, shell: string | null): boolean {
  return pathname === '/crm/csd/chat' && shell === 'native';
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
