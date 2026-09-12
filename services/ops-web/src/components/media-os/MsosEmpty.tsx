type MsosEmptyProps = {
  title: string;
  copy: string;
};

export function MsosEmpty({ title, copy }: MsosEmptyProps) {
  return (
    <section className="msos-empty" aria-label={title}>
      <h3>{title}</h3>
      <p>{copy}</p>
    </section>
  );
}
