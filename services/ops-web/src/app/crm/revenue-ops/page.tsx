'use client';

import { RevOpsQuickCreateButton } from '@/components/crm/revops/RevOpsModalsProvider';

export default function RevenueOpsCommandCenterPage() {
  return (
    <header className="revops-page-head">
      <div>
        <h1>Sales & Account Command Center</h1>
        <p>Toàn cảnh doanh thu, pipeline, hiệu suất đội ngũ và khách hàng có rủi ro.</p>
      </div>
      <div className="revops-page-actions">
        <RevOpsQuickCreateButton />
      </div>
    </header>
  );
}
