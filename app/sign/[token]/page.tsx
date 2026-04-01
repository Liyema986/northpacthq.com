"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/signature/SignaturePad";
import { CheckCircle, AlertTriangle, FileText, Clock, Shield, Loader2, Pen, X, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

const NAVY = "#243E63";
const GOLD = "#C8A96E";

function triggerConfetti() {
  const duration = 2.5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 80, zIndex: 9999 };
  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();
    if (timeLeft <= 0) return clearInterval(interval);
    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: [GOLD, "#b8955a", "#d4bc8a", NAVY, "#ffffff"] });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: [GOLD, "#b8955a", "#d4bc8a", NAVY, "#ffffff"] });
  }, 150);
  setTimeout(() => clearInterval(interval), duration);
}

export default function SigningPage() {
  const params = useParams();
  const token = params.token as string;

  const [signerName, setSignerName] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [clientInfo, setClientInfo] = useState({ ip: "", userAgent: "" });

  const signingSession = useQuery(api.signatures.getSigningSession, { token });
  const submitSignature = useMutation(api.signatures.submitSignature);

  useEffect(() => {
    setClientInfo({ ip: "Client IP", userAgent: navigator.userAgent });
  }, []);

  const handleSubmit = async () => {
    if (!signerName.trim()) { toast.error("Please enter your full name"); return; }
    if (!signatureData) { toast.error("Please provide your signature"); return; }
    if (!agreedToTerms) { toast.error("Please agree to the terms"); return; }

    setIsSubmitting(true);
    try {
      await submitSignature({
        token,
        signerName: signerName.trim(),
        signatureImage: signatureData,
        ipAddress: clientInfo.ip,
        userAgent: clientInfo.userAgent,
      });
      setIsComplete(true);
      setTimeout(() => triggerConfetti(), 300);
      toast.success("Document signed successfully!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Error state ──
  if (signingSession?.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#f8fafc" }}>
        <div className="w-full max-w-md text-center">
          <div className="flex justify-center mb-5">
            <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#fef3c7" }}>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Unable to Sign</h1>
          <p className="text-[15px] text-slate-500 mb-6">{signingSession.error}</p>
          <p className="text-[13px] text-slate-400">Please contact the sender if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (!signingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#f8fafc" }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" style={{ color: GOLD }} />
          <p className="text-[14px] text-slate-500">Loading document...</p>
        </div>
      </div>
    );
  }

  // ── Success state ──
  if (isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 relative" style={{ backgroundColor: "#f8fafc" }}>
        <div className="w-full max-w-lg text-center">
          <div className="flex justify-center mb-5">
            <div className="h-20 w-20 rounded-full flex items-center justify-center" style={{ backgroundColor: `${GOLD}20` }}>
              <CheckCircle className="h-10 w-10" style={{ color: GOLD }} />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: GOLD }}>Successfully Signed!</h1>
          <p className="text-[15px] text-slate-500 mb-8">Thank you for signing the engagement letter</p>

          <div className="grid grid-cols-2 gap-x-8 gap-y-4 max-w-sm mx-auto text-left mb-8">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Document</p>
              <p className="text-[14px] text-slate-700 font-medium">{signingSession.letter?.letterNumber || "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Signed by</p>
              <p className="text-[14px] text-slate-700 font-medium">{signerName}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Date</p>
              <p className="text-[14px] text-slate-700 font-medium">{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Status</p>
              <p className="text-[14px] font-medium" style={{ color: GOLD }}>Complete</p>
            </div>
          </div>

          <div className="h-px max-w-xs mx-auto mb-6" style={{ backgroundColor: `${GOLD}40` }} />

          <p className="text-[13px] text-slate-400 mb-6">A copy of the signed document has been sent to your email address.</p>

          <div className="flex items-center justify-center gap-3">
            <Button size="lg" className="rounded-full px-6 text-[14px] font-semibold text-white" style={{ backgroundColor: GOLD }}
              onClick={() => window.close()}>
              <Mail className="h-4 w-4 mr-2" /> Back to email
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-6 text-[14px]" onClick={() => window.close()}>
              <X className="h-4 w-4 mr-2" /> Close
            </Button>
          </div>

          <p className="text-center mt-8 text-[11px] text-slate-400">
            Powered by <span className="font-semibold" style={{ color: GOLD }}>NorthPact</span>
          </p>
        </div>
      </div>
    );
  }

  // ── Main signing form ──
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
      {/* Top bar */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${NAVY}10` }}>
              <FileText className="h-5 w-5" style={{ color: NAVY }} />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-slate-800">{signingSession.firmName}</h1>
              <p className="text-[12px] text-slate-400">Engagement Letter &bull; {signingSession.letter?.letterNumber}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[14px] font-semibold text-slate-700">{signingSession.clientName}</p>
            <p className="text-[11px] text-slate-400">Client</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-10">

        {/* Section 1: Document */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white" style={{ backgroundColor: NAVY }}>1</div>
            <h2 className="text-[16px] font-semibold text-slate-800">Review Document</h2>
          </div>
          <p className="text-[13px] text-slate-500 mb-4">Please review the engagement letter carefully before signing.</p>
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <div className="h-[450px] overflow-y-auto scrollbar-hide p-6 sm:p-8">
              <div
                className="prose prose-sm max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-p:leading-relaxed"
                dangerouslySetInnerHTML={{ __html: signingSession.letter?.content || "" }}
              />
            </div>
          </div>
        </section>

        {/* Section 2: Signature */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white" style={{ backgroundColor: NAVY }}>2</div>
            <h2 className="text-[16px] font-semibold text-slate-800">Your Signature</h2>
          </div>
          <p className="text-[13px] text-slate-500 mb-6">Sign below to accept the terms of this engagement letter.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <Label htmlFor="signer-name" className="text-[13px] font-medium text-slate-700">Full legal name</Label>
              <Input
                id="signer-name"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Enter your full legal name"
                className="mt-1.5 h-11 text-[14px] border-slate-200 focus:border-[#C8A96E]"
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-slate-700">Date</Label>
              <div className="mt-1.5 h-11 flex items-center px-3 rounded-lg border border-slate-200 bg-slate-50 text-[14px] text-slate-600">
                {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <Label className="text-[13px] font-medium text-slate-700 mb-2 block">Signature</Label>
            <SignaturePad
              onSignatureChange={setSignatureData}
              disabled={isSubmitting}
              proposalMode
              allowUpload
            />
          </div>

          <div className="flex items-start gap-3 mb-8">
            <Checkbox
              id="agree-terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              className="mt-0.5"
            />
            <Label htmlFor="agree-terms" className="text-[13px] text-slate-600 leading-relaxed cursor-pointer">
              I have read and agree to the terms of this engagement letter. I understand
              that my electronic signature is legally binding and equivalent to a
              handwritten signature.
            </Label>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !signerName || !signatureData || !agreedToTerms}
              size="lg"
              className="rounded-lg text-[14px] font-semibold text-white px-8"
              style={{ backgroundColor: GOLD }}
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing...</>
              ) : (
                <><Pen className="h-4 w-4 mr-2" /> Sign Document</>
              )}
            </Button>
            <div className="flex items-center gap-2 text-[12px] text-slate-400">
              <Shield className="h-4 w-4 shrink-0" />
              <span>Encrypted &amp; stored securely with a complete audit trail</span>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 mt-8">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Powered by <span className="font-semibold" style={{ color: GOLD }}>NorthPact</span>
          </p>
          <p className="text-[11px] text-slate-400">
            Expires {signingSession.session?.expiresAt
              ? new Date(signingSession.session.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
              : "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}
