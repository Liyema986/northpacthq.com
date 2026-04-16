"use client";

/** Real auth hook backed by Clerk + Convex. */

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useQuery } from "convex/react";
import { useClerk } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "senior" | "staff" | "view-only";
  firmId: Id<"firms">;
  avatar?: string;
}

export function useNorthPactAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const convexUser = useQuery(api.users.getCurrentUser);
  const { signOut: clerkSignOut } = useClerk();
  const router = useRouter();

  // If Clerk says authenticated but Convex has no user record, the user was
  // deleted from the DB. Force sign-out and redirect to /auth (fire once).
  const signOutFired = useRef(false);
  useEffect(() => {
    if (isAuthenticated && convexUser === null && !signOutFired.current) {
      signOutFired.current = true;
      clerkSignOut({ redirectUrl: "/auth?reason=access_denied" });
    }
  }, [isAuthenticated, convexUser, clerkSignOut]);

  const user: AuthUser | null =
    convexUser
      ? {
          id: convexUser._id,
          name: convexUser.name,
          email: convexUser.email,
          role: convexUser.role as AuthUser["role"],
          firmId: convexUser.firmId,
          avatar: convexUser.avatar ?? undefined,
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
