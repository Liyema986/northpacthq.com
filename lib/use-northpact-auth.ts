"use client";

/** Real auth hook backed by Clerk + Convex. */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useQuery, useMutation } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "senior" | "staff";
  firmId: Id<"firms">;
}

export function useNorthPactAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const convexUser = useQuery(api.users.getCurrentUser);
  const ensureCurrentUser = useMutation(api.clerkSync.ensureCurrentUser);
  const { signOut: clerkSignOut } = useClerk();
  const router = useRouter();

  // Auto-provision: if Clerk says authenticated but Convex has no user record yet
  // (happens when signing up before the webhook was configured, or on first login)
  useEffect(() => {
    if (isAuthenticated && convexUser === null) {
      ensureCurrentUser({}).catch(console.error);
    }
  }, [isAuthenticated, convexUser, ensureCurrentUser]);

  const user: AuthUser | null =
    convexUser
      ? {
          id: convexUser._id,
          name: convexUser.name,
          email: convexUser.email,
          role: convexUser.role as AuthUser["role"],
          firmId: convexUser.firmId,
        }
      : null;

  const signOut = () => {
    clerkSignOut({ redirectUrl: "/auth" });
  };

  // Stub sign-in / sign-up so any existing call sites compile without errors.
  // Actual auth happens through the /auth page now.
  const signIn = async (_email: string, _password: string) => {
    router.push("/auth");
  };

  const signUp = async (
    _name: string,
    _email: string,
    _password: string,
    _firmName: string
  ) => {
    router.push("/auth?tab=signup");
  };

  return { user, isAuthenticated, isLoading, signIn, signUp, signOut };
}
