import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

async function requireAuth(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  return identity;
}

const DEFAULT_ARTICLES = [
  {
    collection: "Get Started",
    title: "Set up your firm",
    slug: "set-up-firm",
    summary: "Complete your firm profile and configure NorthPact for day one",
    sortOrder: 0,
    body: `## Welcome to NorthPact

Getting set up is quick. Follow these steps to get your firm ready:

### 1. Complete your firm profile
Go to **Settings → Org Profile** and fill in:
- Firm name and logo
- Billing email and phone
- Jurisdiction and currency

### 2. Invite your team
Under **Settings → People**, invite staff by email and assign roles:
- **Owner** — full access
- **Admin** — manage settings and users
- **Senior** — create and manage proposals
- **Staff** — create proposals
- **View-only** — read access

### 3. Add your first client
Go to **Clients → All Clients** and add a client. Fill in their company name, contact name, and email.

### 4. Create your first proposal
Head to **Proposals → New Proposal**. Select a client, add services, and send it for e-signature.

### 5. Set up billing
Under **Settings → Billing**, upgrade to Pro or Business to unlock unlimited proposals and advanced features.

You're ready to go!`,
  },
  {
    collection: "Proposals",
    title: "Create and send proposals",
    slug: "proposals",
    summary: "How to build, send, and track proposals with e-signatures",
    sortOrder: 0,
    body: `## Proposals

Proposals are the core of NorthPact — build professional proposals and get them signed in minutes.

### Creating a proposal
1. Go to **Proposals → New Proposal**
2. Select the client
3. Add services and line items
4. Write your introduction and terms
5. Preview and click **Send**

### E-signatures
When you send a proposal, your client receives a link to view and sign it electronically. You'll be notified when they view and sign.

### Proposal statuses
- **Draft** — not yet sent
- **Sent** — emailed to client
- **Viewed** — client opened the link
- **Accepted** — client signed
- **Rejected** — client declined
- **Expired** — validity period passed

### Templates
Save time by creating proposal templates for common service packages under **Pricing → Services**.

### Tips
- Set a validity period (e.g. 30 days) so proposals don't stay open indefinitely
- Use the activity feed on the dashboard to track recent proposal actions`,
  },
  {
    collection: "Clients",
    title: "Manage clients and contacts",
    slug: "clients",
    summary: "Add clients, manage contacts, and track relationships",
    sortOrder: 0,
    body: `## Clients

Keep all your client information in one place.

### Adding a client
1. Go to **Clients → All Clients**
2. Click **New Client**
3. Fill in company name, contact name, email, phone, and industry
4. Add tags to categorise clients (e.g. "VIP", "Prospect")

### Contacts
Under **Clients → Contacts**, manage individual people across client companies. Each contact can be linked to a client.

### Client status
- **Prospect** — potential client, not yet active
- **Active** — current client
- **Inactive** — paused relationship
- **Archived** — no longer active

### Tips
- Use the search bar to quickly find clients by name or email
- Filter by status or industry to segment your client list
- Client notes help record context for proposals and meetings`,
  },
  {
    collection: "Pricing",
    title: "Services and pricing tool",
    slug: "pricing",
    summary: "Set up services, packages and use the pricing calculator",
    sortOrder: 0,
    body: `## Pricing & Services

Define your services and fees so building proposals is fast and consistent.

### Services
Go to **Pricing → Services** to create your service catalogue:
- Add service names, descriptions, and default fees
- Set whether fees are monthly, annual, or once-off
- Group services by type (audit, bookkeeping, tax, etc.)

### Pricing Tool
The **Pricing → Pricing Tool** helps you calculate fees based on client size and complexity:
- Set revenue ranges and fee tiers
- Configure tax rates and rounding rules
- Generate a fee estimate to paste into a proposal

### Packages
Under **Workflow → Packages**, bundle multiple services into named packages (e.g. "Starter", "Growth") for quick proposal building.

### Tips
- Keep your service catalogue up to date so proposals stay accurate
- Use the pricing tool for new client fee negotiations`,
  },
  {
    collection: "Workflow",
    title: "Workflow and approvals",
    slug: "workflow",
    summary: "Packages, engagement letters, work planning and cash flow",
    sortOrder: 0,
    body: `## Workflow

Manage your firm's internal processes from proposals to signed engagement letters.

### Packages
Create named service bundles under **Workflow → Packages**. Packages speed up proposal creation and ensure consistent pricing across your team.

### Engagement Letters
After a proposal is accepted, generate an **Engagement Letter** under **Workflow → Engagement Letters**. The letter is pre-filled from the proposal and can be sent for e-signature.

### Work Planning
Under **Workflow → Work Planning**, schedule and track work for active clients by month.

### Cash Flow
**Workflow → Cash Flow** gives you a projected revenue view based on active proposals and signed engagements.

### Approval Workflow
If enabled in Settings, proposals must be approved by a senior team member before they can be sent to clients.

### Tips
- Use engagement letters to formalise every client relationship
- Work planning helps you see capacity and avoid over-committing`,
  },
  {
    collection: "Settings",
    title: "Firm settings and billing",
    slug: "settings",
    summary: "Profile, people, billing, apps and integrations",
    sortOrder: 0,
    body: `## Settings

Manage your firm's profile, team, billing, and connected apps.

### Org Profile
Update your firm name, logo, billing email, phone, jurisdiction, and currency.

### People
Invite team members by email. Assign and change roles. Deactivate users who leave your firm.

### Billing
View your current plan (Starter, Pro, or Business) and upgrade or manage your subscription via Stripe.

### Apps Map
Connect integrations like Xero to sync client and invoice data automatically.

### Account
Update your personal profile, name, and notification preferences.

### Plans
- **Starter (Free)** — up to 3 proposals/month, 5 templates, basic e-signatures
- **Pro** — unlimited proposals, 50+ templates, full analytics, integrations
- **Business** — everything in Pro plus team collaboration, custom branding, API access, and SLA guarantee`,
  },
] as const;

/**
 * Seed default help articles. Idempotent.
 */
export const ensureSeeded = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null; // silently skip if not authed

    const existing = await ctx.db.query("help_articles").collect();
    const now = Date.now();

    if (existing.length === 0) {
      for (const a of DEFAULT_ARTICLES) {
        await ctx.db.insert("help_articles", {
          collection: a.collection,
          title: a.title,
          slug: a.slug,
          summary: a.summary,
          body: a.body,
          sortOrder: a.sortOrder,
          createdAt: now,
          updatedAt: now,
        });
      }
      return null;
    }

    const bySlug = new Map(existing.map((a) => [a.slug, a]));
    for (const def of DEFAULT_ARTICLES) {
      const ex = bySlug.get(def.slug);
      if (!ex) {
        await ctx.db.insert("help_articles", {
          collection: def.collection,
          title: def.title,
          slug: def.slug,
          summary: def.summary,
          body: def.body,
          sortOrder: def.sortOrder,
          createdAt: now,
          updatedAt: now,
        });
      } else if (ex && !ex.body) {
        await ctx.db.patch(ex._id, { body: def.body, updatedAt: now });
      }
    }
    return null;
  },
});

/**
 * List all collections with article counts and previews.
 */
export const listCollections = query({
  args: {},
  returns: v.array(
    v.object({
      collection: v.string(),
      count: v.number(),
      articles: v.array(
        v.object({
          _id: v.id("help_articles"),
          title: v.string(),
          slug: v.string(),
          summary: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx) => {
    await requireAuth(ctx);
    const all = await ctx.db.query("help_articles").collect();
    const byCollection = new Map<
      string,
      Array<{ _id: (typeof all)[0]["_id"]; title: string; slug: string; summary?: string }>
    >();
    for (const a of all) {
      const list = byCollection.get(a.collection) ?? [];
      list.push({ _id: a._id, title: a.title, slug: a.slug, summary: a.summary });
      byCollection.set(a.collection, list);
    }
    return Array.from(byCollection.entries())
      .map(([collection, articles]) => ({
        collection,
        count: articles.length,
        articles: articles.sort((a, b) => a.title.localeCompare(b.title)),
      }))
      .sort((a, b) => a.collection.localeCompare(b.collection));
  },
});

/**
 * Search articles by title/summary/body.
 */
export const search = query({
  args: { q: v.string(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("help_articles"),
      collection: v.string(),
      title: v.string(),
      slug: v.string(),
      summary: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const q = args.q.trim().toLowerCase();
    if (!q) return [];
    const limit = args.limit ?? 10;
    const all = await ctx.db.query("help_articles").collect();
    const scored = all
      .map((a) => {
        let score = 0;
        const title = (a.title ?? "").toLowerCase();
        const summary = (a.summary ?? "").toLowerCase();
        const body = (a.body ?? "").toLowerCase();
        if (title.includes(q)) score += 10;
        if (title.startsWith(q)) score += 5;
        if (summary.includes(q)) score += 3;
        if (body.includes(q)) score += 1;
        return { ...a, score };
      })
      .filter((a) => a.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map(({ score: _s, ...rest }) => ({
      _id: rest._id,
      collection: rest.collection,
      title: rest.title,
      slug: rest.slug,
      summary: rest.summary,
    }));
  },
});

/**
 * Suggested articles (one per collection).
 */
export const listSuggested = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("help_articles"),
      collection: v.string(),
      title: v.string(),
      slug: v.string(),
      summary: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const limit = args.limit ?? 6;
    const all = await ctx.db.query("help_articles").collect();
    const byCollection = new Map<string, typeof all>();
    for (const a of all) {
      const list = byCollection.get(a.collection) ?? [];
      list.push(a);
      byCollection.set(a.collection, list);
    }
    const suggested: (typeof all)[0][] = [];
    for (const [, articles] of byCollection) {
      const sorted = [...articles].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      if (sorted[0]) suggested.push(sorted[0]);
    }
    return suggested.slice(0, limit).map((a) => ({
      _id: a._id,
      collection: a.collection,
      title: a.title,
      slug: a.slug,
      summary: a.summary,
    }));
  },
});

/**
 * Get a single article by slug with full body.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("help_articles"),
      collection: v.string(),
      title: v.string(),
      slug: v.string(),
      summary: v.optional(v.string()),
      body: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const article = await ctx.db
      .query("help_articles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!article) return null;
    return {
      _id: article._id,
      collection: article.collection,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      body: article.body,
    };
  },
});
