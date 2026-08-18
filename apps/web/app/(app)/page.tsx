"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileSpreadsheet,
  TimerReset,
} from "lucide-react";
import { api } from "@/lib/api";
import { AnimatedNumber } from "@/components/animated-number";
import { caseDisplayId, formatDateTime, statusLabels, statusOrder } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { ErrorState, LoadingCards, PageHeader, StatusBadge } from "@/components/ui";
import type { CaseStatus } from "@/lib/types";

const workflow: { status: CaseStatus; short: string }[] = [
  { status: "NEW", short: "รับรายการ" },
  { status: "PRELIMINARY_QUOTED", short: "ประเมิน" },
  { status: "RECEIVED", short: "รับสินค้า" },
  { status: "INSPECTING", short: "ตรวจ QC" },
  { status: "FINAL_QUOTED", short: "ราคาสุดท้าย" },
  { status: "PAID", short: "ชำระเงิน" },
];

export default function DashboardPage() {
  const result = useAsync(async () => {
    const [summary, cases] = await Promise.all([api.dashboard(), api.cases({ pageSize: 6 })]);
    return { summary, cases };
  }, []);

  if (result.loading) {
    return (
      <>
        <PageHeader title="ภาพรวมงาน" description="ติดตามปริมาณงาน สถานะ และ SLA ของกระบวนการรับซื้อ" />
        <LoadingCards />
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
          <div className="card h-80 skeleton" />
          <div className="card h-80 skeleton" />
        </div>
      </>
    );
  }

  if (result.error || !result.data) {
    return (
      <>
        <PageHeader title="ภาพรวมงาน" description="ติดตามปริมาณงาน สถานะ และ SLA ของกระบวนการรับซื้อ" />
        <ErrorState error={result.error} onRetry={result.reload} />
      </>
    );
  }

  const { summary, cases } = result.data;
  const counts = summary.by_status || summary.status_counts || {};
  const total = summary.total_cases ?? cases.total;
  const active = summary.open_cases ?? summary.active_cases ?? summary.pending_cases ?? Object.entries(counts).reduce((sum, [status, count]) => {
    return ["PAID", "REJECTED", "RETURNED"].includes(status) ? sum : sum + (count || 0);
  }, 0);
  const overdue = summary.overdue_cases ?? 0;
  const completed = summary.completed_cases ?? ((counts.PAID || 0) + (counts.RETURNED || 0));
  const avgHours = summary.average_cycle_hours ?? summary.avg_cycle_hours;
  const maxCount = Math.max(1, ...Object.values(counts).map((value) => value || 0));
  const recent = summary.recent_cases?.length ? summary.recent_cases.slice(0, 6) : cases.items;

  const metrics = [
    { label: "เคสทั้งหมด", value: total, note: "ข้อมูลใน workspace", icon: Boxes, tone: "bg-brand-50 text-brand-700", line: "bg-brand-500" },
    { label: "กำลังดำเนินการ", value: active, note: "ยังไม่ปิดกระบวนการ", icon: TimerReset, tone: "bg-indigo-50 text-indigo-700", line: "bg-indigo-500" },
    { label: "เกิน SLA", value: overdue, note: overdue ? "ต้องจัดลำดับตรวจสอบ" : "ไม่มีงานเร่งด่วน", icon: AlertTriangle, tone: overdue ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700", line: overdue ? "bg-rose-500" : "bg-emerald-500" },
    { label: "ปิดงานแล้ว", value: completed, note: avgHours != null ? `รอบเฉลี่ย ${avgHours.toFixed(1)} ชม.` : "รอข้อมูลรอบงาน", icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700", line: "bg-emerald-500" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Operations overview"
        title="ภาพรวมงาน"
        description="ติดตามปริมาณงาน สถานะ และ SLA ของกระบวนการรับซื้อจากข้อมูลตัวอย่าง"
        actions={
          <>
            <Link href="/cases" className="btn btn-secondary">ดูรายการทั้งหมด <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/imports" className="btn btn-primary"><FileSpreadsheet size={16} aria-hidden="true" /> นำเข้า Excel</Link>
          </>
        }
      />

      <section className="card overflow-hidden" aria-label="ตัวชี้วัดสรุป">
        <div className="surface-header flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="signal-dot" aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-700">Workload signals</h2>
          </div>
          <span className="text-xs text-slate-500">อัปเดตจากข้อมูลล่าสุด</span>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <article className={`signal-tile relative min-h-36 p-4 sm:p-6 ${index % 2 ? "border-l" : ""} ${index > 1 ? "border-t xl:border-t-0" : ""} ${index > 0 ? "xl:border-l" : ""} border-slate-200`} key={metric.label} style={{ animationDelay: `${index * 70}ms` }}>
                <span className={`absolute inset-x-0 top-0 h-0.5 ${metric.line}`} aria-hidden="true" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
                    <strong className="mt-2 block text-[2rem] font-bold leading-none tracking-[-0.04em] text-slate-950 sm:text-[2.25rem]"><AnimatedNumber value={metric.value} /></strong>
                  </div>
                  <span className={`grid h-9 w-9 place-items-center rounded-lg ${metric.tone}`}><Icon size={18} aria-hidden="true" /></span>
                </div>
                <p className="mt-4 text-xs font-medium text-slate-500">{metric.note}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.8fr]">
        <article className="card min-w-0 overflow-hidden">
          <div className="surface-header flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-bold text-slate-950">สถานะใน Pipeline</h2>
              <p className="mt-1 text-xs text-slate-500">จำนวนเคสแยกตามขั้นตอนปัจจุบัน</p>
            </div>
            <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{total} เคส</span>
          </div>
          <div className="space-y-1 p-4 sm:p-5">
            {statusOrder.filter((status) => counts[status]).slice(0, 8).map((status) => {
              const count = counts[status] || 0;
              const percentage = Math.max(4, (count / maxCount) * 100);
              return (
                <div key={status} className="grid min-h-12 grid-cols-[8.8rem_1fr_2rem] items-center gap-3 border-b border-slate-100 px-1 last:border-0 sm:grid-cols-[11rem_1fr_2.5rem]">
                  <span className="truncate text-xs font-semibold text-slate-700">{statusLabels[status]}</span>
                  <div className="h-1.5 overflow-hidden rounded-sm bg-slate-100">
                    <div className="progress-fill h-full rounded-sm bg-brand-500" style={{ width: `${percentage}%`, animationDelay: `${statusOrder.indexOf(status) * 80}ms` }} />
                  </div>
                  <span className="text-right text-xs font-bold text-slate-800">{count}</span>
                </div>
              );
            })}
            {!Object.keys(counts).length ? <p className="py-16 text-center text-sm text-slate-500">ยังไม่มีข้อมูลสถานะ</p> : null}
          </div>
        </article>

        <article className="card overflow-hidden">
          <div className="surface-header flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-bold text-slate-950">SLA การตรวจสินค้า</h2>
              <p className="mt-1 text-xs text-slate-500">นับ 3 วันทำการ เวลาไทย</p>
            </div>
            <span className={`grid h-10 w-10 place-items-center rounded-lg ${overdue ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>
              <Clock3 size={19} aria-hidden="true" />
            </span>
          </div>
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <span className="text-xs font-semibold text-amber-800">ใกล้ครบกำหนด</span>
              <strong className="mt-2 block text-2xl tracking-tight text-amber-950">{summary.due_soon_cases ?? 0}</strong>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
              <span className="text-xs font-semibold text-rose-800">เกินกำหนด</span>
              <strong className="mt-2 block text-2xl tracking-tight text-rose-950">{overdue}</strong>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex gap-3">
              <CircleDollarSign className="mt-0.5 shrink-0 text-brand-600" size={18} aria-hidden="true" />
              <div>
                <p className="text-xs font-bold text-slate-800">ตัวเลขเพื่อการสาธิต</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">คำนวณจากข้อมูลสังเคราะห์ ไม่ใช่ผลการดำเนินงานจริงของบริษัท</p>
              </div>
            </div>
          </div>
          </div>
        </article>
      </section>

      <section className="card mt-5 overflow-hidden">
        <div className="surface-header flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-bold text-slate-950">รายการล่าสุด</h2>
            <p className="mt-0.5 text-xs text-slate-500">เคสที่เพิ่งมีการเปลี่ยนแปลง</p>
          </div>
          <Link href="/cases" className="text-xs font-bold text-brand-700 hover:text-brand-900">ดูทั้งหมด</Link>
        </div>
        {recent.length ? (
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-[46rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-6 py-3 font-semibold">เลขที่เคส</th><th className="px-4 py-3 font-semibold">ผู้ขาย</th><th className="px-4 py-3 font-semibold">สินค้า</th><th className="px-4 py-3 font-semibold">สถานะ</th><th className="px-4 py-3 font-semibold">อัปเดต</th><th className="px-6 py-3" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recent.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/75">
                    <td className="mono-id px-6 py-4 font-bold text-slate-900">{caseDisplayId(item)}</td>
                    <td className="px-4 py-4"><span className="block font-medium text-slate-800">{item.seller_name}</span><span className="mt-0.5 block text-xs text-slate-500">Ref: {item.seller_ref}</span></td>
                    <td className="px-4 py-4 text-slate-600">{item.item_count ?? item.parts?.length ?? 0} รายการ</td>
                    <td className="px-4 py-4"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-4 text-xs text-slate-500">{formatDateTime(item.updated_at || item.created_at)}</td>
                    <td className="px-6 py-4 text-right"><Link href={`/cases/${item.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-brand-50 hover:text-brand-700" aria-label={`ดู ${caseDisplayId(item)}`}><ArrowRight size={16} aria-hidden="true" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="p-10 text-center text-sm text-slate-500">ยังไม่มีรายการ</div>}
      </section>

      <section className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white px-5 py-4">
        <ol className="flex min-w-[46rem] items-center" aria-label="กระบวนการหลัก">
          {workflow.map((step, index) => (
            <li className="flex flex-1 items-center" key={step.status}>
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-brand-100">{index + 1}</span>
                <span className="text-xs font-semibold text-slate-700">{step.short}</span>
              </div>
              {index < workflow.length - 1 ? <span className="mx-4 h-px flex-1 bg-slate-200" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
