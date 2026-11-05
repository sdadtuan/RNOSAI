'use client';

import { useEffect, useState } from 'react';
import { fetchStaffAvatarBlob } from '@/lib/api';

export function useStaffAvatarBlob(token: string | null, hasAvatar: boolean, avatarUpdatedAt?: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !hasAvatar) {
      setUrl(null);
      return;
    }
    let revoked = false;
    let objectUrl: string | null = null;
    void fetchStaffAvatarBlob(token)
      .then((blob) => {
        if (revoked || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, hasAvatar, avatarUpdatedAt]);

  return url;
}
