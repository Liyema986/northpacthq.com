"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";

export function EnsureUser() {
  const { user, isSignedIn } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const ensureCurrentUser = useMutation(api.clerkSync.ensureCurrentUser);
  const synced = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !isAuthenticated || !user || synced.current) return;
    synced.current = true;

    ensureCurrentUser({}).catch((err) => {
      console.error("[EnsureUser] Failed to sync profile:", err);
      synced.current = false;
    });
  }, [isSignedIn, isAuthenticated, user, ensureCurrentUser]);

  return null;
}
