'use client';

import { useCallback, useEffect, useState } from 'react';
import type { VnProvinceOption, VnWardOption } from '@/lib/vn-geo-api';
import { fetchVnProvinces, fetchVnWards } from '@/lib/vn-geo-api';

type Cache = {
  provinces: VnProvinceOption[] | null;
  wardsByProvince: Map<string, VnWardOption[]>;
};

const cache: Cache = {
  provinces: null,
  wardsByProvince: new Map(),
};

export function useVnGeo(token: string | null) {
  const [provinces, setProvinces] = useState<VnProvinceOption[]>(cache.provinces ?? []);
  const [loadingProvinces, setLoadingProvinces] = useState(!cache.provinces);

  useEffect(() => {
    if (!token) return;
    if (cache.provinces) {
      setProvinces(cache.provinces);
      setLoadingProvinces(false);
      return;
    }
    let cancelled = false;
    setLoadingProvinces(true);
    void fetchVnProvinces(token)
      .then((rows) => {
        if (cancelled) return;
        cache.provinces = rows;
        setProvinces(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingProvinces(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const loadWards = useCallback(
    async (provinceCode: string): Promise<VnWardOption[]> => {
      if (!token || !provinceCode.trim()) return [];
      const key = provinceCode.trim();
      const cached = cache.wardsByProvince.get(key);
      if (cached) return cached;
      const rows = await fetchVnWards(token, key);
      cache.wardsByProvince.set(key, rows);
      return rows;
    },
    [token],
  );

  return { provinces, loadingProvinces, loadWards };
}
