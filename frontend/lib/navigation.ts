import type { AuthSnapshot } from "../context/AuthContext";

export type NavigationItem = {
  href: string;
  label: string;
};

export function getDefaultRoute(snapshot: AuthSnapshot | null): string {
  if (!snapshot) {
    return "/login";
  }

  const role = snapshot.appUser.role;

  if (role === "student") {
    return "/scan";
  }

  if (role === "admin") {
    return "/admin/containers"; // Or just /admin if it exists, checking project structure
  }

  return "/dashboard";
}

export function getNavigationItems(snapshot: AuthSnapshot | null): NavigationItem[] {
  if (!snapshot) {
    return [];
  }

  const role = snapshot.appUser.role;

  if (role === "student") {
    return [
      { href: "/scan", label: "Scan QR" },
      { href: "/history", label: "Riwayat" }
    ];
  }

  if (role === "teacher" || role === "homeroom") {
    return [
      { href: "/dashboard", label: "Monitoring" },
      { href: "/teacher/approve", label: "Izin Guru" }
    ];
  }

  if (role === "admin") {
    return [
      { href: "/dashboard", label: "Monitoring" },
      { href: "/admin/containers", label: "Kontainer" },
      { href: "/admin/audit", label: "Log Audit" }
    ];
  }

  return [];
}
