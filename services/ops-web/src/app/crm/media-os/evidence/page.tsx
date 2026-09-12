import { MsosEmpty } from '@/components/media-os/MsosEmpty';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';

export default function MediaOsEvidencePage() {
  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Evidence</h1>
          <p>Evidence pack, discrepancy và make-good.</p>
        </div>
      </header>
      <MsosEmpty title="Evidence" copy={MSOS_EMPTY.evidence} />
    </>
  );
}
