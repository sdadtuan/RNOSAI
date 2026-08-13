'use client';

type Props = {
  text: string;
  label?: string;
  onCopied?: () => void;
};

export function CopyScriptButton({ text, label = 'Copy script', onCopied }: Props) {
  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      onCopied?.();
    } catch {
      /* ignore */
    }
  }

  return (
    <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onCopy()}>
      {label}
    </button>
  );
}
