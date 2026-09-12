import { MsosEmpty } from '@/components/media-os/MsosEmpty';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';

export default function MediaOsCampaignsPage() {
  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Campaigns</h1>
          <p>Media lines, traffic pack và Publisher Live Gate.</p>
        </div>
      </header>
      <MsosEmpty title="Campaigns" copy={MSOS_EMPTY.campaigns} />
    </>
  );
}
