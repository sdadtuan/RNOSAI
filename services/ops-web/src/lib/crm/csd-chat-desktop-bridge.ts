export type RnosDesktopBridge = {
  shell: 'desktop';
  focus: () => void;
  setUnread: (count: number) => void;
  openFile: (filePath: string) => Promise<boolean>;
  revealInFolder: (filePath: string) => Promise<boolean>;
  saveFile: (bytes: ArrayBuffer, fileName: string, fileId: string) => Promise<string | null>;
  hasLocalFile: (fileId: string) => Promise<string | null>;
};

export function readRnosDesktop(): RnosDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as Window & { rnosDesktop?: RnosDesktopBridge }).rnosDesktop;
  if (!bridge || bridge.shell !== 'desktop' || typeof bridge.openFile !== 'function') return null;
  return bridge;
}
