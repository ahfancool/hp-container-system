import type { AuthSnapshot } from "../context/AuthContext";

export type NavigationItem = {
  href: string;
  label: string;
};

export function getDefaultRoute(snapshot: AuthSnapshot | null): string {
  if (!snapshot) {
    return "/login";
  }

  if (snapshot.appUser.role === "student") {
    return "/scan";
  }

  return "/dashboard";
}

export function getNavigationItems(snapshot: AuthSnapshot | null): NavigationItem[] {
  if (!snapshot) {
    return [];
  }

  if (snapshot.appUser.role === "student") {
    return [{ href: "/scan", label: "Scan" }];
  }

  if (
    snapshot.appUser.role === "teacher" ||
    snapshot.appUser.role === "homeroom"
  ) {
    return [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/teacher/approve", label: "Approval" }
    ];
  }

  return [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/admin/containers", label: "Container" },
    { href: "/admin/audit", label: "Audit" }
  ];
}
