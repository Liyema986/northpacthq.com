"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0];
    const b = parts[parts.length - 1]?.[0];
    if (a && b) return (a + b).toUpperCase();
  }
  return name.trim().slice(0, 2).toUpperCase() || "?";
}

export function FirmLogoMark({
  firmName,
  firmLogoUrl,
  className,
  sizeClass = "w-20 h-20 sm:w-24 sm:h-24",
  alt,
}: {
  firmName: string;
  firmLogoUrl?: string | null;
  className?: string;
  sizeClass?: string;
  /** Image alt when `firmLogoUrl` is set */
  alt?: string;
}) {
  const logoAlt = alt ?? `${firmName} logo`;
  const initials = initialsFromName(firmName);
  const [logoFailed, setLogoFailed] = useState(false);
  const showImage = Boolean(firmLogoUrl) && !logoFailed;

  useEffect(() => {
    setLogoFailed(false);
  }, [firmLogoUrl]);

  return (
    <div
      className={cn(
        "rounded-xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center shrink-0 overflow-hidden p-1.5",
        sizeClass,
        className
      )}
    >
      {showImage ? (
        <Image
          src={firmLogoUrl!}
          alt={logoAlt}
          width={96}
          height={96}
          className="w-full h-full object-contain"
          unoptimized
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <div
          className="w-full h-full min-h-0 rounded-lg flex items-center justify-center text-[11px] sm:text-sm font-bold text-[#243E63] bg-[#C8A96E]/15 border border-[#C8A96E]/30"
          aria-hidden
        >
          {initials}
        </div>
      )}
    </div>
  );
}
