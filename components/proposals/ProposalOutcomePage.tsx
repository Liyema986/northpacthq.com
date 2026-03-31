"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Mail, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { toast } from "sonner";

const ACCEPTED_QUOTE =
  "We\u2019re thrilled to partner with you. Thank you for trusting us with your business.";
const REJECTED_QUOTE =
  "We respect your decision and wish you all the best. We look forward to the possibility of working together in the future.";

const NAVY = "#243E63";
const GOLD = "#C8A96E";

function triggerConfetti() {
  const duration = 2.5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);
    const particleCount = 50 * (timeLeft / duration);
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: [GOLD, "#b8955a", "#d4bc8a", NAVY, "#1a2d47"],
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: [GOLD, "#b8955a", "#d4bc8a", NAVY, "#1a2d47"],
    });
  }, 200);
  setTimeout(() => clearInterval(interval), duration);
}

export interface ProposalOutcomePageProps {
  variant: "accepted" | "rejected";
  firmName: string;
  proposalTitle?: string;
  proposalNumber?: string;
  signerName?: string;
  acceptedAt?: number;
  firmLogoUrl?: string | null;
  clientEmail?: string;
  firmWebsite?: string;
  triggerConfettiOnMount?: boolean;
  className?: string;
}

export function ProposalOutcomePage({
  variant,
  firmName,
  proposalTitle,
  proposalNumber,
  signerName,
  acceptedAt,
  firmLogoUrl,
  clientEmail,
  firmWebsite,
  triggerConfettiOnMount = false,
  className,
}: ProposalOutcomePageProps) {
  const isAccepted = variant === "accepted";

  useEffect(() => {
    if (isAccepted && triggerConfettiOnMount) {
      triggerConfetti();
    }
  }, [isAccepted, triggerConfettiOnMount]);

  const mailtoHref = clientEmail?.trim()
    ? `mailto:${encodeURIComponent(clientEmail.trim())}`
    : "mailto:";

  const handleCloseWindow = () => {
    window.close();
    window.setTimeout(() => {
      if (typeof document === "undefined" || document.visibilityState === "hidden") return;
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
      const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
      if (site) {
        window.location.href = site;
        return;
      }
      toast.message("Close this tab", {
        description:
          "Your browser may block closing this window. Use the tab close button, or press Ctrl+W (Windows) / Cmd+W (Mac).",
      });
    }, 200);
  };

  return (
    <div
      className={cn("min-h-screen w-full relative overflow-hidden", className)}
      style={{ backgroundColor: "#f8fafc" }}
    >
      {/* Subtle dot pattern background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <svg className="w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="outcome-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill={NAVY} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#outcome-dots)" />
        </svg>
      </div>

      {/* Centered card layout */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            {/* Header band */}
            <div className="px-8 pt-10 pb-6 text-center" style={{ backgroundColor: NAVY }}>
              {/* Logo */}
              {firmLogoUrl && (
                <div className="flex justify-center mb-5">
                  <img src={firmLogoUrl} alt={firmName} className="h-12 w-auto object-contain" />
                </div>
              )}

              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div
                  className="h-16 w-16 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: isAccepted ? `${GOLD}25` : "rgba(255,255,255,0.1)" }}
                >
                  {isAccepted ? (
                    <CheckCircle className="h-8 w-8" style={{ color: GOLD }} />
                  ) : (
                    <XCircle className="h-8 w-8 text-white/60" />
                  )}
                </div>
              </div>

              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                style={{ color: isAccepted ? GOLD : "#e2e8f0" }}
              >
                {isAccepted ? "Congratulations!" : "Thank You"}
              </h1>
              <p className="mt-1.5 text-[15px] text-white/70 font-medium">
                {isAccepted ? "Proposal accepted" : "Proposal declined"}
              </p>
            </div>

            {/* Gold accent strip */}
            <div className="h-[3px]" style={{ backgroundColor: GOLD }} />

            {/* Body */}
            <div className="px-8 py-8">
              <p className="text-[15px] text-slate-600 leading-relaxed">
                {isAccepted ? (
                  <>
                    Thank you for accepting the proposal from{" "}
                    <strong className="text-slate-800">{firmName}</strong>.
                  </>
                ) : (
                  <>
                    You have declined the proposal from{" "}
                    <strong className="text-slate-800">{firmName}</strong>.
                  </>
                )}
              </p>

              {/* Proposal details */}
              {(proposalTitle || signerName) && (
                <div
                  className="mt-5 rounded-lg border border-slate-100 p-4"
                  style={{ backgroundColor: "#f8fafc" }}
                >
                  {proposalTitle && (
                    <p className="text-[13px] text-slate-500">
                      {proposalTitle}
                      {proposalNumber && (
                        <span className="ml-1.5 text-slate-400">({proposalNumber})</span>
                      )}
                    </p>
                  )}
                  {signerName && (
                    <p className="text-[13px] text-slate-500 mt-1">
                      Signed by <strong className="text-slate-700">{signerName}</strong>
                      {acceptedAt &&
                        ` on ${new Date(acceptedAt).toLocaleDateString("en-GB", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}`}
                    </p>
                  )}
                </div>
              )}

              {/* Quote */}
              <blockquote
                className="mt-6 pl-4 italic text-[14px] text-slate-500 leading-relaxed"
                style={{ borderLeft: `3px solid ${GOLD}` }}
              >
                &ldquo;{isAccepted ? ACCEPTED_QUOTE : REJECTED_QUOTE}&rdquo;
                <footer className="mt-2 not-italic text-[12px] font-medium" style={{ color: GOLD }}>
                  &mdash; {firmName}
                </footer>
              </blockquote>

              {/* Actions */}
              <div className="mt-8 flex flex-wrap gap-2.5">
                <Button
                  size="lg"
                  className="rounded-lg shadow-sm text-[14px] font-semibold border-0"
                  style={{ backgroundColor: GOLD, color: NAVY }}
                  asChild
                >
                  <a href={mailtoHref}>
                    <Mail className="h-4 w-4 mr-2 shrink-0" />
                    Back to your email
                  </a>
                </Button>
                {firmWebsite && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-lg shadow-sm text-[14px] border-slate-200"
                    asChild
                  >
                    <a href={firmWebsite} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2 shrink-0" />
                      Visit website
                    </a>
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="ghost"
                  className="rounded-lg text-[14px] text-slate-400 hover:text-slate-600"
                  type="button"
                  onClick={handleCloseWindow}
                >
                  <X className="h-4 w-4 mr-2 shrink-0" />
                  Close
                </Button>
              </div>
            </div>
          </div>

          {/* Powered by */}
          <p className="text-center mt-5 text-[11px] text-slate-400">
            Powered by <span className="font-semibold" style={{ color: GOLD }}>NorthPact</span>
          </p>
        </div>
      </div>
    </div>
  );
}
