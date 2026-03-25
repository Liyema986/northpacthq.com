"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNorthPactAuth } from "@/lib/use-northpact-auth";

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 172_800_000) return "Yesterday";
  return new Date(ts).toLocaleDateString();
}

export function NotificationBell() {
  const { user } = useNorthPactAuth();
  const userId = user?.id as Id<"users"> | undefined;

  const notifications = useQuery(
    api.notifications.listNotifications,
    userId ? { userId, limit: 20 } : "skip"
  );
  const unreadCount = useQuery(
    api.notifications.getUnreadCount,
    userId ? { userId } : "skip"
  );

  const markAllAsReadMut = useMutation(api.notifications.markAllAsRead);
  const markAsReadMut    = useMutation(api.notifications.markAsRead);

  const [open, setOpen] = useState(false);

  const displayUnread = unreadCount ?? 0;
  const list = notifications ?? [];

  async function handleMarkAllRead() {
    if (!userId) return;
    try { await markAllAsReadMut({ userId }); } catch { /* silent */ }
  }

  async function handleItemClick(notifId: Id<"notifications">, isRead: boolean) {
    if (!userId || isRead) return;
    try { await markAsReadMut({ userId, notificationId: notifId }); } catch { /* silent */ }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-md text-amber-600 hover:bg-muted"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {displayUnread > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
              {displayUnread > 9 ? "9+" : displayUnread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-80 p-0 rounded-lg shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <DropdownMenuLabel className="p-0 text-sm font-semibold text-foreground">
            Notifications
          </DropdownMenuLabel>
          {displayUnread > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto p-2">
          {notifications === undefined ? (
            /* Loading skeleton */
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-md bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="py-8 text-center">
              <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <Bell className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-sm font-medium text-foreground">All caught up</p>
              <p className="text-xs text-muted-foreground mt-1">No notifications right now.</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {list.map((n, ni) => (
                <div
                  key={`${n._id}-${ni}`}
                  onClick={() => handleItemClick(n._id, n.isRead)}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors hover:bg-slate-50",
                    !n.isRead && "bg-primary/5"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-foreground">{n.title}</p>
                      {!n.isRead && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <div className="px-4 py-2 text-center">
          <p className="text-[11px] text-muted-foreground">NorthPact Notifications</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
