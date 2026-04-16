import { Card } from "./ui/Card";

type StatusCardProps = {
  label: string;
  value: string;
  detail: string;
};

export function StatusCard({ label, value, detail }: StatusCardProps) {
  return (
    <Card className="status-card">
      <span className="status-label">{label}</span>
      <strong className="status-value">{value}</strong>
      <p className="status-detail">{detail}</p>
    </Card>
  );
}

