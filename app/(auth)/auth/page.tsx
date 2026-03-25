"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import type { OAuthStrategy, EmailCodeFactor } from "@clerk/types";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ArrowLeft, FileText, Send, CheckCircle, BarChart3 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const INVITE_ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  senior: "Senior",
  staff: "Staff",
  "view-only": "View only",
};

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = z
  .object({
    fullName: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const FEATURES = [
  { icon: FileText, title: "Professional Proposals", description: "Build polished proposals in minutes with smart templates." },
  { icon: Send, title: "One-Click Sending", description: "Send directly to clients and track every open in real time." },
  { icon: CheckCircle, title: "Digital Acceptance", description: "Clients sign digitally — no printing, no delays." },
  { icon: BarChart3, title: "Win Rate Analytics", description: "Know what's working. Improve every deal you send." },
];


function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();

  const inviteToken = searchParams.get("invite");
  const tabFromUrl = searchParams.get("tab");
  const initialTab: "login" | "signup" =
    inviteToken || tabFromUrl === "signup" || tabFromUrl === "sign-up" ? "signup" : "login";
  const [activeTab, setActiveTab] = useState<"login" | "signup">(initialTab);

  const invitePreview = useQuery(
    api.users.getInvitePreview,
    inviteToken ? { token: inviteToken } : "skip"
  );
  const inviteReady = !inviteToken || invitePreview !== undefined;
  const inviteInvalid = Boolean(inviteToken && inviteReady && invitePreview === null);
  const inviteLocked = Boolean(invitePreview);

  useEffect(() => {
    if (inviteToken) {
      try {
        sessionStorage.setItem("np_invite_token", inviteToken);
      } catch {
        /* ignore */
      }
    }
  }, [inviteToken]);

  useEffect(() => {
    if (!invitePreview) return;
    setSignupEmail(invitePreview.inviteeEmail);
    setSignupName(invitePreview.inviteeName);
    setLoginEmail(invitePreview.inviteeEmail);
  }, [invitePreview]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [showLoginCode, setShowLoginCode] = useState(false);
  const [loginCode, setLoginCode] = useState("");

  // Forgot password
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [showResetCode, setShowResetCode] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Signup state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [isSignupSubmitting, setIsSignupSubmitting] = useState(false);
  const [showSignupVerify, setShowSignupVerify] = useState(false);
  const [signupCode, setSignupCode] = useState("");
  const [isOAuthLoading, setIsOAuthLoading] = useState<OAuthStrategy | null>(null);

  const isCodeStep = showSignupVerify || showLoginCode || showResetCode || showForgotPassword;

  /* ─── OAuth ─── */
  const signInWithOAuth = async (strategy: OAuthStrategy) => {
    if (!signIn || !signInLoaded || !signUp || !signUpLoaded) return;
    setIsOAuthLoading(strategy);
    try {
      const origin = window.location.origin;
      let token = inviteToken;
      if (!token) {
        try {
          token = sessionStorage.getItem("np_invite_token");
        } catch {
          token = null;
        }
      }
      const inviteQs = token ? `?invite=${encodeURIComponent(token)}` : "";
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: `${origin}/auth/sso-callback${inviteQs}`,
        redirectUrlComplete: `${origin}/auth/redirect`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-in was cancelled or failed.";
      toast.error("Sign-in failed", { description: msg });
      setIsOAuthLoading(null);
    }
  };

  /* ─── Login ─── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = loginSchema.safeParse({ email: loginEmail, password: loginPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => { if (i.path[0]) fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    if (!signIn || !signInLoaded) return;
    setIsLoginSubmitting(true);
    try {
      const attempt = await signIn.create({ identifier: loginEmail.trim(), password: loginPassword });
      if (attempt.status === "complete" && attempt.createdSessionId) {
        await setActiveSignIn?.({ session: attempt.createdSessionId });
        toast.success("Welcome back!");
        router.push("/auth/redirect");
        return;
      }
      if (attempt.status === "needs_second_factor") {
        const factor = attempt.supportedSecondFactors?.find(
          (f): f is EmailCodeFactor => f.strategy === "email_code"
        );
        if (factor) {
          await signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
          setShowLoginCode(true);
          setLoginCode("");
          toast.success("Check your email for a verification code.");
        }
      }
    } catch (err: unknown) {
      toast.error("Login failed", { description: err instanceof Error ? err.message : "Invalid email or password." });
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const handleLoginCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn || !signInLoaded || !loginCode.trim()) return;
    setIsLoginSubmitting(true);
    try {
      const attempt = await signIn.attemptSecondFactor({ strategy: "email_code", code: loginCode.trim() });
      if (attempt.status === "complete" && attempt.createdSessionId) {
        await setActiveSignIn?.({ session: attempt.createdSessionId });
        toast.success("Welcome back!");
        router.push("/auth/redirect");
      }
    } catch (err: unknown) {
      toast.error("Verification failed", { description: err instanceof Error ? err.message : "Invalid or expired code." });
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  /* ─── Forgot password ─── */
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const emailCheck = z.string().email("Please enter a valid email").safeParse(forgotEmail);
    if (!emailCheck.success) { setErrors({ forgotEmail: emailCheck.error.issues[0].message }); return; }
    if (!signIn || !signInLoaded) return;
    setIsForgotSubmitting(true);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: forgotEmail.trim() });
      setShowResetCode(true);
      toast.success("Check your email for a reset code.");
    } catch (err: unknown) {
      toast.error("Reset failed", { description: err instanceof Error ? err.message : "Could not send reset code." });
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!resetCode.trim()) { setErrors({ resetCode: "Please enter the code" }); return; }
    if (newPassword.length < 6) { setErrors({ newPassword: "Password must be at least 6 characters" }); return; }
    if (newPassword !== confirmNewPassword) { setErrors({ confirmNewPassword: "Passwords don't match" }); return; }
    if (!signIn || !signInLoaded) return;
    setIsForgotSubmitting(true);
    try {
      const attempt = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code: resetCode.trim(), password: newPassword });
      if (attempt.status === "complete" && attempt.createdSessionId) {
        await setActiveSignIn?.({ session: attempt.createdSessionId });
        toast.success("Password reset! You're signed in.");
        router.push("/auth/redirect");
      }
    } catch (err: unknown) {
      toast.error("Reset failed", { description: err instanceof Error ? err.message : "Invalid code or password too weak." });
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  /* ─── Sign up ─── */
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = signupSchema.safeParse({ fullName: signupName, email: signupEmail, password: signupPassword, confirmPassword: signupConfirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((i) => { if (i.path[0]) fieldErrors[i.path[0] as string] = i.message; });
      setErrors(fieldErrors);
      return;
    }
    if (!signUp || !signUpLoaded) return;
    setIsSignupSubmitting(true);
    try {
      await signUp.create({
        emailAddress: signupEmail.trim(),
        password: signupPassword,
        firstName: signupName.trim().split(/\s+/)[0] ?? signupName.trim(),
        lastName: signupName.trim().split(/\s+/).slice(1).join(" ") || undefined,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setShowSignupVerify(true);
      setSignupCode("");
      toast.success("Check your email for a verification code.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign up failed.";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
        toast.error("Account exists", { description: "An account with this email already exists. Please log in instead." });
        setActiveTab("login");
        setLoginEmail(signupEmail);
      } else {
        toast.error("Sign up failed", { description: msg });
      }
    } finally {
      setIsSignupSubmitting(false);
    }
  };

  const handleSignupVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUp || !signUpLoaded || !signupCode.trim()) return;
    setIsSignupSubmitting(true);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code: signupCode.trim() });
      if (attempt.status === "complete" && attempt.createdSessionId) {
        await setActiveSignUp?.({ session: attempt.createdSessionId });
        toast.success("Account created! You're signed in.");
        router.push("/auth/redirect");
      }
    } catch (err: unknown) {
      toast.error("Verification failed", { description: err instanceof Error ? err.message : "Invalid or expired code." });
    } finally {
      setIsSignupSubmitting(false);
    }
  };

  const OAuthButtons = () => (
    <div className="grid grid-cols-2 gap-3">
      <Button
        type="button"
        variant="outline"
        className="h-[52px] sm:h-12 cursor-pointer rounded-xl font-medium"
        disabled={!!isOAuthLoading}
        onClick={() => signInWithOAuth("oauth_google")}
      >
        {isOAuthLoading === "oauth_google" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <>
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-[52px] sm:h-12 cursor-pointer rounded-xl font-medium"
        disabled={!!isOAuthLoading}
        onClick={() => signInWithOAuth("oauth_microsoft")}
      >
        {isOAuthLoading === "oauth_microsoft" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <>
            <svg className="h-5 w-5 mr-2" viewBox="0 0 23 23" aria-hidden>
              <path fill="#f25022" d="M1 1h10v10H1z" />
              <path fill="#7fba00" d="M12 1h10v10H12z" />
              <path fill="#00a4ef" d="M1 12h10v10H1z" />
              <path fill="#ffb900" d="M12 12h10v10H12z" />
            </svg>
            Microsoft
          </>
        )}
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-svh">

      {/* ═══ LEFT — NorthPact brand panel ═══ */}
      <div className="hidden lg:flex lg:w-1/2 shrink-0 flex-col justify-start p-10 xl:p-14 relative overflow-hidden bg-north-navy">
        {/* Decorative circles */}
        <div className="absolute top-[-80px] right-[-80px] w-[320px] h-[320px] rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute top-[-32px] right-[-32px] w-[200px] h-[200px] rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute top-[60px] right-[-40px] w-[110px] h-[110px] rounded-full bg-white/15 pointer-events-none" />

        {/* Floating bubbles */}
        <style>{`
          @keyframes floatUp {
            0%   { transform: translateY(0) scale(1);   opacity: 0; }
            10%  { opacity: 1; }
            90%  { opacity: 0.6; }
            100% { transform: translateY(-110vh) scale(0.85); opacity: 0; }
          }
        `}</style>
        {[
          { size: 10, left: "8%",  delay: 0,   dur: 7 },
          { size: 7,  left: "18%", delay: 1.2, dur: 9 },
          { size: 14, left: "27%", delay: 0.5, dur: 8 },
          { size: 8,  left: "38%", delay: 2.8, dur: 10 },
          { size: 11, left: "48%", delay: 1.7, dur: 7.5 },
          { size: 6,  left: "56%", delay: 0.3, dur: 11 },
          { size: 13, left: "65%", delay: 3.1, dur: 8.5 },
          { size: 9,  left: "73%", delay: 2.0, dur: 9.5 },
          { size: 7,  left: "82%", delay: 0.8, dur: 7 },
          { size: 12, left: "91%", delay: 4.0, dur: 10 },
        ].map((b, i) => (
          <div key={i} className="absolute rounded-full pointer-events-none" style={{ width: b.size, height: b.size, left: b.left, bottom: "-20px", background: "rgba(255,255,255,0.18)", animation: `floatUp ${b.dur}s ${b.delay}s ease-in infinite` }} />
        ))}

        {/* Logo */}
        <Link href="/" className="flex items-center w-fit mb-6 xl:mb-8 -ml-1">
          <Image src="/logo1.png" alt="NorthPact" width={100} height={28} className="object-contain" priority />
        </Link>

        {/* Headline + features */}
        <div className="flex flex-col gap-8">
          <div className="-mt-2">
            <h1 className="text-white font-bold leading-[1.05]" style={{ fontSize: "clamp(2rem, 3.2vw, 48px)" }}>
              Win more clients.<br />
              <span className="text-north-gold">One proposal at a time.</span>
            </h1>
            <p className="text-north-gray text-[16px] leading-relaxed max-w-[360px] mt-4">
              Create professional proposals in minutes, track every open, and close deals with a single click.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3 p-5 rounded-2xl bg-white/[0.06] border border-white/[0.08]">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-north-gold/15 shrink-0">
                  <f.icon className="h-4 w-4 text-north-gold" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white leading-tight">{f.title}</p>
                  <p className="text-[12px] text-white/50 mt-1.5 leading-snug">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ═══ RIGHT — Auth forms ═══ */}
      <div className="flex-1 flex flex-col bg-white overflow-y-auto">

        {/* Mobile header */}
        {!isCodeStep && (
          <div className="lg:hidden flex-shrink-0 flex items-center justify-between px-5 pt-5 pb-4">
            <Link href="/">
              <Image src="/logo1.png" alt="NorthPact" width={90} height={24} className="object-contain" />
            </Link>
            <Link href="/" className="inline-flex items-center justify-center size-10 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all group" aria-label="Back to home">
              <ArrowLeft className="w-[18px] h-[18px] text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
            </Link>
          </div>
        )}

        <div className="flex-1 flex flex-col px-8 md:px-16 py-6 overflow-y-auto">
          <div className="w-full max-w-[500px] mx-auto my-auto flex flex-col">

            {/* Back to home — desktop */}
            {!isCodeStep && (
              <Link href="/" className="mb-4 hidden lg:inline-flex items-center gap-1.5 text-[13px] text-slate-500 hover:text-slate-800 transition-colors group">
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={1.5} />
                Back to home
              </Link>
            )}

            {/* Heading */}
            {isCodeStep ? (
              <div className="mb-5 text-center">
                <h2 className="text-slate-900 font-bold leading-tight" style={{ fontSize: "clamp(1.6rem, 2.5vw, 32px)" }}>
                  {showForgotPassword && !showResetCode ? "Reset password" : showResetCode ? "Set new password" : "Verify your email"}
                </h2>
              </div>
            ) : (
              <div className="mb-4">
                <h2 className="text-slate-900 font-bold leading-tight" style={{ fontSize: "clamp(1.6rem, 2.5vw, 32px)" }}>
                  {activeTab === "login" ? "Welcome back" : "Create your account"}
                </h2>
                <p className="text-slate-500 text-[15px] mt-1.5">
                  {activeTab === "login" ? "Sign in to access your NorthPact portal" : "Get started with NorthPact — free to try"}
                </p>
                {inviteToken && !inviteReady && (
                  <p className="text-[13px] text-slate-500 mt-3">Loading invitation…</p>
                )}
                {inviteInvalid && (
                  <div
                    className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
                    role="status"
                  >
                    This invitation link is invalid or has expired. Ask your workspace admin for a new invite, or sign in if you
                    already have an account.
                  </div>
                )}
                {invitePreview && (
                  <div
                    className="mt-4 rounded-xl border border-[#C8A96E]/40 bg-[#C8A96E]/10 px-4 py-3 text-[13px] text-slate-800"
                    role="status"
                  >
                    <p className="font-semibold text-slate-900">You&apos;re invited to {invitePreview.firmName}</p>
                    <p className="text-slate-600 mt-1">
                      Role: {INVITE_ROLE_LABELS[invitePreview.role] ?? invitePreview.role}. Use the same email you were invited
                      with ({invitePreview.inviteeEmail}) when you create your account.
                    </p>
                  </div>
                )}
              </div>
            )}

            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as "login" | "signup"); setErrors({}); }}>
              {!isCodeStep && (
                <>
                  <TabsList className="grid w-full grid-cols-2 mb-4 h-12 rounded-xl bg-slate-100 p-1">
                    <TabsTrigger value="login" className="cursor-pointer w-full h-full rounded-[10px] text-[15px] font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="cursor-pointer w-full h-full rounded-[10px] text-[15px] font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      Sign Up
                    </TabsTrigger>
                  </TabsList>

                  <OAuthButtons />

                  <div className="flex items-center gap-3 mt-4 mb-1">
                    <div className="flex-1 h-px bg-slate-100" />
                    <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">or continue with email</span>
                    <div className="flex-1 h-px bg-slate-100" />
                  </div>
                </>
              )}

              {/* ── Sign In ── */}
              <TabsContent value="login" className={`${isCodeStep ? "mt-0" : "mt-3"} space-y-4`}>
                {showLoginCode ? (
                  <form onSubmit={handleLoginCode} className="space-y-5">
                    <p className="text-[15px] text-muted-foreground text-center leading-relaxed">
                      Enter the 6-digit code we sent to <span className="font-medium text-foreground">{loginEmail}</span>
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="login-code">Verification code</Label>
                      <Input id="login-code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000"
                        value={loginCode} onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, ""))}
                        className="h-12 text-center text-xl tracking-[0.3em] rounded-xl" />
                    </div>
                    <div className="flex gap-3">
                      <Button type="button" variant="outline" className="flex-1 h-12 cursor-pointer rounded-xl" onClick={() => { setShowLoginCode(false); setLoginCode(""); }} disabled={isLoginSubmitting}>Back</Button>
                      <Button type="submit" className="flex-1 h-12 cursor-pointer rounded-xl" disabled={isLoginSubmitting || loginCode.length !== 6}>
                        {isLoginSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                      </Button>
                    </div>
                  </form>
                ) : showForgotPassword ? (
                  showResetCode ? (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <p className="text-[15px] text-muted-foreground text-center leading-relaxed">
                        Enter the code sent to <span className="font-medium text-foreground">{forgotEmail}</span> and set your new password.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="reset-code">Reset code</Label>
                        <Input id="reset-code" type="text" inputMode="numeric" placeholder="000000" value={resetCode}
                          onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          className="h-[52px] rounded-xl text-center tracking-[0.3em] font-mono" maxLength={6} autoFocus />
                        {errors.resetCode && <p className="text-xs text-destructive">{errors.resetCode}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">New password</Label>
                        <Input id="new-password" type="password" placeholder="Min. 6 characters" value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)} className={`h-[52px] rounded-xl ${errors.newPassword ? "border-destructive" : ""}`} />
                        {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-new-password">Confirm new password</Label>
                        <Input id="confirm-new-password" type="password" placeholder="Repeat your password" value={confirmNewPassword}
                          onChange={(e) => setConfirmNewPassword(e.target.value)} className={`h-[52px] rounded-xl ${errors.confirmNewPassword ? "border-destructive" : ""}`} />
                        {errors.confirmNewPassword && <p className="text-xs text-destructive">{errors.confirmNewPassword}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" className="h-[52px] cursor-pointer rounded-xl" disabled={isForgotSubmitting}
                          onClick={() => { setShowResetCode(false); setResetCode(""); setNewPassword(""); setConfirmNewPassword(""); setErrors({}); }}>Back</Button>
                        <Button type="submit" className="flex-1 h-[52px] cursor-pointer rounded-xl" disabled={isForgotSubmitting || resetCode.length !== 6}>
                          {isForgotSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset Password"}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <p className="text-[15px] text-muted-foreground text-center leading-relaxed">
                        Enter your email and we&apos;ll send you a code to reset your password.
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Email</Label>
                        <Input id="forgot-email" type="email" placeholder="you@example.com" value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)} className={`h-[52px] rounded-xl ${errors.forgotEmail ? "border-destructive" : ""}`} autoFocus />
                        {errors.forgotEmail && <p className="text-xs text-destructive">{errors.forgotEmail}</p>}
                      </div>
                      <Button type="submit" className="w-full h-[52px] cursor-pointer rounded-xl font-medium" disabled={isForgotSubmitting}>
                        {isForgotSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending code...</> : "Send Reset Code"}
                      </Button>
                      <button type="button" onClick={() => { setShowForgotPassword(false); setForgotEmail(""); setErrors({}); }}
                        className="w-full text-[13px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center">
                        Back to sign in
                      </button>
                    </form>
                  )
                ) : (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" type="email" placeholder="you@example.com" value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)} readOnly={inviteLocked}
                        className={`h-[52px] rounded-xl ${errors.email ? "border-destructive" : ""} ${inviteLocked ? "bg-slate-50 text-slate-700" : ""}`} />
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Password</Label>
                        <button type="button" onClick={() => { setShowForgotPassword(true); setForgotEmail(loginEmail); setErrors({}); }}
                          className="text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                          Forgot password?
                        </button>
                      </div>
                      <Input id="login-password" type="password" placeholder="Min. 6 characters" value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)} className={`h-[52px] rounded-xl ${errors.password ? "border-destructive" : ""}`} />
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>
                    <Button type="submit" className="w-full h-[52px] cursor-pointer rounded-xl font-semibold text-[15px] bg-north-gold text-north-navy hover:bg-north-gold/90 !mt-5" disabled={isLoginSubmitting}>
                      {isLoginSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : "Sign In"}
                    </Button>
                  </form>
                )}
              </TabsContent>

              {/* ── Sign Up ── */}
              <TabsContent value="signup" className={`${isCodeStep ? "mt-0" : "mt-3"} space-y-4`}>
                {showSignupVerify ? (
                  <form onSubmit={handleSignupVerify} className="space-y-5">
                    <p className="text-[15px] text-muted-foreground text-center leading-relaxed">
                      Enter the 6-digit code we sent to <span className="font-medium text-foreground">{signupEmail}</span>
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="signup-code">Verification code</Label>
                      <Input id="signup-code" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000"
                        value={signupCode} onChange={(e) => setSignupCode(e.target.value.replace(/\D/g, ""))}
                        className="h-12 text-center text-xl tracking-[0.3em] rounded-xl" />
                    </div>
                    <div className="flex gap-3">
                      <Button type="button" variant="outline" className="flex-1 h-12 cursor-pointer rounded-xl" onClick={() => { setShowSignupVerify(false); setSignupCode(""); }} disabled={isSignupSubmitting}>Back</Button>
                      <Button type="submit" className="flex-1 h-12 cursor-pointer rounded-xl" disabled={isSignupSubmitting || signupCode.length !== 6}>
                        {isSignupSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleSignup} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Full Name</Label>
                        <Input id="signup-name" type="text" placeholder="Your full name" value={signupName}
                          onChange={(e) => setSignupName(e.target.value)} className={`h-[52px] rounded-xl ${errors.fullName ? "border-destructive" : ""}`} />
                        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input id="signup-email" type="email" placeholder="you@example.com" value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)} readOnly={inviteLocked}
                          className={`h-[52px] rounded-xl ${errors.email ? "border-destructive" : ""} ${inviteLocked ? "bg-slate-50 text-slate-700" : ""}`} />
                        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <Input id="signup-password" type="password" placeholder="Min. 6 characters" value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)} className={`h-[52px] rounded-xl ${errors.password ? "border-destructive" : ""}`} />
                        {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-confirm">Confirm Password</Label>
                        <Input id="signup-confirm" type="password" placeholder="Repeat your password" value={signupConfirmPassword}
                          onChange={(e) => setSignupConfirmPassword(e.target.value)} className={`h-[52px] rounded-xl ${errors.confirmPassword ? "border-destructive" : ""}`} />
                        {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-[52px] cursor-pointer rounded-xl font-semibold text-[15px] bg-north-gold text-north-navy hover:bg-north-gold/90 !mt-4" disabled={isSignupSubmitting}>
                      {isSignupSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : "Create Account"}
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>

            {/* Clerk CAPTCHA — must always be in DOM for bot protection */}
            <div id="clerk-captcha" className="!m-0 !p-0 [&:empty]:hidden" data-cl-theme="auto" data-cl-size="normal" />

            {!isCodeStep && (
              <p className="text-[12px] text-slate-400 text-center mt-5 leading-relaxed">
                By continuing, you agree to NorthPact&apos;s{" "}
                <Link href="#" className="underline hover:text-slate-700 transition-colors">Terms of Service</Link>{" "}
                and{" "}
                <Link href="#" className="underline hover:text-slate-700 transition-colors">Privacy Policy</Link>.
              </p>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
