import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Xero import uses placeholder emails when contacts have no real email.
 * Returns true for emails like xero-{uuid}@import.placeholder.
 */
export function isPlaceholderEmail(email: string | undefined | null): boolean {
  if (!email || typeof email !== "string") return true;
  return email.endsWith("@import.placeholder");
}

/** Returns the email for display, or undefined if it's a placeholder (no real email). */
export function getDisplayEmail(email: string | undefined | null): string | undefined {
  if (!email || isPlaceholderEmail(email)) return undefined;
  return email;
}

export function formatCurrency(amount: number, currency = "ZAR"): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-ZA").format(n);
}

/** Accepts ISO strings, `Date`, or Unix ms (e.g. Convex `createdAt`). */
export function formatDate(date: string | Date | number): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date | number): string {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Dedupe by Convex `_id` (first row wins). Use when rendering lists to avoid duplicate React keys
 * if the same document appears twice (e.g. merged query results).
 */
export function dedupeById<T extends { _id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) {
    if (!map.has(item._id)) map.set(item._id, item);
  }
  return Array.from(map.values());
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function now(): string {
  return new Date().toISOString();
}
