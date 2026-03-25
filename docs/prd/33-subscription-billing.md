# NorthPact PRD — Subscription & Billing (Stripe)

**Source:** Root NorthPact `convex/stripe.ts`, `convex/stripeWebhook.ts`, `convex/schema.ts` (firms table)

---

## 1. Overview

NorthPact uses **Stripe** for subscription management and billing. Firms subscribe to one of three plans, with billing handled entirely through Stripe's checkout and customer portal.

---

## 2. Subscription Plans

| Plan | Target | Features |
|------|--------|----------|
| **Starter** | Solo practitioners, small firms | Core proposal builder, basic templates, limited users |
| **Professional** | Growing firms | Full feature set, multiple users, Xero integration |
| **Enterprise** | Large firms | All features, advanced reporting, priority support |

### 2.1 Subscription States

| Status | Description |
|--------|-------------|
| `trial` | New firm on free trial |
| `active` | Paying subscription |
| `past_due` | Payment failed, grace period |
| `cancelled` | Subscription cancelled |

### 2.2 Firm Billing Fields

| Field | Type | Description |
|-------|------|-------------|
| `stripeCustomerId` | string | Stripe customer ID (`cus_xxx`) |
| `stripeSubscriptionId` | string | Active subscription ID (`sub_xxx`) |
| `subscriptionStatus` | enum | `trial` \| `active` \| `past_due` \| `cancelled` |
| `subscriptionPlan` | enum | `starter` \| `professional` \| `enterprise` |
| `trialEndsAt` | datetime (optional) | Trial expiry timestamp |

---

## 3. Checkout Flow

1. User navigates to Pricing page or upgrade prompt
2. User selects a plan
3. `createCheckoutSession` action creates a Stripe Checkout Session:
   - Maps Price ID to plan name
   - Sets `mode: "subscription"`
   - Includes `success_url` and `cancel_url`
   - Attaches firm metadata
4. User redirected to Stripe-hosted checkout page
5. User enters payment details and completes checkout
6. Stripe webhook fires `checkout.session.completed`
7. `handleStripeWebhook` updates firm: `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus: "active"`, `subscriptionPlan`

---

## 4. Customer Portal

For existing subscribers to manage billing:

1. User clicks "Manage Subscription" in Settings
2. `createCustomerPortalSession` creates a Stripe Billing Portal session
3. User redirected to Stripe-hosted portal
4. User can: update payment method, view invoices, cancel subscription
5. Changes propagated via Stripe webhooks

---

## 5. Webhook Handling

Route: `POST /api/webhooks/stripe`

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create customer, set subscription, update firm |
| `customer.subscription.updated` | Update subscription status and plan |
| `customer.subscription.deleted` | Set `subscriptionStatus: "cancelled"` |
| `invoice.payment_failed` | Set `subscriptionStatus: "past_due"` |

### Webhook Security

- Stripe signature verification using webhook secret
- Events processed idempotently

---

## 6. Plan Mapping

Stripe Price IDs are mapped to NorthPact plan names:

```
priceId → plan mapping:
  price_starter_monthly    → "starter"
  price_professional_monthly → "professional"
  price_enterprise_monthly  → "enterprise"
```

---

## 7. Trial Management

| Aspect | Detail |
|--------|--------|
| Trial duration | Configurable (default 14 days) |
| Trial start | On firm registration |
| Trial expiry | `trialEndsAt` timestamp checked |
| Post-trial | Must subscribe to continue using the platform |
| Trial features | Full access to all features |

---

## 8. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/billing/checkout` | Create Stripe checkout session |
| POST | `/api/billing/portal` | Create Stripe customer portal session |
| GET | `/api/billing/status` | Get current subscription status |
| POST | `/api/webhooks/stripe` | Stripe webhook handler |
