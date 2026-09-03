'use client';

import { useEffect, useState } from 'react';
import { fetchCsdStaffAvatarBlob } from '@/lib/crm/csd-api';
import { avatarHue, initialsFromName } from '@/lib/crm/csd-chat-display';

type CsdChatAvatarProps = {
  token: string;
  name: string;
  seed: string | number;
  staffId?: number | null;
  hasAvatar?: boolean;
  avatarUpdatedAt?: string | null;
  className?: string;
};

export function CsdChatAvatar({
  token,
  name,
  seed,
  staffId,
  hasAvatar,
  avatarUpdatedAt,
  className = 'csd-chat-avatar',
}: CsdChatAvatarProps) {
  const [src, setSrc] = useState<string | null>(null);
  const hue = avatarHue(seed);
  const initials = initialsFromName(name);

  useEffect(() => {
    if (!token || !hasAvatar || staffId == null || staffId <= 0) {
      setSrc(null);
      return;
    }
    let revoked = false;
    let objectUrl: string | null = null;
    void fetchCsdStaffAvatarBlob(token, staffId)
      .then((blob) => {
        if (revoked || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => setSrc(null));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, hasAvatar, staffId, avatarUpdatedAt]);

  if (src) {
    return (
      <span className={`${className} csd-chat-avatar--photo`} aria-hidden>
        <img src={src} alt="" />
      </span>
    );
  }

  return (
    <span className={className} style={{ background: `hsl(${hue} 55% 42%)` }} aria-hidden>
      {initials}
    </span>
  );
}
