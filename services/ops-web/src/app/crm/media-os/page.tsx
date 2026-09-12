import { MsosEmpty } from '@/components/media-os/MsosEmpty';
import { MsosSpine } from '@/components/media-os/MsosSpine';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';

export default function MediaOsCommandPage() {
  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Media Command Center</h1>
          <p>Hàng đợi ngoại lệ publisher: overbook, evidence pack, make-good.</p>
        </div>
      </header>
      <MsosSpine />
      <MsosEmpty title="Command Center" copy={MSOS_EMPTY.command} />
    </>
  );
}
