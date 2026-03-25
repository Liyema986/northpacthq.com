import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "./providers/ConvexClientProvider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    template: "%s | NorthPact",
    default: "NorthPact — Proposal & Engagement Management",
  },
  description:
    "Professional proposal builder and engagement management platform for South African accounting firms.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ClerkProvider
          publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}
          signInUrl="/auth"
          signUpUrl="/auth"
          signInFallbackRedirectUrl="/auth/redirect"
          signUpFallbackRedirectUrl="/auth/redirect"
        >
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
        <Toaster position="top-right" richColors closeButton duration={5000} />
      </body>
    </html>
  );
}
