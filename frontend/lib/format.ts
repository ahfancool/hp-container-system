/**
 * Centralized formatting utilities for Indonesian localization.
 */

export function formatLongDate(date: string | Date | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(d);
}

export function formatTime(date: string | Date | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  const time = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
  
  // Use dot as separator common in Indonesia
  return `${time.replace(':', '.')} WIB`;
}

export function formatDateTime(date: string | Date | number): string {
  if (!date) return "-";
  return `${formatLongDate(date)}, ${formatTime(date)}`;
}

export function formatRelativeTime(date: string | Date | number): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  if (diffInSeconds < 5) return "baru saja";
  if (diffInSeconds < 60) return `${diffInSeconds} detik lalu`;
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} jam lalu`;
  
  return formatLongDate(d);
}
