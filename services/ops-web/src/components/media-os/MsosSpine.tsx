const MSOS_SPINE_STEPS = [
  '1 Inventory',
  '2 Rate',
  '3 Package',
  'IO',
  'Traffic',
  '4 Line',
  'Pack',
  '5 Evidence',
  'Make-good',
  '6 Outcome',
  '7 Margin',
] as const;

const MSOS_SECTION4_LOCKS = [
  '§4 Write connector',
  '§4 Cổng C',
  '§4 Recon sâu',
  '§4 Portal',
] as const;

export function MsosSpine() {
  return (
    <div className="msos-spine" aria-label="Media OS workflow">
      {MSOS_SPINE_STEPS.map((step) => (
        <em key={step}>{step}</em>
      ))}
      {MSOS_SECTION4_LOCKS.map((chip) => (
        <em key={chip} className="lock">
          {chip}
        </em>
      ))}
    </div>
  );
}
