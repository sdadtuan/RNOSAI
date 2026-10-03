'use client';

import { useParams } from 'next/navigation';
import { P13QuotesScreen } from '../screen';

export default function P13QuoteEditPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  return <P13QuotesScreen quoteId={Number.isFinite(id) ? id : null} />;
}
