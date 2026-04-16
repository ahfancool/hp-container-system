import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "../context/AuthContext";
import { getNavigationItems, getDefaultRoute } from "../lib/navigation";
import { HeaderSessionStatus } from "./HeaderSessionStatus";

type LayoutProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
};

const PUBLIC_ROUTES = ["/", "/login"];

function getIcon(label: string) {
  switch (label.toLowerCase()) {
    case "scan":
      return (
        <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
      );
    case "riwayat":
    case "histori":
    case "audit":
      return (
        <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "dashboard":
      return (
        <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      );
    case "approve":
      return (
        <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "containers":
      return (
        <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      );
    default:
      return (
        <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
  }
}

export function Layout({ title, eyebrow, children }: LayoutProps) {
  const { snapshot, isReady } = useAuth();
  const router = useRouter();
  const navigationItems = getNavigationItems(snapshot);

  useEffect(() => {
    if (!isReady) return;

    const isPublicRoute = PUBLIC_ROUTES.includes(router.pathname);
    if (!snapshot) {
      if (!isPublicRoute) {
        void router.replace(`/login?redirect=${encodeURIComponent(router.asPath)}`);
      }
      return;
    }

    // Route Guard: If logged in but accessing unauthorized page
    if (!isPublicRoute) {
      const hasAccess = navigationItems.some(item => router.pathname.startsWith(item.href));
      if (!hasAccess && router.pathname !== getDefaultRoute(snapshot)) {
         void router.replace(getDefaultRoute(snapshot));
      }
    }
  }, [isReady, snapshot, router, navigationItems]);

  return (
    <div className="nav-layout">
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </Head>

      {/* Desktop Sidebar */}
      {snapshot && (
        <aside className="desktop-sidebar">
          <Link href="/" className="sidebar-brand">
            <span className="topbar-label" style={{ margin: 0 }}>HP Container</span>
            <strong className="text-xl">Sistem Sekolah</strong>
          </Link>
          
          <nav className="sidebar-nav">
            {navigationItems.map((item) => {
              const isActive = router.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${isActive ? "is-active" : ""}`}
                >
                  {getIcon(item.label)}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-line">
            <HeaderSessionStatus />
          </div>
        </aside>
      )}

      <div className="main-content-wrapper">
        {/* Mobile Topbar */}
        <header className="topbar lg:hidden">
          <Link className="topbar-brand" href="/">
            <p className="topbar-label">{eyebrow}</p>
            <h1 className="topbar-title">{title}</h1>
          </Link>
          <HeaderSessionStatus />
        </header>

        <main className="page-body">
           <div className="app-shell">
              {children}
           </div>
        </main>

        {/* Mobile Bottom Nav */}
        {snapshot && (
          <nav className="mobile-bottom-nav">
            {navigationItems.map((item) => {
              const isActive = router.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-nav-item ${isActive ? "is-active" : ""}`}
                >
                  {getIcon(item.label)}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
