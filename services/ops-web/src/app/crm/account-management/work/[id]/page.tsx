import { AmWorkItem } from '@/components/crm/am/AmWorkItem';

export default function AmWorkDetailPage({ params }: { params: { id: string } }) {
  return <AmWorkItem taskId={params.id} />;
}
