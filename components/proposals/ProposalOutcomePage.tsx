"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { X, Mail, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { toast } from "sonner";

const ACCEPTED_QUOTE =
  "We're thrilled to partner with you. Thank you for trusting us with your business.";
const REJECTED_QUOTE =
  "We respect your decision and wish you all the best. We look forward to the possibility of working together in the future.";

/** Matches northpact-v1: dual bursts + green/gold palette for a full celebration. */
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
      colors: ["#22c55e", "#16a34a", "#15803d", "#fbbf24", "#f59e0b"],
    });
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ["#22c55e", "#16a34a", "#15803d", "#fbbf24", "#f59e0b"],
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
  /** Resolved firm logo (Convex storage URL) — unused on outcome (no header bar). */
  firmLogoUrl?: string | null;
  /** Client email for “Back to your email” mailto */
  clientEmail?: string;
  /** Optional firm website URL */
  firmWebsite?: string;
  /** When true, triggers confetti on mount (for accepted only) */
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

  const illustrationSrc = isAccepted
    ? "/images/errors/proposal-accepted-illustration.svg"
    : "/images/errors/proposal-declined-illustration.svg";

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
      className={cn(
        "min-h-screen w-full bg-[#F8FAFC] dark:bg-muted/30 relative overflow-hidden",
        className
      )}
    >
      <div className="absolute inset-0 opacity-40 dark:opacity-20 pointer-events-none" aria-hidden>
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="outcome-waves-np"
              x="0"
              y="0"
              width="120"
              height="120"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M0 60 Q30 50 60 60 T120 60"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-muted-foreground/30"
              />
              <path
                d="M0 80 Q30 70 60 80 T120 80"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-muted-foreground/20"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#outcome-waves-np)" />
        </svg>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row lg:items-center lg:justify-between px-4 sm:px-6 lg:px-12 xl:px-16 2xl:px-24 py-12 lg:py-0">
        <div className="flex-1 max-w-xl lg:max-w-2xl flex flex-col justify-center order-2 lg:order-1">
          <h1
            className={cn(
              "text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight",
              isAccepted
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-slate-700 dark:text-slate-300"
            )}
          >
            {isAccepted ? "Congratulations!" : "Thank you"}
          </h1>
          <h2 className="mt-2 text-2xl sm:text-3xl font-normal text-[#374151] dark:text-muted-foreground">
            {isAccepted ? "Proposal accepted" : "Proposal declined"}
          </h2>
          <p className="mt-6 text-base sm:text-lg text-[#6B7280] dark:text-muted-foreground leading-relaxed">
            {isAccepted ? (
              <>
                Thank you for accepting the proposal from <strong>{firmName}</strong>.
                {proposalTitle && (
                  <span className="block mt-2 text-sm">
                    {proposalTitle}
                    {proposalNumber && ` (${proposalNumber})`}
                  </span>
                )}
                {signerName && (
                  <span className="block mt-1 text-sm">
                    Signed by <strong>{signerName}</strong>
                    {acceptedAt &&
                      ` on ${new Date(acceptedAt).toLocaleDateString("en-GB", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}`}
                  </span>
                )}
              </>
            ) : (
              <>
                You have declined the proposal from <strong>{firmName}</strong>.
                {proposalTitle && (
                  <span className="block mt-2 text-sm">
                    {proposalTitle}
                    {proposalNumber && ` (${proposalNumber})`}
                  </span>
                )}
              </>
            )}
          </p>

          <blockquote className="mt-8 pl-4 border-l-4 border-slate-200 dark:border-slate-600 italic text-[#6B7280] dark:text-slate-400">
            &ldquo;{isAccepted ? ACCEPTED_QUOTE : REJECTED_QUOTE}&rdquo;
            <footer className="mt-2 not-italic text-sm text-slate-500 dark:text-slate-500">
              — {firmName}
            </footer>
          </blockquote>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              size="lg"
              className={cn(
                "rounded-md shadow-sm text-white border-0",
                isAccepted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-700 hover:bg-slate-800"
              )}
              asChild
            >
              <a href={mailtoHref}>
                <Mail className="h-4 w-4 mr-2 shrink-0" />
                Back to your email
              </a>
            </Button>
            {firmWebsite && (
              <Button size="lg" variant="outline" className="rounded-md shadow-sm" asChild>
                <a href={firmWebsite} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2 shrink-0" />
                  Visit our website
                </a>
              </Button>
            )}
            <Button size="lg" variant="ghost" className="rounded-md" type="button" onClick={handleCloseWindow}>
              <X className="h-4 w-4 mr-2 shrink-0" />
              Close this window
            </Button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center lg:justify-end relative order-1 lg:order-2 mt-8 lg:mt-0">
          <div className="relative w-full max-w-md xl:max-w-lg">
            <div className="relative z-10 w-full aspect-[4/3] flex items-center justify-center">
              <Image
                src={illustrationSrc}
                alt=""
                width={480}
                height={360}
                className="object-contain w-full h-full"
                priority
                unoptimized
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
