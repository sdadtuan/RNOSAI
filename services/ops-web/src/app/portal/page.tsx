'use client';

import { useEffect } from 'react';

export default function PortalRedirectPage() {
  useEffect(() => {
    window.location.replace('/client/dashboard');
  }, []);
  return null;
}
