import type { AppEnv } from "./env";

const DEFAULT_REGULAR_IN_ALLOWED_START = "06:30";
const DEFAULT_REGULAR_IN_ALLOWED_END = "07:30";
const DEFAULT_REGULAR_OUT_ALLOWED_TIME = "12:30";
const DEFAULT_SCHOOL_TIMEZONE = "Asia/Jakarta";

function normalizeAllowedTime(
  value: string | undefined,
  fallback: string,
  errorCode: string
): string {
  const nextValue = value?.trim() || fallback;

  if (!/^\d{2}:\d{2}$/.test(nextValue)) {
    throw new Error(errorCode);
  }

  return nextValue;
}

export function getSchoolTimezone(env: AppEnv): string {
  return env.SCHOOL_TIMEZONE?.trim() || DEFAULT_SCHOOL_TIMEZONE;
}

export function getRegularOutAllowedTime(env: AppEnv): string {
  return normalizeAllowedTime(
    env.REGULAR_OUT_ALLOWED_TIME,
    DEFAULT_REGULAR_OUT_ALLOWED_TIME,
    "INVALID_REGULAR_OUT_ALLOWED_TIME"
  );
}

export function getRegularInAllowedStart(env: AppEnv): string {
  return normalizeAllowedTime(
    env.REGULAR_IN_ALLOWED_START,
    DEFAULT_REGULAR_IN_ALLOWED_START,
    "INVALID_REGULAR_IN_ALLOWED_START"
  );
}

export function getRegularInAllowedEnd(env: AppEnv): string {
  return normalizeAllowedTime(
    env.REGULAR_IN_ALLOWED_END,
    DEFAULT_REGULAR_IN_ALLOWED_END,
    "INVALID_REGULAR_IN_ALLOWED_END"
  );
}

function getLocalClock(timestamp: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone
  }).format(new Date(timestamp));
}

function isClockInsideWindow(
  currentLocalTime: string,
  windowStart: string,
  windowEnd: string
): boolean {
  if (windowStart <= windowEnd) {
    return currentLocalTime >= windowStart && currentLocalTime <= windowEnd;
  }

  return currentLocalTime >= windowStart || currentLocalTime <= windowEnd;
}

export function getRegularOutWindow(env: AppEnv, timestamp: string) {
  const timeZone = getSchoolTimezone(env);
  const allowedAt = getRegularOutAllowedTime(env);
  const currentLocalTime = getLocalClock(timestamp, timeZone);

  return {
    allowedAt,
    currentLocalTime,
    endsAt: null,
    isAllowed: currentLocalTime >= allowedAt,
    timeZone
  };
}

export function getRegularInWindow(env: AppEnv, timestamp: string) {
  const timeZone = getSchoolTimezone(env);
  const allowedAt = getRegularInAllowedStart(env);
  const endsAt = getRegularInAllowedEnd(env);
  const currentLocalTime = getLocalClock(timestamp, timeZone);

  return {
    allowedAt,
    currentLocalTime,
    endsAt,
    isAllowed: isClockInsideWindow(currentLocalTime, allowedAt, endsAt),
    timeZone
  };
}
