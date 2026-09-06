'use client';

import {
  RevOpsQuickCreateButton,
  useRevopsModals,
} from '@/components/crm/revops/RevOpsModalsProvider';

function PipelineActions() {
  const { openDeal, openQuote } = useRevopsModals();
  return (
    <div className="revops-page-actions">
      <button type="button" className="revops-btn" onClick={() => openQuote()}>
        Tạo báo giá
      </button>
      <button type="button" className="revops-btn revops-btn--primary" onClick={() => openDeal()}>
        ＋ Tạo deal
      </button>
      <RevOpsQuickCreateButton />
    </div>
  );
}

export default function RevenueOpsPipelinePage() {
  return (
    <header className="revops-page-head">
      <div>
        <h1>Pipeline & Deal Management</h1>
        <p>Đang triển khai Wave 2.</p>
      </div>
      <PipelineActions />
    </header>
  );
}
