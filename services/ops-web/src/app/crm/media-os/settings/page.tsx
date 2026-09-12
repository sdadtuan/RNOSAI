import { MsosEmpty } from '@/components/media-os/MsosEmpty';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';

export default function MediaOsSettingsPage() {
  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Governance</h1>
          <p>Flags, policy registry và partner scorecard.</p>
        </div>
      </header>
      <MsosEmpty title="Governance" copy={MSOS_EMPTY.settings} />
    </>
  );
}
