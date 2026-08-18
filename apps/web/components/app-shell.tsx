"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  ChevronRight,
  FileSpreadsheet,
  LogOut,
  Menu,
  PanelLeftClose,
  Printer,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { roleLabels } from "@/lib/format";

const navItems = [
  { href: "/", label: "ภาพรวมงาน", icon: BarChart3, exact: true },
  { href: "/cases", label: "รายการรับซื้อ", icon: Boxes },
  { href: "/imports", label: "นำเข้า Excel", icon: FileSpreadsheet },
  { href: "/reports/print", label: "รายงาน", icon: Printer },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const currentItem = navItems.find((item) => item.exact ? pathname === item.href : pathname.startsWith(item.href));

  const doLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const sidebar = (
    <>
      <div className={`flex h-[4.5rem] items-center border-b border-slate-800/90 ${collapsed ? "justify-center px-3" : "px-4"}`}>
        <Link href="/" className="flex min-w-0 items-center gap-3" onClick={() => setMobileOpen(false)}>
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-500 text-white shadow-lg shadow-brand-950/30">
            <Boxes size={19} strokeWidth={2.2} aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" aria-hidden="true" />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-[0.96rem] font-bold tracking-tight text-white">FA Reuse Flow</span>
              <span className="block truncate text-[0.68rem] font-semibold tracking-[0.08em] text-slate-400">CONTROL DESK</span>
            </span>
          ) : null}
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5" aria-label="เมนูหลัก">
        {!collapsed ? <p className="mb-3 px-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-slate-500">Operations</p> : null}
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              href={item.href}
              key={item.href}
              title={collapsed ? item.label : undefined}
              onClick={() => setMobileOpen(false)}
              className={`group relative flex min-h-11 items-center rounded-lg text-sm font-semibold transition-colors ${
                collapsed ? "justify-center px-2" : "gap-3 px-3"
              } ${active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`}
            >
              {active ? <span className="active-nav-rail absolute -left-3 h-7 w-0.5 rounded-r bg-brand-400" aria-hidden="true" /> : null}
              <Icon size={18} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
              {!collapsed ? <span className="flex-1">{item.label}</span> : null}
              {!collapsed && active ? <ChevronRight size={15} aria-hidden="true" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3">
        {!collapsed ? (
          <div className="mb-2 rounded-lg border border-slate-700/70 bg-slate-900 p-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-700 text-xs font-bold text-brand-200">
                {user?.full_name?.slice(0, 1) || "U"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-white">{user?.full_name}</span>
                <span className="block truncate text-[0.68rem] text-slate-400">{user ? roleLabels[user.role] : ""}</span>
              </span>
            </div>
            <button type="button" className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white" onClick={doLogout}>
              <LogOut size={15} aria-hidden="true" /> ออกจากระบบ
            </button>
          </div>
        ) : (
          <button type="button" className="grid h-10 w-full place-items-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white" title="ออกจากระบบ" onClick={doLogout}>
            <LogOut size={17} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="hidden h-9 w-full items-center justify-center rounded-lg text-slate-500 hover:bg-slate-800 hover:text-slate-300 lg:flex"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
          aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
        >
          <PanelLeftClose size={16} className={collapsed ? "rotate-180" : ""} aria-hidden="true" />
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className={`no-print industrial-grid fixed inset-y-0 left-0 z-30 hidden flex-col bg-slate-950 transition-[width] duration-200 lg:flex ${collapsed ? "w-[4.75rem]" : "w-64"}`}>
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="no-print fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="ปิดเมนู" />
          <aside className="industrial-grid relative flex h-full w-[17rem] max-w-[86vw] flex-col bg-slate-950 shadow-2xl">
            <button type="button" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white" onClick={() => setMobileOpen(false)} aria-label="ปิดเมนู">
              <X size={20} aria-hidden="true" />
            </button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-[4.75rem]" : "lg:pl-64"}`}>
        <header className="no-print sticky top-0 z-20 flex h-[4.5rem] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-lg sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="เปิดเมนู">
              <Menu size={20} aria-hidden="true" />
            </button>
            <div className="hidden items-center gap-3 sm:flex">
              <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Activity size={15} className="text-brand-600" aria-hidden="true" />
                {currentItem?.label || "พื้นที่ทำงาน"}
              </span>
              <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
              <span className="flex items-center gap-2 text-[0.72rem] text-slate-500">
                <span className="signal-dot" aria-hidden="true" /> ระบบพร้อมใช้งาน · Asia/Bangkok
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="hidden text-right sm:block">
              <span className="block text-xs font-semibold text-slate-800">{user?.full_name}</span>
              <span className="block text-[0.68rem] text-slate-500">{user ? roleLabels[user.role] : ""}</span>
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-brand-100">
              {user?.full_name?.slice(0, 1) || "U"}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1540px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="page-enter" key={pathname}>{children}</div>
        </main>
      </div>
    </div>
  );
}
