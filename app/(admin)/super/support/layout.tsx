import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
};

/**
 * Fills available height so the inbox can use internal scroll areas (list + thread)
 * without the parent main scrolling and collapsing the two-column layout.
 */
export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}
