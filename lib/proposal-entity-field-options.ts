import type { EntityType } from "@/types";

/** Legal form — used in proposal builder entity block (matches CRM-style enums). */
export const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "company", label: "Company (Pty Ltd)" },
  { value: "close_corporation", label: "Close corporation (CC)" },
  { value: "trust", label: "Trust" },
  { value: "partnership", label: "Partnership" },
  { value: "non_profit", label: "Non-profit / NPC" },
  { value: "other", label: "Other" },
];

/** Turn legacy free-text / Xero labels into a select value. */
export function coerceEntityTypeForSelect(raw: string): EntityType {
  const r = raw.trim().toLowerCase();
  if (!r) return "company";
  const direct = ENTITY_TYPE_OPTIONS.some((o) => o.value === r);
  if (direct) return r as EntityType;
  if (r.includes("trust")) return "trust";
  if (r.includes("partner")) return "partnership";
  if (r.includes("cc") || r.includes("close corporation")) return "close_corporation";
  if (r.includes("individual") || r === "person") return "individual";
  if (r.includes("non-profit") || r.includes("npc")) return "non_profit";
  if (r === "organisation" || r === "organization" || r.includes("company") || r.includes("pty"))
    return "company";
  if (raw === "Organisation" || raw === "Organization") return "company";
  if (raw === "Individual") return "individual";
  return "other";
}

/** Annual turnover bands — used in pricing / scoping (aligned with Xero “Not Applicable” default). */
export const REVENUE_RANGE_OPTIONS = [
  "Not Applicable",
  "Under R1 million",
  "R1 million – R5 million",
  "R5 million – R20 million",
  "Over R20 million",
] as const;

export const INCOME_TAX_RANGE_OPTIONS = [
  "Not Applicable",
  "Micro enterprise",
  "Small business",
  "Medium",
  "Large / listed",
] as const;
