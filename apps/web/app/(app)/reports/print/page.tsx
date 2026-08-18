"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { caseDisplayId, formatDateTime, formatMoney, statusLabels } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import type { BuybackCase } from "@/lib/types";
import { EmptyState, ErrorState } from "@/components/ui";

function ReportContent() {
  const searchParams = useSearchParams();
  const requestedCase = searchParams.get("case");
  const result = useAsync(async () => {
    if (requestedCase) return [await api.caseDetail(requestedCase)];
    const payload = await api.reportCases();
    return payload.rows;
  }, [requestedCase]);

  if (result.loading) return <div className="card h-96 skeleton" aria-label="กำลังสร้างรายงาน" aria-busy="true" />;
  if (result.error) return <ErrorState error={result.error} onRetry={result.reload} />;

  const items = result.data || [];
  const completed = items.filter((item) => ["PAID", "RETURNED", "REJECTED"].includes(item.status)).length;
  const totalValue = items.reduce((sum, item) => sum + (item.final_quote || 0), 0);

  return (
    <div className="print-root">
      <div className="no-print mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link href={requestedCase ? `/cases/${requestedCase}` : "/"} className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-700"><ArrowLeft size={15} aria-hidden="true" /> กลับ</Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">รายงานรายการรับซื้อ</h1>
          <p className="mt-1 text-sm text-slate-600">รูปแบบสำหรับพิมพ์หรือบันทึกเป็น PDF</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!requestedCase ? <a href={api.csvUrl} className="btn btn-secondary" download><Download size={16} aria-hidden="true" /> Export CSV</a> : null}
          <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> พิมพ์รายงาน</button>
        </div>
      </div>

      <header className="mb-5 border-b-2 border-slate-900 pb-4">
        <div className="flex items-start justify-between gap-6">
          <div><p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-brand-700">FA REUSE FLOW · PORTFOLIO PROPOSAL</p><h2 className="mt-1 text-xl font-bold text-slate-950">{requestedCase && items[0] ? `รายงานเคส ${caseDisplayId(items[0])}` : "รายงานสรุปรายการรับซื้อ"}</h2><p className="mt-1 text-xs text-slate-500">ข้อมูลสังเคราะห์เพื่อสาธิตระบบ</p></div>
          <div className="text-right text-[0.68rem] leading-5 text-slate-500"><strong className="block text-slate-800">สร้างรายงาน</strong>{formatDateTime(new Date().toISOString())}<br />Asia/Bangkok</div>
        </div>
      </header>

      {items.length ? (
        <>
          <section className="mb-5 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 p-4"><span className="text-[0.66rem] font-semibold text-slate-500">จำนวนเคส</span><strong className="mt-1 block text-xl text-slate-950">{items.length.toLocaleString("th-TH")}</strong></div>
            <div className="rounded-xl border border-slate-200 p-4"><span className="text-[0.66rem] font-semibold text-slate-500">ปิดกระบวนการ</span><strong className="mt-1 block text-xl text-slate-950">{completed.toLocaleString("th-TH")}</strong></div>
            <div className="rounded-xl border border-slate-200 p-4"><span className="text-[0.66rem] font-semibold text-slate-500">มูลค่าราคาสุดท้าย</span><strong className="mt-1 block text-xl text-slate-950">{formatMoney(totalValue)}</strong></div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-300">
            <table className="w-full text-left text-[0.7rem]">
              <thead className="bg-slate-900 text-white"><tr><th className="px-4 py-3 font-semibold">เลขที่เคส</th><th className="px-3 py-3 font-semibold">ผู้ขาย / Reference</th><th className="px-3 py-3 font-semibold">สินค้า</th><th className="px-3 py-3 font-semibold">สถานะ</th><th className="px-3 py-3 text-right font-semibold">ราคาเบื้องต้น</th><th className="px-3 py-3 text-right font-semibold">ราคาสุดท้าย</th><th className="px-4 py-3 font-semibold">อัปเดต</th></tr></thead>
              <tbody className="divide-y divide-slate-200">{items.map((item) => <tr key={caseDisplayId(item)} className="even:bg-slate-50"><td className="px-4 py-3 font-bold text-slate-900">{caseDisplayId(item)}</td><td className="px-3 py-3"><span className="block font-semibold text-slate-800">{item.seller_name}</span><span className="text-[0.62rem] text-slate-500">{item.seller_ref}</span></td><td className="px-3 py-3 text-slate-600">{item.item_count ?? ("parts" in item ? item.parts.length : 0)}</td><td className="px-3 py-3 font-semibold text-slate-700">{statusLabels[item.status]}</td><td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatMoney(item.preliminary_quote)}</td><td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800">{formatMoney(item.final_quote)}</td><td className="px-4 py-3 text-slate-500">{formatDateTime("updated_at" in item ? item.updated_at || item.created_at : item.created_at)}</td></tr>)}</tbody>
            </table>
          </section>

          {requestedCase && items[0] && "parts" in items[0] ? <CaseAppendix item={items[0]} /> : null}
        </>
      ) : <div className="card"><EmptyState title="ไม่มีข้อมูลสำหรับรายงาน" description="ลองสร้างเคสหรือล้างตัวกรองก่อน" /></div>}

      <footer className="mt-6 flex justify-between border-t border-slate-200 pt-3 text-[0.62rem] text-slate-400"><span>FA Reuse Flow · Interview portfolio</span><span>ข้อมูลตัวอย่างเพื่อการสาธิต</span></footer>
    </div>
  );
}

function CaseAppendix({ item }: { item: BuybackCase }) {
  return (
    <section className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-300 p-4"><h3 className="text-xs font-bold text-slate-900">รายการสินค้าและผล QC</h3><table className="mt-3 w-full text-left text-[0.68rem]"><thead className="border-b border-slate-200 text-slate-500"><tr><th className="py-2">สินค้า</th><th className="py-2">Serial</th><th className="py-2">Grade</th></tr></thead><tbody className="divide-y divide-slate-100">{(item.parts || []).map((part) => { const inspection = item.inspections?.find((value) => String(value.part_item_id) === String(part.id)); return <tr key={part.id}><td className="py-2.5 font-semibold text-slate-800">{part.brand} {part.model}</td><td className="py-2.5 font-mono text-slate-500">{part.serial_number || "—"}</td><td className="py-2.5 font-bold text-slate-700">{inspection?.grade || "รอตรวจ"}</td></tr>; })}</tbody></table></div>
      <div className="rounded-xl border border-slate-300 p-4"><h3 className="text-xs font-bold text-slate-900">ประวัติสถานะล่าสุด</h3><ol className="mt-3 space-y-3">{[...(item.status_events || [])].reverse().slice(0, 6).map((event) => <li className="flex justify-between gap-4 text-[0.68rem]" key={event.id}><span><strong className="block text-slate-800">{statusLabels[event.to_status]}</strong><span className="text-slate-500">{event.actor_name || "ระบบ"}{event.note ? ` · ${event.note}` : ""}</span></span><time className="shrink-0 text-slate-400">{formatDateTime(event.created_at)}</time></li>)}</ol></div>
    </section>
  );
}

export default function ReportPage() {
  return <Suspense fallback={<div className="card h-96 skeleton" />}><ReportContent /></Suspense>;
}
