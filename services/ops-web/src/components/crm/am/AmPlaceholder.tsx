type AmPlaceholderProps = {
  title: string;
  wave: 2 | 3 | 4;
};

export function AmPlaceholder({ title, wave }: AmPlaceholderProps) {
  return (
    <div className="am-placeholder">
      <h1 className="am-placeholder__title">{title}</h1>
      <p className="am-placeholder__wave">
        {title} — mở ở Wave {wave}
      </p>
    </div>
  );
}
