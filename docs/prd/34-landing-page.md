# NorthPact PRD — Landing Page & Marketing Site

**Source:** Root NorthPact `app/page.tsx`, `components/landing/`

---

## 1. Overview

NorthPact includes a **public-facing marketing/landing page** that serves as the entry point for new users. It showcases the platform's features, pricing, and provides onboarding paths (sign up, book demo, contact).

---

## 2. Page Sections

The landing page is composed of the following sections (in order):

| # | Section | Component | Description |
|---|---------|-----------|-------------|
| 1 | **Header/Navigation** | `Header` | Logo, nav links (scroll-to-section), CTA buttons (Sign In, Get Started) |
| 2 | **Hero** | `Hero` | Main headline, subheadline, CTA button, hero image/animation |
| 3 | **Logos Bar** | `LogosBar` | Trusted-by logo strip (accounting firms, partners) |
| 4 | **Why Choose Us** | `WhyChooseUs` | 3-4 differentiator cards with icons |
| 5 | **Features** | `Features` | Feature grid with icons and descriptions |
| 6 | **How It Works** | `HowItWorksSection` / `HowItWorksTabsSection` | Step-by-step workflow with tabs or carousel |
| 7 | **Workflow** | `WorkflowSection` | Visual workflow diagram |
| 8 | **Everything Section** | `EverythingSection` | Full feature highlight ("Everything you need") |
| 9 | **Featured Templates** | `FeaturedTemplates` | Showcase of template types with `TemplateCard` components |
| 10 | **Stats** | `StatsSection` | Key metrics (users, proposals created, firms onboarded) |
| 11 | **Case Studies** | `CaseStudiesSection` | Customer success stories |
| 12 | **Testimonials** | `TestimonialsSection` | Customer quotes/reviews |
| 13 | **Pricing** | `PricingSection` | Plan comparison (Starter, Professional, Enterprise) |
| 14 | **Book Demo** | `BookDemoSection` | Demo scheduling form/CTA |
| 15 | **Contact** | `Contact` | Contact form (name, email, message) |
| 16 | **CTA** | `CTASection` | Final call-to-action before footer |
| 17 | **Footer** | `Footer` | Links, legal, social media |

---

## 3. Pricing Section Detail

| Plan | Price | Features Highlighted |
|------|-------|---------------------|
| **Starter** | TBD / month (set via Stripe Price ID) | Core proposal builder, basic templates, limited users |
| **Professional** | TBD / month (set via Stripe Price ID) | Full features, Xero integration, multiple users, approval workflow |
| **Enterprise** | Custom pricing | All features, advanced reporting, priority support, SSO, custom onboarding |

Each plan card includes:
- Plan name and price
- Feature checklist
- CTA button (links to Stripe checkout)
- "Most Popular" badge for Professional

---

## 4. Navigation

| Nav Item | Target |
|----------|--------|
| Features | Scroll to Features section |
| How It Works | Scroll to How It Works section |
| Pricing | Scroll to Pricing section |
| Templates | Scroll to Featured Templates section |
| Contact | Scroll to Contact section |
| Sign In | `/sign-in` (Clerk) |
| Get Started | `/sign-up` (Clerk) |

---

## 5. Authentication Entry Points

| Route | Page |
|-------|------|
| `/sign-in` | Clerk sign-in (catch-all route for OAuth + email/password) |
| `/sign-up` | Clerk sign-up (catch-all route) |
| `/auth` | Auth page |
| `/auth/sso-callback` | SSO callback handler |

---

## 6. Design Notes

| Aspect | Detail |
|--------|--------|
| Animations | Framer Motion for scroll-triggered animations |
| Responsive | Mobile-first responsive design |
| Theme | Supports dark/light mode via ThemeToggle |
| Typography | Clean, professional — suitable for accounting firms |
| Colors | Uses firm brand colors as accent |
| Images | Hero image, template screenshots, workflow diagrams |
