import { MsosEmpty } from '@/components/media-os/MsosEmpty';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';

export default function MediaOsPackagesPage() {
  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Packages</h1>
          <p>Package lines, reserve và tạo insertion order.</p>
        </div>
      </header>
      <MsosEmpty title="Packages" copy={MSOS_EMPTY.packages} />
    </>
  );
}
