/**
 * Central route → { title, description } map for the dashboard header.
 * Used by PageHeaderContent so the header shows dynamic section info.
 * Pass `tab` when on /settings to get the sub-section title.
 */

import { ADMIN_PANEL_PATH } from "@/lib/routes";

const SETTINGS_HEADERS: Record<string, { title: string; description: string }> = {
  org:       { title: "Org profile", description: "Organization name, logo, and contact details." },
  overview:  { title: "Org profile", description: "Organization name, logo, and contact details." },
  account:   { title: "Account",   description: "Your personal account details." },
  people:    { title: "People",    description: "Manage who has access to your workspace." },
  members:   { title: "Members",   description: "Manage who has access to your workspace." },
  proposals: { title: "Proposal Settings", description: "Configure proposal defaults and approval workflow." },
  notifications: { title: "Notifications", description: "Choose what you get notified about." },
  billing:   { title: "Billing",   description: "Plans and subscription management." },
  pricing:   { title: "Pricing",   description: "Set up your default pricing rules and rate cards." },
  workflow:  { title: "Workflow",  description: "Configure your team's approval and delivery workflow." },
};

export function getPageHeader(
  pathname: string | null,
  tab?: string | null
): { title: string; description: string } {
  const base = pathname ?? "";

  if (base === "/dashboard") {
    return { title: "Overview", description: "Welcome back! Here's your firm at a glance." };
  }
  if (base === "/clients") {
    return { title: "Clients", description: "Manage and grow your client relationships." };
  }
  if (/^\/clients\/[^/]+$/.test(base)) {
    return { title: "Client Details", description: "View entities, proposals, and history for this client." };
  }
  if (base === "/proposals") {
    return { title: "Proposals", description: "Create, track, and close client engagements." };
  }
  if (base === "/proposals/new") {
    return { title: "New Proposal", description: "Build a tailored proposal for a client." };
  }
  if (/^\/proposals\/[^/]+$/.test(base)) {
    return { title: "Proposal", description: "Review and manage this proposal." };
  }
  if (base === "/services") {
    return { title: "Services", description: "Your service catalog and pricing templates." };
  }
  if (base === "/engagement-letters") {
    return { title: "Engagement Letters", description: "Manage client agreements and signatures." };
  }
  if (base === "/engagement-letters/settings") {
    return {
      title: "Suite & firm settings",
      description: "Letterhead, key dates, people, emails, and global scope text — all in one place.",
    };
  }
  if (base === "/work-planning") {
    return { title: "Work Planning", description: "Schedule and track client deliverables." };
  }
  if (base === "/cash-flow") {
    return { title: "Cash Flow", description: "Monitor revenue streams and collections." };
  }
  if (base === "/settings") {
    return SETTINGS_HEADERS[tab ?? "org"] ?? SETTINGS_HEADERS.org;
  }
  if (base === "/contacts") {
    return { title: "Contacts", description: "Individual contacts linked to your clients." };
  }
  if (base === "/services/pricing-tool") {
    return { title: "Pricing Tool", description: "Build and model pricing scenarios for your services." };
  }
  if (base === "/packages") {
    return { title: "Packages", description: "Bundled service packages for your proposals." };
  }
  if (base === "/templates") {
    return { title: "Templates", description: "Proposal templates and email sequences." };
  }
  if (base === "/appsmap") {
    return { title: "Apps Map", description: "Visualise your tech stack and integrations." };
  }
  if (base === ADMIN_PANEL_PATH || base === "/administrator") {
    return { title: "Admin", description: "Firm administration, team, and permissions." };
  }
  if (base === "/super/support") {
    return { title: "Support", description: "Reply to team members who messaged support from the dashboard." };
  }

  return { title: "NorthPact", description: "" };
}
