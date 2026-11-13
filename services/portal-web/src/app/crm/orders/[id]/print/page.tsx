'use client';

import { useEffect, useState } from 'react';
import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { getToken, getStoredUser } from '@/lib/auth';
import { posGet, type PosOrder } from '@/lib/portal-pos-api';
import { PortalPosInvoice } from '@/components/portal-pos/PortalPosOrderDetail';

function OrderPrintInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const size = search.get('size') === '80' ? '80' : 'a5';
  const [order, setOrder] = useState<PosOrder | null>(null);
  const [shop, setShop] = useState('');
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    void posGet<{ order: PosOrder }>(token, `/api/portal/pos/orders/${params.id}`).then((r) => {
      setOrder(r.order);
      const user = getStoredUser() as { client_name?: string } | null;
      setShop(user?.client_name || '');
    });
  }, [params.id]);
  useEffect(() => {
    if (!order) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [order]);
  if (!order) return <p>Đang tải hóa đơn…</p>;
  return <PortalPosInvoice order={order} size={size} shop={shop} />;
}

export default function OrderPrintPage() {
  return (
    <Suspense fallback={<p>Đang tải hóa đơn…</p>}>
      <OrderPrintInner />
    </Suspense>
  );
}
