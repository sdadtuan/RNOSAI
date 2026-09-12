import { MsosEmpty } from '@/components/media-os/MsosEmpty';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';

export default function MediaOsOutcomesPage() {
  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Outcomes</h1>
          <p>Outcome links tới lead/sale CRM đã có.</p>
        </div>
      </header>
      <MsosEmpty title="Outcomes" copy={MSOS_EMPTY.outcomes} />
    </>
  );
}
