import { MsosEmpty } from '@/components/media-os/MsosEmpty';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';

export default function MediaOsInventoryPage() {
  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Inventory &amp; Rate</h1>
          <p>Placement, capacity calendar và rate card published.</p>
        </div>
      </header>
      <MsosEmpty title="Inventory & Rate" copy={MSOS_EMPTY.inventory} />
    </>
  );
}
