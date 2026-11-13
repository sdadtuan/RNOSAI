'use client';

import { useEffect, useRef } from 'react';
import { pushToast, type ToastTone } from '@/lib/toast';

/** Pushes a toast when `message` becomes a new non-empty string. Renders nothing. */
export function ActionToast({
  message,
  tone,
}: {
  message: string | null | undefined;
  tone: ToastTone;
}) {
  const last = useRef<string>('');
  useEffect(() => {
    const text = String(message ?? '').trim();
    if (!text) {
      last.current = '';
      return;
    }
    if (text === last.current) return;
    last.current = text;
    pushToast(text, tone);
  }, [message, tone]);
  return null;
}

export function ActionErrorToast({ message }: { message: string | null | undefined }) {
  return <ActionToast message={message} tone="error" />;
}

export function ActionSuccessToast({ message }: { message: string | null | undefined }) {
  return <ActionToast message={message} tone="success" />;
}
