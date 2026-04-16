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
      { href: "/scan", label: "Scan" },
      { href: "/history", label: "Histori" }
    ];
  }

  if (role === "teacher" || role === "homeroom") {
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/teacher/approve", label: "Approve" }
    ];
  }

  if (role === "admin") {
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/admin/containers", label: "Containers" },
      { href: "/admin/audit", label: "Audit" }
    ];
  }

  return [];
}
