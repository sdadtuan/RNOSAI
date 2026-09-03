'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchB2bProjects, type B2bProjectListItem } from '@/lib/b2b-projects-api';
import { iwrB2bProjectCatalog } from './iwr-b2b-project';

export function useIwrB2bProjects(token: string | null | undefined) {
  const [projects, setProjects] = useState<B2bProjectListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setProjects([]);
      setError('');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    void fetchB2bProjects(token)
      .then((rows) => {
        if (cancelled) return;
        setProjects(rows.sort((a, b) => a.code.localeCompare(b.code, 'vi')));
      })
      .catch((err) => {
        if (cancelled) return;
        setProjects([]);
        setError(err instanceof Error ? err.message : 'Tải dự án PTT thất bại');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const catalog = useMemo(() => iwrB2bProjectCatalog(projects), [projects]);

  return { projects, catalog, loading, error };
}
