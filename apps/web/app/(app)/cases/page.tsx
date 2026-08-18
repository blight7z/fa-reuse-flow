"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, FileSpreadsheet, Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import { caseDisplayId, formatDateTime, slaPresentation, statusLabels, statusOrder } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import type { CaseStatus } from "@/lib/types";
import { EmptyState, ErrorState, PageHeader, StatusBadge } from "@/components/ui";

export default function CasesPage() {
  const [status, setStatus] = useState<CaseStatus | "">("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const result = useAsync(() => api.cases({ status, page, pageSize: 20 }), [status, page]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("th");
    if (!needle) return result.data?.items || [];
    return (result.data?.items || []).filter((item) =>
      [caseDisplayId(item), item.seller_name, item.seller_ref, item.seller_contact]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("th").includes(needle)),
    );
  }, [query, result.data]);

  const pageCount = result.data ? Math.max(1, Math.ceil(result.data.total / result.data.page_size)) : 1;

  return (
    <>
      <PageHeader
        eyebrow="Buyback cases"
        title="รายการรับซื้อ"
        description="ติดตามผู้ขาย สินค้า สถานะ และกำหนดตรวจสอบในมุมมองเดียว"
        actions={<Link href="/imports" className="btn btn-primary"><FileSpreadsheet size={16} aria-hidden="true" /> นำเข้ารายการ</Link>}
      />

      <section className="card mb-5 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_15rem_auto]">
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <label htmlFor="case-search" className="sr-only">ค้นหารายการ</label>
            <input id="case-search" className="input pl-10" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเลขที่เคส ผู้ขาย หรือ Reference" />
          </div>
          <div className="relative">
            <SlidersHorizontal size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <label htmlFor="status-filter" className="sr-only">กรองตามสถานะ</label>
            <select
              id="status-filter"
              className="input appearance-none pl-10"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CaseStatus | "");
                setPage(1);
              }}
            >
              <option value="">ทุกสถานะ</option>
              {statusOrder.map((value) => <option value={value} key={value}>{statusLabels[value]}</option>)}
            </select>
          </div>
          <div className="flex min-h-11 items-center justify-end rounded-lg border border-slate-200 bg-slate-50 px-4 text-xs font-semibold text-slate-600">
            ผลลัพธ์ {result.data?.total?.toLocaleString("th-TH") || 0} เคส
          </div>
        </div>
      </section>

      {result.loading ? (
        <div className="card overflow-hidden" aria-busy="true" aria-label="กำลังโหลดรายการ">
          {Array.from({ length: 7 }).map((_, index) => (
            <div className="flex items-center gap-6 border-b border-slate-100 px-6 py-5 last:border-0" key={index}>
              <div className="skeleton h-4 w-24" /><div className="skeleton h-4 w-44" /><div className="skeleton h-6 w-28" /><div className="skeleton ml-auto h-4 w-32" />
            </div>
          ))}
        </div>
      ) : result.error ? (
        <ErrorState error={result.error} onRetry={result.reload} />
      ) : filtered.length ? (
        <>
          <section className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="data-table w-full min-w-[56rem] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="px-6 py-3.5 font-semibold">เลขที่เคส</th><th className="px-4 py-3.5 font-semibold">ผู้ขาย</th><th className="px-4 py-3.5 font-semibold">สินค้า</th><th className="px-4 py-3.5 font-semibold">สถานะ</th><th className="px-4 py-3.5 font-semibold">SLA</th><th className="px-4 py-3.5 font-semibold">อัปเดต</th><th className="px-6 py-3.5" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((item) => {
                    const sla = slaPresentation(item.sla);
                    return (
                      <tr className="group hover:bg-brand-50/30" key={item.id}>
                        <td className="px-6 py-4"><Link className="mono-id font-bold text-slate-900 group-hover:text-brand-700" href={`/cases/${item.id}`}>{caseDisplayId(item)}</Link><span className="mt-0.5 block text-xs font-normal text-slate-400">{item.seller_ref}</span></td>
                        <td className="px-4 py-4"><span className="font-medium text-slate-800">{item.seller_name}</span><span className="mt-0.5 block text-xs text-slate-500">{item.seller_contact || "ไม่มีข้อมูลติดต่อ"}</span></td>
                        <td className="px-4 py-4 text-slate-600">{item.item_count ?? item.parts?.length ?? 0} รายการ</td>
                        <td className="px-4 py-4"><StatusBadge status={item.status} /></td>
                        <td className={`px-4 py-4 text-xs font-semibold ${sla.tone}`}>{sla.label}</td>
                        <td className="px-4 py-4 text-xs text-slate-500">{formatDateTime(item.updated_at || item.created_at)}</td>
                        <td className="px-6 py-4 text-right"><Link href={`/cases/${item.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-brand-700" aria-label={`เปิด ${caseDisplayId(item)}`}><ArrowRight size={16} aria-hidden="true" /></Link></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-3 md:hidden" aria-label="รายการรับซื้อ">
            {filtered.map((item) => {
              const sla = slaPresentation(item.sla);
              return (
                <Link href={`/cases/${item.id}`} className="card card-lift block p-4 transition-colors hover:border-brand-200" key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div><strong className="mono-id text-sm text-slate-950">{caseDisplayId(item)}</strong><span className="mt-0.5 block text-xs text-slate-500">{item.seller_name}</span></div>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                    <div><span className="block text-slate-400">สินค้า</span><span className="mt-1 block font-semibold text-slate-700">{item.item_count ?? item.parts?.length ?? 0} รายการ</span></div>
                    <div><span className="block text-slate-400">SLA</span><span className={`mt-1 block font-semibold ${sla.tone}`}>{sla.label}</span></div>
                  </div>
                </Link>
              );
            })}
          </section>

          <nav className="mt-5 flex items-center justify-between" aria-label="แบ่งหน้ารายการ">
            <p className="text-xs text-slate-500">หน้า {page.toLocaleString("th-TH")} จาก {pageCount.toLocaleString("th-TH")}</p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={15} aria-hidden="true" /> ก่อนหน้า</button>
              <button type="button" className="btn btn-secondary" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>ถัดไป <ArrowRight size={15} aria-hidden="true" /></button>
            </div>
          </nav>
        </>
      ) : (
        <div className="card">
          <EmptyState
            title={query || status ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีรายการรับซื้อ"}
            description={query || status ? "ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" : "เริ่มต้นด้วยการนำเข้าไฟล์ Excel ตัวอย่าง"}
            action={!query && !status ? <Link href="/imports" className="btn btn-primary">นำเข้า Excel</Link> : undefined}
          />
        </div>
      )}
    </>
  );
}
