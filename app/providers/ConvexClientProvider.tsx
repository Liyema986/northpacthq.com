"use client";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
import { type ReactNode } from "react";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!
);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const clerkAuth = useAuth();
  const customUseAuth = () => ({
    ...clerkAuth,
    getToken: async (options?: { template?: string }) =>
      clerkAuth.getToken({ template: "convex", ...options }),
  });

  return (
    <ConvexProviderWithClerk client={convex} useAuth={customUseAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
