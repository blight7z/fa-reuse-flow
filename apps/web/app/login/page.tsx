"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  Gauge,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/api";
import type { Role } from "@/lib/types";
import { roleLabels } from "@/lib/format";

const accounts: { role: Role; email: string; detail: string }[] = [
  { role: "ESTIMATOR", email: "estimator@demo.local", detail: "ประเมินและเสนอราคา" },
  { role: "INSPECTOR", email: "inspector@demo.local", detail: "รับสินค้าและตรวจ QC" },
  { role: "MANAGER", email: "manager@demo.local", detail: "ดูภาพรวมและอนุมัติ" },
];

function LoginContent() {
  const { user, loading: authLoading, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(accounts[0].email);
  const [password, setPassword] = useState("Demo123!");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && user) router.replace(searchParams.get("next") || "/");
  }, [authLoading, router, searchParams, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace(searchParams.get("next") || "/");
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setSubmitting(false);
    }
  };

  const chooseAccount = (accountEmail: string) => {
    setEmail(accountEmail);
    setPassword("Demo123!");
    setError("");
  };

  return (
    <main className="min-h-screen bg-slate-950 lg:grid lg:grid-cols-[minmax(27rem,0.9fr)_minmax(34rem,1.1fr)]">
      <section className="industrial-grid relative hidden min-h-screen overflow-hidden border-r border-white/10 p-10 text-white lg:flex lg:flex-col xl:p-14" aria-label="แนะนำระบบ">
        <div className="absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <span className="relative grid h-10 w-10 place-items-center rounded-lg bg-brand-500 shadow-lg shadow-brand-950/60">
            <Boxes size={21} aria-hidden="true" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-bold">FA Reuse Flow</span>
            <span className="block text-[0.7rem] font-semibold tracking-[0.1em] text-slate-400">BUYBACK CONTROL DESK</span>
          </span>
        </div>

        <div className="relative my-auto max-w-xl py-16">
          <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-brand-400/20 bg-brand-400/10 px-3 py-1.5 text-xs font-semibold text-brand-200">
            <span className="signal-dot" aria-hidden="true" /> Workflow ที่ตรวจสอบย้อนหลังได้
          </div>
          <h1 className="max-w-lg text-4xl font-bold leading-[1.2] tracking-tight xl:text-[2.75rem]">
            จากรายการ Excel<br />ถึงผลตรวจและราคาสุดท้าย
          </h1>
          <p className="mt-5 max-w-lg text-[0.95rem] leading-7 text-slate-300">
            รวมข้อมูล สถานะ และหลักฐานในจุดเดียว ช่วยให้ทีมประเมิน เจ้าหน้าที่ QC และผู้จัดการเห็นงานชุดเดียวกัน
          </p>

          <div className="mt-9 grid max-w-lg grid-cols-3 overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]">
            {[
              { icon: ClipboardCheck, value: "QC", label: "Checklist" },
              { icon: Gauge, value: "3 วัน", label: "Business SLA" },
              { icon: CheckCircle2, value: "ทุกครั้ง", label: "Audit trail" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="border-r border-white/10 p-4 last:border-r-0">
                  <Icon size={17} className="mb-4 text-brand-300" aria-hidden="true" />
                  <strong className="block text-base text-white">{item.value}</strong>
                  <span className="mt-1 block text-[0.68rem] text-slate-400">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

      </section>

      <section className="relative flex min-h-screen items-center justify-center bg-white px-5 py-10 sm:px-8">
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-900 via-brand-500 to-emerald-500" aria-hidden="true" />
        <div className="w-full max-w-[29rem]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-600 text-white">
              <Boxes size={21} aria-hidden="true" />
            </span>
            <span>
              <span className="block font-bold text-slate-950">FA Reuse Flow</span>
              <span className="block text-[0.68rem] text-slate-500">Operations prototype</span>
            </span>
          </div>

          <div className="mb-7">
            <p className="section-kicker mb-2">Demo workspace</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">เข้าสู่ระบบ</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">เลือกบทบาทเดโมเพื่อดูขั้นตอนและสิทธิ์ที่แตกต่างกัน</p>
          </div>

          <div className="mb-6 grid gap-2 sm:grid-cols-3" aria-label="บัญชีเดโม">
            {accounts.map((account) => {
              const selected = account.email === email;
              return (
                <button
                  type="button"
                  key={account.role}
                  onClick={() => chooseAccount(account.email)}
                  className={`role-option rounded-lg border p-3 text-left transition-colors ${
                    selected ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  aria-pressed={selected}
                >
                  <span className={`mb-2 block text-[0.68rem] font-bold ${selected ? "text-brand-700" : "text-slate-700"}`}>
                    {roleLabels[account.role]}
                  </span>
                  <span className="block text-[0.66rem] leading-4 text-slate-500">{account.detail}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
                {error}
              </div>
            ) : null}
            <div>
              <label htmlFor="email" className="label">อีเมล</label>
              <input id="email" name="email" type="email" className="input" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div>
              <div className="relative">
                <label htmlFor="password" className="label">รหัสผ่าน</label>
                <input id="password" name="password" type={showPassword ? "text" : "password"} className="input pr-11" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                <button type="button" className="absolute bottom-0 right-0 grid h-11 w-11 place-items-center text-slate-500 hover:text-slate-900" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>
                  {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={submitting || authLoading}>
              {submitting ? <><span className="spinner" aria-hidden="true" /> กำลังเข้าสู่ระบบ…</> : <>เข้าสู่ระบบ <ArrowRight size={17} aria-hidden="true" /></>}
            </button>
          </form>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
            รหัสผ่านเดโมทุกบัญชี: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-800">Demo123!</code>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
          <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <span className="spinner" aria-hidden="true" /> กำลังเตรียมพื้นที่เดโม…
          </div>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
