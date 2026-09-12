import { MsosEmpty } from '@/components/media-os/MsosEmpty';
import { MSOS_EMPTY } from '@/lib/crm/msos-empty';

export default function MediaOsMarginPage() {
  return (
    <>
      <header className="msos-head">
        <div>
          <h1>Margin &amp; Deal</h1>
          <p>Waterfall contribution và finance request.</p>
        </div>
      </header>
      <MsosEmpty title="Margin & Deal" copy={MSOS_EMPTY.margin} />
    </>
  );
}
