import { type AppEnv, requireRuntimeConfig } from "./env";
import { createServiceRoleClient } from "./supabase";
import { safeRecordAuditEvent } from "./audit";

export async function sendWeeklyReport(env: AppEnv): Promise<{ success: boolean; message: string }> {
  const config = requireRuntimeConfig(env);
  const client = createServiceRoleClient(env);
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString();

  try {
    // 1. Aggregate Transactions
    const { data: transactions, error: txError } = await client
      .from("phone_transactions")
      .select("action")
      .gte("timestamp", sevenDaysAgoISO);

    if (txError) throw new Error(`TX Aggregation failed: ${txError.message}`);

    const totalTx = transactions.length;
    const inTx = transactions.filter(t => t.action === "IN").length;
    const outTx = transactions.filter(t => t.action === "OUT").length;

    // 2. Aggregate Approvals
    const { data: approvals, error: apError } = await client
      .from("teacher_approvals")
      .select("id")
      .gte("approved_at", sevenDaysAgoISO);

    if (apError) throw new Error(`AP Aggregation failed: ${apError.message}`);
    const totalAp = approvals.length;

    // 3. Aggregate Violations
    const { data: violations, error: viError } = await client
      .from("student_violations")
      .select("id")
      .gte("timestamp", sevenDaysAgoISO);

    if (viError) throw new Error(`VI Aggregation failed: ${viError.message}`);
    const totalVi = violations.length;

    // 4. Render HTML Template
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #2563eb;">Laporan Mingguan Sistem Container HP</h2>
        <p style="color: #64748b;">Ringkasan operasional dari 7 hari terakhir.</p>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Total Transaksi</strong>
            <span style="font-size: 1.5rem; font-weight: bold; color: #1e293b;">${totalTx}</span>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 5px;">
              IN: ${inTx} | OUT: ${outTx}
            </div>
          </div>
          <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <strong style="display: block; font-size: 0.8rem; color: #64748b; text-transform: uppercase;">Teacher Approvals</strong>
            <span style="font-size: 1.5rem; font-weight: bold; color: #1e293b;">${totalAp}</span>
          </div>
          <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #fecaca;">
            <strong style="display: block; font-size: 0.8rem; color: #991b1b; text-transform: uppercase;">Pelanggaran Siswa</strong>
            <span style="font-size: 1.5rem; font-weight: bold; color: #991b1b;">${totalVi}</span>
          </div>
        </div>
        
        <p style="font-size: 0.8rem; color: #94a3b8; margin-top: 30px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px;">
          Laporan ini dibuat otomatis oleh sistem. Jangan membalas email ini.
        </p>
      </div>
    `;

    // 5. Send via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: "HP Container System <reports@resend.dev>", // Should be a verified domain in production
        to: config.ADMIN_EMAILS.split(",").map(e => e.trim()),
        subject: `Weekly Operational Report - ${new Date().toLocaleDateString("id-ID")}`,
        html: html
      })
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      throw new Error(`Resend API failed: ${errorData.message || response.statusText}`);
    }

    // 6. Audit Log Success
    await safeRecordAuditEvent(env, {
      eventType: "system.weekly_report_sent",
      severity: "INFO",
      details: { totalTx, totalAp, totalVi, recipients: config.ADMIN_EMAILS },
      requestMeta: { requestId: "system-cron", method: "CRON", path: "sendWeeklyReport", clientIp: "127.0.0.1", userAgent: "Cloudflare-Cron" }
    });

    return { success: true, message: "Laporan mingguan berhasil dikirim." };

  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_REPORT_ERROR";
    
    // Audit Log Failure
    await safeRecordAuditEvent(env, {
      eventType: "system.weekly_report_failed",
      severity: "ERROR",
      details: { error: message },
      requestMeta: { requestId: "system-cron", method: "CRON", path: "sendWeeklyReport", clientIp: "127.0.0.1", userAgent: "Cloudflare-Cron" }
    });

    return { success: false, message };
  }
}
