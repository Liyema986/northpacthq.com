"use client";

import { useNorthPactAuth } from "@/lib/use-northpact-auth";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, ChevronDown, LogOut, Settings } from "lucide-react";
import Link from "next/link";

export function ProfileDropdown() {
  const { user, signOut } = useNorthPactAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 p-1.5 rounded-md hover:bg-muted transition-colors outline-none cursor-pointer">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
              {getInitials(user?.name ?? "U")}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-0 rounded-lg shadow-lg">
        {/* User info */}
        <DropdownMenuLabel className="p-0">
          <div className="px-3 py-3 flex items-center gap-2.5">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="text-sm bg-primary/10 text-primary font-semibold">
                {getInitials(user?.name ?? "U")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="m-0" />

        {/* Firm info */}
        <div className="px-3 py-2.5 flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 shrink-0">
            <Building2 className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-foreground truncate">
              Apex Accounting &amp; Advisory
            </p>
            <p className="text-[10px] text-muted-foreground capitalize">
              {user?.role?.replace("-", " ")}
            </p>
          </div>
        </div>

        <DropdownMenuSeparator className="m-0" />

        <div className="p-1">
          <DropdownMenuItem asChild>
            <Link href="/settings" className="gap-2.5 cursor-pointer">
              <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
              Settings
            </Link>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="m-0" />

        <div className="p-1">
          <DropdownMenuItem
            className="gap-2.5 cursor-pointer text-destructive focus:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
