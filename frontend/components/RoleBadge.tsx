import { Badge } from "./ui/Badge";

type RoleBadgeProps = {
  role: "student" | "teacher" | "homeroom" | "admin";
};

const roleLabels: Record<RoleBadgeProps["role"], string> = {
  admin: "Admin",
  homeroom: "Wali Kelas",
  student: "Siswa",
  teacher: "Guru"
};

export function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <Badge variant="primary" className="role-badge">
      {roleLabels[role]}
    </Badge>
  );
}

