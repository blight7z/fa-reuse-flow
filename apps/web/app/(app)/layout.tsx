import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/lib/auth";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
