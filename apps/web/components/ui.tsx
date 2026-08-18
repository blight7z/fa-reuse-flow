import Link from "next/link";
import { AlertCircle, ArrowLeft, Inbox, RotateCcw } from "lucide-react";
import { friendlyError } from "@/lib/api";
import { statusLabels, statusTone } from "@/lib/format";
import type { CaseStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={statusTone[status]}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  backHref,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backHref?: string;
}) {
  return (
    <header className="mb-5 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
      <div className="min-w-0">
        {backHref ? (
          <Link href={backHref} className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-700">
            <ArrowLeft size={15} aria-hidden="true" /> กลับ
          </Link>
        ) : null}
        {eyebrow ? <p className="section-kicker mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-[1.8rem]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="card flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center" role="alert">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-rose-50 text-rose-600">
        <AlertCircle size={22} aria-hidden="true" />
      </span>
      <h2 className="font-bold text-slate-900">โหลดข้อมูลไม่สำเร็จ</h2>
      <p className="mt-1 max-w-lg text-sm text-slate-600">{friendlyError(error)}</p>
      {onRetry ? (
        <button type="button" className="btn btn-secondary mt-4" onClick={onRetry}>
          <RotateCcw size={16} aria-hidden="true" /> ลองอีกครั้ง
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title = "ยังไม่มีข้อมูล",
  description = "ข้อมูลจะแสดงที่นี่เมื่อมีรายการ",
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-6 py-10 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-500">
        <Inbox size={22} aria-hidden="true" />
      </span>
      <h2 className="font-bold text-slate-900">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="กำลังโหลด" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="card p-5" key={index}>
          <div className="skeleton h-4 w-24" />
          <div className="skeleton mt-5 h-9 w-20" />
          <div className="skeleton mt-4 h-3 w-36" />
        </div>
      ))}
    </div>
  );
}

export function InlineAlert({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "danger"; children: React.ReactNode }) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm leading-6 ${styles[tone]}`}>{children}</div>;
}
