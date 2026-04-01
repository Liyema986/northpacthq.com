"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Mail, ExternalLink, CheckCircle, XCircle, Calendar, User, FileText, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

const ACCEPTED_QUOTE =
  "\u201CWe\u2019re thrilled to partner with you. Thank you for trusting us with your business.\u201D";
const REJECTED_QUOTE =
  "\u201CWe respect your decision and wish you all the best. We look forward to the possibility of working together in the future.\u201D";

const NAVY = "#243E63";
const GOLD = "#C8A96E";

function triggerConfetti() {
  const duration = 3 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 80, zIndex: 9999 };
  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);
    const particleCount = 60 * (timeLeft / duration);
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: [GOLD, "#b8955a", "#d4bc8a", NAVY, "#1a2d47", "#ffffff"],
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: [GOLD, "#b8955a", "#d4bc8a", NAVY, "#1a2d47", "#ffffff"],
    });
  }, 150);
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
    if (isAccepted) {
      // Always fire confetti for accepted — small delay to ensure page is painted
      const timer = setTimeout(() => triggerConfetti(), 300);
      return () => clearTimeout(timer);
    }
  }, [isAccepted]);

  const mailtoHref = clientEmail?.trim()
    ? `mailto:${encodeURIComponent(clientEmail.trim())}`
    : "mailto:";

  const handleCloseWindow = () => {
    window.close();
    window.setTimeout(() => {
      if (typeof document === "undefined" || document.visibilityState === "hidden") return;
      if (window.history.length > 1) { window.history.back(); return; }
      const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
      if (site) { window.location.href = site; return; }
    }, 200);
  };

  const formattedDate = acceptedAt
    ? new Date(acceptedAt).toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className={cn("min-h-screen w-full relative overflow-hidden", className)} style={{ backgroundColor: "#f8fafc" }}>
      {/* Dot pattern bg */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <svg className="w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="outcome-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill={NAVY} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#outcome-dots)" />
        </svg>
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">

          {/* Logo */}
          {firmLogoUrl && (
            <div className="flex justify-center mb-8">
              <img src={firmLogoUrl} alt={firmName} className="h-14 w-auto object-contain" />
            </div>
          )}

          {/* Icon + Heading */}
          <div className="text-center mb-10">
            <div className="flex justify-center mb-4">
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center"
                style={{ backgroundColor: isAccepted ? `${GOLD}20` : `${NAVY}15` }}
              >
                {isAccepted ? (
                  <CheckCircle className="h-10 w-10" style={{ color: GOLD }} />
                ) : (
                  <XCircle className="h-10 w-10 text-slate-400" />
                )}
              </div>
            </div>
            <h1
              className="text-3xl sm:text-4xl font-bold tracking-tight"
              style={{ color: isAccepted ? GOLD : NAVY }}
            >
              {isAccepted ? "Congratulations!" : "Thank You"}
            </h1>
            <p className="mt-2 text-[16px] text-slate-500 font-medium">
              {isAccepted ? "Proposal accepted" : "Proposal declined"}
            </p>
            <p className="mt-3 text-[15px] text-slate-600 leading-relaxed max-w-md mx-auto">
              {isAccepted ? (
                <>Thank you for accepting the proposal from <strong className="text-slate-800">{firmName}</strong>.</>
              ) : (
                <>You have declined the proposal from <strong className="text-slate-800">{firmName}</strong>.</>
              )}
            </p>
          </div>

          {/* Details — flat 2x2 grid */}
          {(proposalTitle || signerName || proposalNumber || formattedDate) && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 mb-10 max-w-lg mx-auto">
              {proposalTitle && (
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Proposal</p>
                    <p className="text-[14px] text-slate-700 font-medium">{proposalTitle}</p>
                  </div>
                </div>
              )}
              {proposalNumber && (
                <div className="flex items-start gap-3">
                  <Hash className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Number</p>
                    <p className="text-[14px] text-slate-700 font-medium">{proposalNumber}</p>
                  </div>
                </div>
              )}
              {signerName && (
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Signed by</p>
                    <p className="text-[14px] text-slate-700 font-medium">{signerName}</p>
                  </div>
                </div>
              )}
              {formattedDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Date</p>
                    <p className="text-[14px] text-slate-700 font-medium">{formattedDate}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quote */}
          <div className="text-center mb-10 max-w-md mx-auto">
            <p className="text-[14px] italic text-slate-500 leading-relaxed">
              {isAccepted ? ACCEPTED_QUOTE : REJECTED_QUOTE}
            </p>
            <p className="mt-2 text-[12px] font-semibold" style={{ color: GOLD }}>
              &mdash; {firmName}
            </p>
          </div>

          {/* Divider */}
          <div className="h-px max-w-xs mx-auto mb-8" style={{ backgroundColor: `${GOLD}40` }} />

          {/* Actions — centered */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="rounded-full shadow-sm text-[14px] font-semibold border-0 px-6 text-white"
              style={{ backgroundColor: GOLD }}
              asChild
            >
              <a href={mailtoHref}>
                <Mail className="h-4 w-4 mr-2 shrink-0" />
                Back to your email
              </a>
            </Button>
            {firmWebsite && (
              <Button size="lg" variant="outline" className="rounded-full shadow-sm text-[14px] border-slate-200 px-6" asChild>
                <a href={firmWebsite} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2 shrink-0" />
                  Visit website
                </a>
              </Button>
            )}
            <Button
              size="lg" variant="outline"
              className="rounded-full text-[14px] border-slate-200 px-6"
              type="button" onClick={handleCloseWindow}
            >
              <X className="h-4 w-4 mr-2 shrink-0" />
              Close
            </Button>
          </div>

          {/* Powered by */}
          <p className="text-center mt-10 text-[11px] text-slate-400">
            Powered by <span className="font-semibold" style={{ color: GOLD }}>NorthPact</span>
          </p>
        </div>
      </div>
    </div>
  );
}
