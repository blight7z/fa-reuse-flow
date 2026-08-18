"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileCheck2,
  FileSpreadsheet,
  RotateCcw,
  UploadCloud,
  X,
} from "lucide-react";
import { api, friendlyError } from "@/lib/api";
import { caseDisplayId } from "@/lib/format";
import type { BuybackCase, ImportJob } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { InlineAlert, PageHeader } from "@/components/ui";

const columns = [
  ["seller_ref", "Seller ref"],
  ["brand", "ยี่ห้อ"],
  ["model", "รุ่น"],
  ["category", "หมวดหมู่"],
  ["quantity", "จำนวน"],
  ["claimed_condition", "สภาพที่แจ้ง"],
  ["serial_number", "Serial"],
  ["notes", "หมายเหตุ"],
] as const;

function errorText(value: string | string[]): string {
  return Array.isArray(value) ? value.join(", ") : value;
}

export default function ImportsPage() {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sellerName, setSellerName] = useState("");
  const [sellerContact, setSellerContact] = useState("");
  const [error, setError] = useState("");
  const [createdCase, setCreatedCase] = useState<BuybackCase | null>(null);

  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    setCreatedCase(null);
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("รองรับเฉพาะไฟล์ .xlsx เท่านั้น");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
      return;
    }
    setSourceFile(file);
    setUploading(true);
    try {
      setJob(await api.uploadImport(file));
    } catch (reason) {
      setJob(null);
      setError(friendlyError(reason));
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void upload(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer.files?.[0]);
  };

  const reset = () => {
    setJob(null);
    setSourceFile(null);
    setError("");
    setCreatedCase(null);
    setSellerName("");
    setSellerContact("");
  };

  const commit = async () => {
    if (!job || !sellerName.trim()) return;
    setCommitting(true);
    setError("");
    try {
      const result = await api.commitImport(job.id, sellerName.trim(), sellerContact.trim());
      setCreatedCase(result.case);
      setJob(result.job);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setCommitting(false);
    }
  };

  const canCommit = job && job.invalid_rows === 0 && !job.committed_at && user?.role !== "INSPECTOR";

  return (
    <>
      <PageHeader
        eyebrow="Excel intake"
        title="นำเข้ารายการสินค้า"
        description="ตรวจรูปแบบและความถูกต้องของข้อมูลทุกแถวก่อนสร้างเคสจริง"
        actions={<a className="btn btn-secondary" href="/samples/fa-reuse-import.xlsx" download><Download size={16} aria-hidden="true" /> ดาวน์โหลดไฟล์ตัวอย่าง</a>}
      />

      <ol className="card mb-5 grid overflow-hidden sm:grid-cols-3" aria-label="ขั้นตอนนำเข้า">
        {[
          ["1", "อัปโหลดไฟล์", "XLSX ไม่เกิน 5 MB"],
          ["2", "ตรวจ Preview", "แก้ทุกแถวที่มีปัญหา"],
          ["3", "สร้างเคส", "Commit เมื่อข้อมูลผ่านทั้งหมด"],
        ].map(([number, title, detail], index) => {
          const active = index === 0 ? !job : index === 1 ? !!job && !createdCase : !!createdCase;
          const done = index === 0 ? !!job : index === 1 ? !!createdCase : false;
          return (
            <li className={`relative border-b p-3.5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${active ? "bg-brand-50" : done ? "bg-emerald-50/70" : "bg-white"}`} key={number}>
              {active ? <span className="absolute inset-x-0 top-0 h-0.5 bg-brand-500" aria-hidden="true" /> : null}
              <div className="flex items-center gap-3">
                <span className={`grid h-7 w-7 place-items-center rounded-md text-xs font-bold ${active ? "bg-brand-600 text-white" : done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {done ? <CheckCircle2 size={15} aria-hidden="true" /> : number}
                </span>
                <span><strong className="block text-xs text-slate-900">{title}</strong><span className="mt-0.5 block text-xs text-slate-500">{detail}</span></span>
              </div>
            </li>
          );
        })}
      </ol>

      {error ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="ปิดข้อความ"><X size={16} aria-hidden="true" /></button>
        </div>
      ) : null}

      {createdCase ? (
        <section className="card overflow-hidden">
          <div className="bg-emerald-600 px-6 py-8 text-center text-white sm:px-8">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/15"><CheckCircle2 size={30} aria-hidden="true" /></span>
            <h2 className="mt-4 text-xl font-bold">สร้างเคสสำเร็จ</h2>
            <p className="mt-1 text-sm text-emerald-50">{caseDisplayId(createdCase)} · {createdCase.seller_name}</p>
          </div>
          <div className="flex flex-col items-center gap-3 px-6 py-7 text-center">
            <p className="max-w-xl text-sm leading-6 text-slate-600">ระบบบันทึกรายการจากไฟล์และสร้าง Audit event แรกแล้ว คุณสามารถเปิดเคสเพื่อเริ่มประเมินราคาได้ทันที</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn btn-secondary" onClick={reset}><RotateCcw size={16} aria-hidden="true" /> นำเข้าไฟล์ใหม่</button>
              <Link href={`/cases/${createdCase.id}`} className="btn btn-primary">เปิดเคส <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>
      ) : !job ? (
        <section
          className={`industrial-grid card relative overflow-hidden border-2 border-dashed p-6 transition-colors sm:p-10 ${dragging ? "border-brand-500 bg-brand-50" : "border-slate-300"}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
          onDrop={onDrop}
        >
          <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={onFileChange} aria-label="เลือกไฟล์ Excel" />
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <span className={`upload-float grid h-14 w-14 place-items-center rounded-lg ${dragging ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"}`}>
              {uploading ? <span className="spinner" aria-hidden="true" /> : <UploadCloud size={27} aria-hidden="true" />}
            </span>
            <h2 className="mt-5 text-base font-bold text-slate-950">{uploading ? "กำลังตรวจสอบไฟล์…" : "วางไฟล์ Excel ที่นี่"}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">หรือเลือกไฟล์ .xlsx จากเครื่องของคุณ ระบบจะยังไม่สร้างเคสจนกว่าจะกดยืนยัน</p>
            <button type="button" className="btn btn-primary mt-5" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <FileSpreadsheet size={16} aria-hidden="true" /> เลือกไฟล์
            </button>
            <p className="mono-id mt-5 text-xs text-slate-400">seller_ref · brand · model · category · quantity · claimed_condition</p>
          </div>
        </section>
      ) : (
        <div className="space-y-5">
          <section className="card p-5 sm:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><FileCheck2 size={21} aria-hidden="true" /></span>
                <div className="min-w-0"><h2 className="truncate text-sm font-bold text-slate-900">{job.filename || sourceFile?.name}</h2><p className="mt-1 text-xs text-slate-500">Import ID: {job.id}</p></div>
              </div>
              <button type="button" className="btn btn-secondary" onClick={reset}><RotateCcw size={16} aria-hidden="true" /> เปลี่ยนไฟล์</button>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-5">
              <div><span className="block text-[0.68rem] font-semibold text-slate-500">ทั้งหมด</span><strong className="mt-1 block text-xl text-slate-950">{job.total_rows}</strong></div>
              <div><span className="block text-[0.68rem] font-semibold text-emerald-700">ผ่าน</span><strong className="mt-1 block text-xl text-emerald-700">{job.valid_rows}</strong></div>
              <div><span className="block text-[0.68rem] font-semibold text-rose-700">ต้องแก้ไข</span><strong className="mt-1 block text-xl text-rose-700">{job.invalid_rows}</strong></div>
            </div>
          </section>

          {job.invalid_rows > 0 ? (
            <InlineAlert tone="danger"><strong>ยังสร้างเคสไม่ได้:</strong> ดาวน์โหลดหรือเปิดไฟล์ต้นฉบับ แก้ไข {job.invalid_rows} แถวตามข้อความด้านล่าง แล้วอัปโหลดอีกครั้ง</InlineAlert>
          ) : (
            <InlineAlert tone="success"><strong>ข้อมูลผ่านทุกแถว:</strong> ตรวจทาน Preview และกรอกข้อมูลผู้ขายก่อนสร้างเคส</InlineAlert>
          )}

          <section className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold text-slate-950">Preview ข้อมูล</h2><p className="mt-1 text-xs text-slate-500">แถวสีแดงต้องแก้ไขในไฟล์ต้นฉบับ</p></div>
            <div className="max-h-[29rem] overflow-auto">
              <table className="data-table w-full min-w-[72rem] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_#e2e8f0]">
                  <tr><th className="px-4 py-3 font-semibold">แถว</th><th className="px-3 py-3 font-semibold">ผล</th>{columns.map(([key, label]) => <th className="px-3 py-3 font-semibold" key={key}>{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {job.rows.map((row) => (
                    <tr key={row.row_number} className={row.is_valid ? "bg-white" : "bg-rose-50/60"}>
                      <td className="px-4 py-3 font-bold text-slate-700">{row.row_number}</td>
                      <td className="px-3 py-3">{row.is_valid ? <span className="badge-green">ผ่าน</span> : <span className="badge-red">ผิดพลาด</span>}</td>
                      {columns.map(([key]) => {
                        const issue = row.field_errors?.[key];
                        return (
                          <td className={`max-w-[13rem] px-3 py-3 align-top ${issue ? "text-rose-800" : "text-slate-600"}`} key={key}>
                            <span className="block truncate" title={String(row.data[key] ?? "")}>{String(row.data[key] ?? "—")}</span>
                            {issue ? <span className="mt-1 block whitespace-normal text-[0.64rem] font-semibold leading-4 text-rose-700">{errorText(issue)}</span> : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="font-bold text-slate-950">ข้อมูลผู้ขายและการยืนยัน</h2>
            <p className="mt-1 text-xs text-slate-500">ชื่อผู้ขายจะถูกผูกกับทุกรายการในไฟล์นี้</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div><label htmlFor="seller-name" className="label">ชื่อผู้ขาย <span className="text-rose-600">*</span></label><input id="seller-name" className="input" value={sellerName} onChange={(event) => setSellerName(event.target.value)} disabled={!canCommit} placeholder="เช่น บริษัท ตัวอย่าง ออโตเมชัน จำกัด" /></div>
              <div><label htmlFor="seller-contact" className="label">ข้อมูลติดต่อ</label><input id="seller-contact" className="input" value={sellerContact} onChange={(event) => setSellerContact(event.target.value)} disabled={!canCommit} placeholder="โทรศัพท์หรืออีเมล" /></div>
            </div>
            {user?.role === "INSPECTOR" ? <p className="mt-4 text-xs font-semibold text-amber-700">บทบาท Inspector ดู Preview ได้ แต่ไม่มีสิทธิ์สร้างเคส</p> : null}
            <div className="mt-5 flex flex-col-reverse items-stretch justify-end gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
              <button type="button" className="btn btn-secondary" onClick={reset}>ยกเลิก</button>
              <button type="button" className="btn btn-primary" disabled={!canCommit || !sellerName.trim() || committing} onClick={commit}>
                {committing ? <><span className="spinner" aria-hidden="true" /> กำลังสร้างเคส…</> : <><CheckCircle2 size={16} aria-hidden="true" /> ยืนยันและสร้างเคส</>}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
