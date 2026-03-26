/**
 * Segment layout for /super/administrator.
 * Access control is enforced in the parent app/(admin)/layout.tsx which
 * subscribes to Convex, gates children by role, and redirects on role changes.
 */
export default function SuperAdministratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
