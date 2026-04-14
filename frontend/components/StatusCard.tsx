type StatusCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function StatusCard({ label, value, detail }: StatusCardProps) {
  return (
    <article className="status-card">
      <span className="status-label">{label}</span>
      <strong className="status-value">{value}</strong>
      <p className="status-detail">{detail}</p>
    </article>
  );
}

