import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

import { useAuth } from "../context/AuthContext";
import { getNavigationItems } from "../lib/navigation";
import { HeaderSessionStatus } from "./HeaderSessionStatus";

type LayoutProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
};

export function Layout({ title, eyebrow, children }: LayoutProps) {
  const { snapshot } = useAuth();
  const router = useRouter();
  const navigationItems = getNavigationItems(snapshot);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta
          name="description"
          content="Sistem manajemen container HP sekolah berbasis Supabase dan Cloudflare."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="app-shell">
        <header className="topbar">
          <Link className="topbar-brand" href="/">
            <p className="topbar-label">{eyebrow}</p>
            <h1 className="topbar-title">{title}</h1>
          </Link>
          <div className="topbar-actions">
            {navigationItems.length > 0 ? (
              <nav className="topbar-nav" aria-label="Primary">
                {navigationItems.map((item) => {
                  const isActive = router.pathname === item.href;

                  return (
                    <Link
                      className={isActive ? "is-active" : undefined}
                      href={item.href}
                      key={item.href}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            ) : null}
            <HeaderSessionStatus />
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </>
  );
}
