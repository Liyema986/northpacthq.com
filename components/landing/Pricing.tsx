"use client";

import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    sub: "Forever",
    description: "Everything you need to send your first proposal and see what NorthPact can do.",
    cta: "Get started free",
    ctaHref: "/auth",
    featured: false,
    features: [
      "Up to 3 proposals / month",
      "5 professional templates",
      "Basic e-signatures",
      "Client management (up to 5)",
      "Email support",
    ],
  },
  {
    name: "Pro",
    price: "$9",
    sub: "per month",
    description: "For growing firms that need unlimited proposals, deeper analytics, and integrations.",
    cta: "Start Pro",
    ctaHref: "/auth",
    featured: true,
    badge: "Most popular",
    features: [
      "Unlimited proposals",
      "50+ professional templates",
      "Legally binding e-signatures",
      "Unlimited clients & contacts",
      "Real-time read receipts",
      "Advanced analytics",
      "Xero & accounting integrations",
      "Export to PDF",
      "Priority support",
    ],
  },
  {
    name: "Business",
    price: "$19",
    sub: "per month",
    description: "Built for teams. Custom branding, collaboration, API access, and enterprise security.",
    cta: "Start Business",
    ctaHref: "/auth",
    featured: false,
    features: [
      "Everything in Pro",
      "Team collaboration",
      "Custom branding & domain",
      "Dedicated account manager",
      "Custom fields & data",
      "Advanced security & SSO",
      "Full API access",
      "SLA guarantee",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="w-full bg-white">
      <div className="w-full px-6 md:px-14 py-14 md:py-16">

        {/* ── Label + headline ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <span className="inline-block text-[11px] font-bold tracking-[0.22em] uppercase mb-3 text-north-gold">
            Pricing
          </span>
          <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-20">
            <h2
              className="text-slate-900 font-bold leading-[1.06] flex-1"
              style={{ fontSize: "clamp(1.8rem, 3.2vw, 44px)" }}
            >
              Simple pricing.{" "}
              <span className="text-north-gold">No surprises.</span>
            </h2>
            <p
              className="text-slate-500 leading-relaxed max-w-[400px] lg:pb-1"
              style={{ fontSize: "clamp(0.875rem, 1.3vw, 15px)" }}
            >
              Start free. Upgrade when you need to. Cancel any time.
              Every plan includes a 14-day trial of Pro features.
            </p>
          </div>
        </motion.div>

        {/* ── Plans grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={cn(
                "relative flex flex-col rounded-[20px] p-6",
                plan.featured
                  ? "text-white"
                  : "bg-white border border-slate-200"
              )}
              style={plan.featured ? { backgroundColor: "#243E63" } : {}}
            >
              {/* Featured badge */}
              {plan.badge && (
                <span
                  className="absolute top-6 right-6 text-[11px] font-bold tracking-[0.15em] uppercase px-3 py-1 rounded-full text-north-gold bg-north-gold/15 border border-north-gold/25"
                >
                  {plan.badge}
                </span>
              )}

              {/* Plan name */}
              <span
                className={cn(
                  "text-[12px] font-bold tracking-[0.18em] uppercase mb-4",
                  plan.featured ? "text-white/50" : "text-slate-400"
                )}
              >
                {plan.name}
              </span>

              {/* Price */}
              <div className="flex items-baseline gap-2 mb-1">
                <span
                  className={cn(
                    "font-bold leading-none",
                    plan.featured ? "text-white" : "text-slate-900"
                  )}
                  style={{ fontSize: "clamp(2rem, 3.5vw, 44px)" }}
                >
                  {plan.price}
                </span>
                <span
                  className={cn(
                    "text-[14px]",
                    plan.featured ? "text-white/50" : "text-slate-400"
                  )}
                >
                  {plan.sub}
                </span>
              </div>

              {/* Description */}
              <p
                className={cn(
                  "text-[13px] leading-relaxed mb-5 mt-2",
                  plan.featured ? "text-white/60" : "text-slate-500"
                )}
              >
                {plan.description}
              </p>

              {/* Divider */}
              <div
                className={cn(
                  "h-px w-full mb-5",
                  plan.featured ? "bg-white/10" : "bg-slate-100"
                )}
              />

              {/* Features */}
              <ul className="flex flex-col gap-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-north-gold" />
                    <span
                      className={cn(
                        "text-[14px] leading-snug",
                        plan.featured ? "text-white/80" : "text-slate-600"
                      )}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                asChild
                className={cn(
                  "w-full h-[44px] rounded-full font-semibold text-[13px] gap-2 group mt-auto",
                  plan.featured
                    ? "text-north-navy hover:opacity-90"
                    : "bg-white border border-slate-200 text-slate-900 hover:border-north-gold hover:text-north-gold"
                )}
                style={plan.featured ? { background: "#fff" } : {}}
              >
                <Link href={plan.ctaHref} className="flex items-center justify-center gap-2">
                  {plan.cta}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>

        {/* ── Footer note ───────────────────────────────────────── */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-slate-400 text-[13px] text-center mt-10"
        >
          All plans include a 14-day Pro trial &nbsp;·&nbsp; No credit card required &nbsp;·&nbsp; Cancel any time
        </motion.p>

      </div>
    </section>
  );
}
