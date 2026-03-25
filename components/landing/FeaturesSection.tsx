"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { ArrowRight, Bell, FileSignature, BarChart3, CreditCard, MousePointerClick, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    id: "builder",
    label: "Proposal Builder",
    headline: "From blank page to signed deal — in minutes.",
    body: "Drag, drop, and brand. NorthPact's builder lets you compose a full proposal — services, pricing, terms, and cover — without ever touching a template manually.",
    detail: "Works across any device. Clients read it like a document, sign it like a contract.",
    icon: MousePointerClick,
    accent: "#C8A96E",
  },
  {
    id: "esign",
    label: "E-Signatures",
    headline: "Legally binding. Instant. No chasing.",
    body: "Clients sign directly inside the proposal. No printing, no scanning, no email attachments. Every signature is time-stamped and audit-ready.",
    detail: "Compliant with major e-signature standards globally.",
    icon: FileSignature,
    accent: "#6366F1",
  },
  {
    id: "alerts",
    label: "Real-time Alerts",
    headline: "Know the moment they open it.",
    body: "NorthPact notifies you the instant a client views your proposal — so you can follow up at exactly the right moment instead of guessing.",
    detail: "Read receipts, time-on-page, and click tracking. All in one feed.",
    icon: Bell,
    accent: "#10B981",
  },
  {
    id: "payments",
    label: "Integrated Payments",
    headline: "Get paid the moment they say yes.",
    body: "Collect a deposit or full payment immediately upon signature. No invoicing delay, no chasing bank transfers. The deal closes and money moves — simultaneously.",
    detail: "Stripe-powered. Supports cards, bank transfers, and more.",
    icon: CreditCard,
    accent: "#F59E0B",
  },
  {
    id: "analytics",
    label: "Analytics",
    headline: "Understand what's winning — and what isn't.",
    body: "Track open rates, time spent per section, and close rates across all your proposals. Know which service lines resonate and which pricing puts clients off.",
    detail: "Built-in dashboards. No third-party BI tools required.",
    icon: BarChart3,
    accent: "#0EA5E9",
  },
  {
    id: "compliance",
    label: "Compliance & Audit",
    headline: "Every change, every signature, on record.",
    body: "A complete, immutable audit trail for every proposal — who saw it, when they signed, and what version they agreed to. Built for regulated industries.",
    detail: "SOC 2 aligned. Exportable audit logs.",
    icon: ShieldCheck,
    accent: "#8B5CF6",
  },
];

export function FeaturesSection() {
  const [active, setActive] = useState(FEATURES[0].id);
  const router = useRouter();
  const current = FEATURES.find((f) => f.id === active)!;

  return (
    <section id="workflow" className="w-full bg-white">
      <div className="w-full px-6 md:px-14 py-14 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-stretch">

          {/* ── LEFT — label + headline + tab list ───────────────── */}
          <div className="flex flex-col pr-0 lg:pr-16 border-b lg:border-b-0 lg:border-r border-slate-100 pb-10 lg:pb-0">

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
              className="mb-8"
            >
              <span className="inline-block text-[11px] font-bold tracking-[0.22em] uppercase mb-3 text-north-gold">
                Features
              </span>
              <h2
                className="text-slate-900 font-bold leading-[1.06]"
                style={{ fontSize: "clamp(1.8rem, 3.2vw, 44px)" }}
              >
                Everything you need.{" "}
                <em className="not-italic text-north-gold">Nothing you don&apos;t.</em>
              </h2>
            </motion.div>

            <div className="flex flex-col">
              {FEATURES.map((f, i) => (
                <motion.button
                  key={f.id}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                  onClick={() => setActive(f.id)}
                  className={cn(
                    "group flex items-center gap-4 py-3.5 text-left border-l-2 pl-5 transition-all duration-200",
                    active === f.id
                      ? "border-l-north-gold"
                      : "border-l-slate-100 hover:border-l-slate-300"
                  )}
                >
                  <f.icon
                    className="w-4 h-4 shrink-0 transition-colors duration-200"
                    style={{ color: active === f.id ? f.accent : undefined }}
                  />
                  <span
                    className={cn(
                      "text-[14px] font-semibold transition-colors duration-200",
                      active === f.id ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600"
                    )}
                  >
                    {f.label}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* ── RIGHT — active feature detail ────────────────────── */}
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col h-full pl-0 lg:pl-16 pt-10 lg:pt-0"
          >
            <div className="flex flex-col gap-5 mt-auto">
              {/* Icon + accent bar */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: current.accent + "18" }}
                >
                  <current.icon className="w-5 h-5" style={{ color: current.accent }} />
                </div>
                <div className="h-[3px] w-8 rounded-full" style={{ background: current.accent }} />
              </div>

              <h3
                className="text-slate-900 font-bold leading-[1.1]"
                style={{ fontSize: "clamp(1.4rem, 2.8vw, 36px)" }}
              >
                {current.headline}
              </h3>

              <p
                className="text-slate-500 leading-relaxed"
                style={{ fontSize: "clamp(0.9rem, 1.4vw, 16px)" }}
              >
                {current.body}
              </p>

              <p
                className="text-slate-400 text-[13px] leading-relaxed border-l-2 pl-4"
                style={{ borderColor: current.accent + "66" }}
              >
                {current.detail}
              </p>
            </div>

            {/* CTA */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <Button
                onClick={() => router.push("/auth")}
                className="rounded-full font-semibold text-[14px] h-[46px] px-7 gap-2 group bg-north-gold text-north-navy hover:bg-north-gold/90"
              >
                Get started free
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Button>
              <p className="text-slate-400 text-[12px] mt-3">
                No credit card required &nbsp;·&nbsp; Up and running in 2 min
              </p>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
