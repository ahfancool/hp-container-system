import Link from "next/link";
import React, { useEffect, useState, useMemo } from "react";
import { Layout } from "../components/Layout";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useAuth } from "../context/AuthContext";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { getDefaultRoute } from "../lib/navigation";

type Transaction = {
  id: string;
  action: "IN" | "OUT";
  type: "REGULAR" | "PEMBELAJARAN" | "DARURAT";
  timestamp: string;
  container: {
    name: string;
  };
};

type FilterType = "today" | "week" | "month" | "all";

export default function HistoryPage() {
  const { isReady, session, snapshot } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  const studentId = snapshot?.student?.id;

  useEffect(() => {
    if (!isReady || !session || !studentId) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      const supabase = getSupabaseBrowserClient();
      
      const { data, error } = await supabase
        .from("phone_transactions")
        .select(`
          id,
          action,
          type,
          timestamp,
          container:containers(name)
        `)
        .eq("student_id", studentId)
        .order("timestamp", { ascending: false });

      if (error) {
        console.error("Gagal memuat histori:", error);
      } else {
        setTransactions((data as any[]) || []);
      }
      setIsLoading(false);
    };

    void fetchHistory();
  }, [isReady, session, studentId]);

  const filteredTransactions = useMemo(() => {
    if (filter === "all") return transactions;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // For week, we'll use last 7 days for simplicity or current week
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - 7);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return transactions.filter((t) => {
      const tDate = new Date(t.timestamp);
      if (filter === "today") return tDate >= startOfToday;
      if (filter === "week") return tDate >= startOfWeek;
      if (filter === "month") return tDate >= startOfMonth;
      return true;
    });
  }, [transactions, filter]);

  const summaryMetric = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthInTransactions = transactions.filter(t => 
      t.action === "IN" && new Date(t.timestamp) >= startOfMonth
    );

    const uniqueDays = new Set(
      monthInTransactions.map(t => new Date(t.timestamp).toDateString())
    );

    return uniqueDays.size;
  }, [transactions]);

  const getBadgeClass = (action: string, type: string) => {
    if (action === "IN") return "status-inside";
    if (type === "PEMBELAJARAN") return "status-outside"; // blue in our mapping
    if (type === "DARURAT") return "status-danger"; // red
    return "status-pending"; // orange for OUT REGULAR
  };

  const formatDateTime = (isoString: string) => {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(isoString));
  };

  if (!isReady) {
    return (
      <Layout title="Histori Transaksi" eyebrow="Memuat...">
        <div className="flex flex-col gap-4">
          <Skeleton height="100px" />
          <Skeleton height="200px" />
        </div>
      </Layout>
    );
  }

  if (!session || !snapshot || snapshot.appUser.role !== "student") {
    return (
      <Layout title="Akses Ditolak" eyebrow="Histori">
        <Card className="p-8 text-center">
          <p className="lead">Halaman ini hanya untuk siswa.</p>
          <div className="button-row justify-center">
            <Link href={snapshot ? getDefaultRoute(snapshot) : "/login"} className="primary-button">
              Kembali
            </Link>
          </div>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout title="Histori Transaksi" eyebrow="Siswa">
      <div className="flex flex-col gap-8">
        <section className="hero-grid">
          <Card className="p-8">
            <div className="panel-header">
              <span className="panel-tag">Statistik Bulan Ini</span>
              <h2>Ringkasan Titipan</h2>
            </div>
            <div className="flex items-end gap-4 mt-4">
              <strong style={{ fontSize: '3rem', lineHeight: 1 }}>{summaryMetric}</strong>
              <p className="lead mb-2">Hari HP dititipkan</p>
            </div>
            <p className="session-meta mt-4">
              Total hari unik di mana kamu melakukan scan masuk ke container pada bulan ini.
            </p>
          </Card>

          <div className="signal-panel">
            <span className="signal-label">Filter Waktu</span>
            <div className="flex flex-col gap-2 mt-2">
              <button 
                className={`secondary-button ${filter === 'today' ? 'is-active-toggle' : ''}`}
                onClick={() => setFilter('today')}
              >
                Hari Ini
              </button>
              <button 
                className={`secondary-button ${filter === 'week' ? 'is-active-toggle' : ''}`}
                onClick={() => setFilter('week')}
              >
                7 Hari Terakhir
              </button>
              <button 
                className={`secondary-button ${filter === 'month' ? 'is-active-toggle' : ''}`}
                onClick={() => setFilter('month')}
              >
                Bulan Ini
              </button>
              <button 
                className={`secondary-button ${filter === 'all' ? 'is-active-toggle' : ''}`}
                onClick={() => setFilter('all')}
              >
                Semua
              </button>
            </div>
          </div>
        </section>

        <section className="content-panel">
          <div className="panel-header">
            <span className="panel-tag">Daftar Transaksi</span>
            <h2>Histori Penggunaan Container</h2>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-4">
              <Skeleton height="80px" borderRadius="14px" />
              <Skeleton height="80px" borderRadius="14px" />
              <Skeleton height="80px" borderRadius="14px" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <EmptyState 
              title="Belum ada transaksi" 
              description="Kamu belum memiliki histori transaksi untuk periode ini."
            />
          ) : (
            <div className="activity-table">
              {filteredTransactions.map((t) => (
                <div key={t.id} className="activity-row">
                  <div className="activity-main-info">
                    <div className={`activity-icon-badge ${t.action === 'IN' ? 'is-in' : 'is-out'}`}>
                      {t.action === 'IN' ? '↓' : '↑'}
                    </div>
                    <div className="activity-student-info">
                      <strong>{t.container?.name || "Unknown Container"}</strong>
                      <span className="session-meta">{formatDateTime(t.timestamp)}</span>
                    </div>
                  </div>
                  <div className="activity-type-info">
                    <span className={`status-badge ${getBadgeClass(t.action, t.type)}`}>
                      {t.action === 'IN' ? 'MASUK' : `KELUAR ${t.type !== 'REGULAR' ? t.type : ''}`}
                    </span>
                  </div>
                  <div className="activity-meta-info desktop-only text-right">
                    <span className="session-meta">Aksi: {t.action}</span>
                    <span className="session-meta">Tipe: {t.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
