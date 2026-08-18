import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: {
    default: "FA Reuse Flow",
    template: "%s · FA Reuse Flow",
  },
  description: "ระบบสาธิตการรับซื้อและตรวจสภาพอุปกรณ์ Factory Automation",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
