import { ConvexClientProvider } from "@/app/providers/ConvexClientProvider";

export default function SignLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
