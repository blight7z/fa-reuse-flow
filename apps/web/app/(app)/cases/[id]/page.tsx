"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardCheck,
  FileText,
  History,
  Mail,
  PackageCheck,
  Paperclip,
  Phone,
  Printer,
  Save,
  ShieldCheck,
  Upload,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import { api, friendlyError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  allowedTransitions,
  caseDisplayId,
  formatDateTime,
  formatFileSize,
  formatMoney,
  gradeLabels,
  roleLabels,
  slaPresentation,
  statusLabels,
} from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import type { BuybackCase, CaseStatus, CheckResult, Grade, InspectionInput, PartItem } from "@/lib/types";
import { ErrorState, InlineAlert, PageHeader, StatusBadge } from "@/components/ui";

const mainFlow: CaseStatus[] = ["NEW", "PRELIMINARY_QUOTED", "AWAITING_DELIVERY", "RECEIVED", "INSPECTING", "FINAL_QUOTED", "PAID"];
const noteRequired: CaseStatus[] = ["REJECTED", "ON_HOLD", "RETURN_REQUESTED"];

function resultLabel(value: CheckResult) {
  return value === "PASS" ? "ผ่าน" : value === "FAIL" ? "ไม่ผ่าน" : "ไม่ได้ทดสอบ";
}

function TransitionDialog({ item, onClose, onDone }: { item: BuybackCase; onClose: () => void; onDone: (next: BuybackCase) => void }) {
  const { user } = useAuth();
  const resumeTarget = item.status === "ON_HOLD" && user?.role === "MANAGER" && item.previous_status ? [item.previous_status] : [];
  const transitions = item.status === "ON_HOLD" ? resumeTarget : user ? allowedTransitions(item.status, user.role) : [];
  const [target, setTarget] = useState<CaseStatus | "">(transitions[0] || "");
  const [note, setNote] = useState("");
  const [quote, setQuote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const requiresQuote = target === "PRELIMINARY_QUOTED" || target === "FINAL_QUOTED";
  const requiresNote = target ? noteRequired.includes(target) : false;
  const canSubmit = target && (!requiresQuote || Number(quote) > 0) && (!requiresNote || note.trim().length >= 3);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target || !canSubmit) return;
    setSaving(true);
    setError("");
    try {
      const next = await api.transition(item.id, {
        to_status: target,
        note: note.trim() || undefined,
        preliminary_quote: target === "PRELIMINARY_QUOTED" ? Number(quote) : undefined,
        final_quote: target === "FINAL_QUOTED" ? Number(quote) : undefined,
      });
      onDone(next);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="transition-title">
      <form onSubmit={submit} className="card w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div><p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-brand-700">Workflow action</p><h2 id="transition-title" className="mt-1 text-lg font-bold text-slate-950">เปลี่ยนสถานะเคส</h2></div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose} aria-label="ปิด"><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="space-y-4 px-5 py-5 sm:px-6">
          {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
          {transitions.length ? (
            <>
              <div>
                <label htmlFor="transition-target" className="label">สถานะถัดไป</label>
                <div className="relative">
                  <select id="transition-target" className="input appearance-none pr-10" value={target} onChange={(event) => { setTarget(event.target.value as CaseStatus); setError(""); }}>
                    {transitions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                </div>
              </div>
              {requiresQuote ? (
                <div><label htmlFor="quote" className="label">{target === "FINAL_QUOTED" ? "ราคาสุดท้าย" : "ราคาเบื้องต้น"} (บาท) <span className="text-rose-600">*</span></label><input id="quote" type="number" min="1" step="1" className="input" value={quote} onChange={(event) => setQuote(event.target.value)} placeholder="0" /></div>
              ) : null}
              <div><label htmlFor="transition-note" className="label">หมายเหตุ {requiresNote ? <span className="text-rose-600">*</span> : <span className="font-normal text-slate-400">(ถ้ามี)</span>}</label><textarea id="transition-note" className="input min-h-24 resize-y" value={note} onChange={(event) => setNote(event.target.value)} placeholder={requiresNote ? "ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" : "รายละเอียดสำหรับ Audit trail"} /></div>
              <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600"><strong>ผู้ดำเนินการ:</strong> {user?.full_name} · {user ? roleLabels[user.role] : ""}<br />ระบบจะบันทึกเวลาไทยและสถานะเดิมอัตโนมัติ</div>
            </>
          ) : <InlineAlert tone="warning">บทบาทของคุณไม่มี action ที่ทำได้จากสถานะนี้</InlineAlert>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary" disabled={!canSubmit || saving || !transitions.length}>{saving ? <><span className="spinner" aria-hidden="true" /> กำลังบันทึก…</> : <><ArrowRight size={16} aria-hidden="true" /> ยืนยันสถานะ</>}</button>
        </div>
      </form>
    </div>
  );
}

function InspectionCard({ item, part, onSaved }: { item: BuybackCase; part: PartItem; onSaved: () => void }) {
  const { user } = useAuth();
  const existing = item.inspections?.find((record) => String(record.part_item_id) === String(part.id));
  const canEdit = user?.role === "INSPECTOR" || user?.role === "MANAGER";
  const [expanded, setExpanded] = useState(!existing);
  const [grade, setGrade] = useState<Grade>(existing?.grade || "B");
  const [power, setPower] = useState<CheckResult>(existing?.power_result || "NOT_TESTED");
  const [appearance, setAppearance] = useState<CheckResult>(existing?.appearance_result || "NOT_TESTED");
  const [serialVerified, setSerialVerified] = useState(existing?.serial_verified || false);
  const [accessoriesComplete, setAccessoriesComplete] = useState(existing?.accessories_complete || false);
  const [notes, setNotes] = useState(existing?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const input: InspectionInput = {
      part_item_id: part.id,
      grade,
      power_result: power,
      appearance_result: appearance,
      serial_verified: serialVerified,
      accessories_complete: accessoriesComplete,
      notes: notes.trim() || undefined,
    };
    try {
      await api.inspection(item.id, input);
      onSaved();
      setExpanded(false);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white">
      <button type="button" className="flex w-full items-center gap-3 px-4 py-4 text-left" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${existing ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {existing ? <CheckCircle2 size={18} aria-hidden="true" /> : <Wrench size={18} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{part.brand} {part.model}</strong><span className="mt-0.5 block truncate text-xs text-slate-500">{part.category} · Serial: {part.serial_number || "ไม่มี"}</span></span>
        {existing ? <span className="badge-green">{existing.grade}</span> : <span className="badge-amber">รอตรวจ</span>}
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {expanded ? (
        <form onSubmit={save} className="border-t border-slate-100 px-4 py-5">
          {error ? <div className="mb-4"><InlineAlert tone="danger">{error}</InlineAlert></div> : null}
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className="label" htmlFor={`grade-${part.id}`}>เกรด <span className="text-rose-600">*</span></label><select id={`grade-${part.id}`} className="input" value={grade} onChange={(event) => setGrade(event.target.value as Grade)} disabled={!canEdit}>{Object.entries(gradeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div><label className="label" htmlFor={`power-${part.id}`}>Power test <span className="text-rose-600">*</span></label><select id={`power-${part.id}`} className="input" value={power} onChange={(event) => setPower(event.target.value as CheckResult)} disabled={!canEdit}>{(["PASS", "FAIL", "NOT_TESTED"] as CheckResult[]).map((value) => <option value={value} key={value}>{resultLabel(value)}</option>)}</select></div>
            <div><label className="label" htmlFor={`appearance-${part.id}`}>Appearance <span className="text-rose-600">*</span></label><select id={`appearance-${part.id}`} className="input" value={appearance} onChange={(event) => setAppearance(event.target.value as CheckResult)} disabled={!canEdit}>{(["PASS", "FAIL", "NOT_TESTED"] as CheckResult[]).map((value) => <option value={value} key={value}>{resultLabel(value)}</option>)}</select></div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={`flex items-start gap-3 rounded-xl border p-3 ${serialVerified ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={serialVerified} onChange={(event) => setSerialVerified(event.target.checked)} disabled={!canEdit} /><span><strong className="block text-xs text-slate-800">ยืนยัน Serial number</strong><span className="mt-0.5 block text-[0.66rem] text-slate-500">ตรงกับสินค้าและเอกสาร</span></span></label>
            <label className={`flex items-start gap-3 rounded-xl border p-3 ${accessoriesComplete ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}><input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={accessoriesComplete} onChange={(event) => setAccessoriesComplete(event.target.checked)} disabled={!canEdit} /><span><strong className="block text-xs text-slate-800">อุปกรณ์เสริมครบ</strong><span className="mt-0.5 block text-[0.66rem] text-slate-500">ตรวจเทียบตามรายการที่แจ้ง</span></span></label>
          </div>
          <div className="mt-4"><label htmlFor={`notes-${part.id}`} className="label">หมายเหตุการตรวจ</label><textarea id={`notes-${part.id}`} className="input min-h-20 resize-y" value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!canEdit} placeholder="รอยตำหนิ อาการ หรือรายละเอียดเพิ่มเติม" /></div>
          <div className="mt-4 flex items-center justify-between gap-3"><p className="text-[0.68rem] text-slate-500">{existing ? `ตรวจล่าสุด ${formatDateTime(existing.updated_at || existing.created_at)}` : canEdit ? "บันทึกผลก่อนเสนอราคาสุดท้าย" : "บทบาทของคุณดูผลตรวจได้เท่านั้น"}</p>{canEdit ? <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><span className="spinner" aria-hidden="true" /> บันทึก…</> : <><Save size={16} aria-hidden="true" /> บันทึก QC</>}</button> : null}</div>
        </form>
      ) : null}
    </article>
  );
}

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const result = useAsync(() => api.caseDetail(params.id), [params.id]);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const attachmentInput = useRef<HTMLInputElement>(null);

  const item = result.data;
  const transitions = useMemo(() => {
    if (!item || !user) return [];
    if (item.status === "ON_HOLD") return user.role === "MANAGER" && item.previous_status ? [item.previous_status] : [];
    return allowedTransitions(item.status, user.role);
  }, [item, user]);

  if (result.loading) {
    return <div aria-busy="true"><div className="skeleton h-8 w-64" /><div className="mt-4 skeleton h-5 w-96 max-w-full" /><div className="mt-7 grid gap-5 xl:grid-cols-[1fr_22rem]"><div className="skeleton h-[38rem] card" /><div className="skeleton h-[28rem] card" /></div></div>;
  }
  if (result.error || !item) return <ErrorState error={result.error} onRetry={result.reload} />;

  const sla = slaPresentation(item.sla);
  const mainIndex = mainFlow.indexOf(item.status);
  const inspectedCount = item.inspections?.length || 0;
  const parts = item.parts || [];

  const uploadAttachment = async (file?: File) => {
    if (!file) return;
    setUploadError("");
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
      return;
    }
    setUploading(true);
    try {
      await api.uploadAttachment(item.id, file);
      result.reload();
    } catch (reason) {
      setUploadError(friendlyError(reason));
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Case detail"
        title={caseDisplayId(item)}
        description={`${item.seller_name} · Seller ref: ${item.seller_ref}`}
        backHref="/cases"
        actions={
          <>
            <Link href={`/reports/print?case=${item.id}`} className="btn btn-secondary"><Printer size={16} aria-hidden="true" /> พิมพ์รายงาน</Link>
            <button type="button" className="btn btn-primary" onClick={() => setTransitionOpen(true)} disabled={!transitions.length}><ArrowRight size={16} aria-hidden="true" /> เปลี่ยนสถานะ</button>
          </>
        }
      />

      <section className="card mb-5 overflow-x-auto px-5 py-4">
        <ol className="flex min-w-[55rem] items-start" aria-label="ความคืบหน้ากระบวนการ">
          {mainFlow.map((status, index) => {
            const done = mainIndex > index || item.status === "PAID";
            const current = item.status === status;
            return (
              <li className="flex flex-1 items-start" key={status}>
                <div className="flex flex-col items-center text-center">
                  <span className={`grid h-7 w-7 place-items-center rounded-md text-xs font-bold ${done ? "bg-emerald-600 text-white" : current ? "bg-brand-600 text-white ring-4 ring-brand-100" : "bg-slate-100 text-slate-400"}`}>{done ? <Check size={15} aria-hidden="true" /> : index + 1}</span>
                  <span className={`mt-2 max-w-24 text-xs font-semibold ${current ? "text-brand-700" : done ? "text-slate-700" : "text-slate-400"}`}>{statusLabels[status]}</span>
                </div>
                {index < mainFlow.length - 1 ? <span className={`mt-3.5 h-0.5 flex-1 ${mainIndex > index ? "bg-emerald-500" : "bg-slate-200"}`} aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>
        {!mainFlow.includes(item.status) ? <div className="mt-3 flex justify-center"><StatusBadge status={item.status} /></div> : null}
      </section>

      <section className="card mb-5 grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
        <div className="border-b border-slate-200 p-4 sm:border-r xl:border-b-0"><span className="text-xs font-semibold text-slate-500">สถานะปัจจุบัน</span><div className="mt-2"><StatusBadge status={item.status} /></div></div>
        <div className="border-b border-slate-200 p-4 xl:border-b-0 xl:border-r"><span className="text-xs font-semibold text-slate-500">SLA ตรวจสินค้า</span><strong className={`mt-2 block text-sm ${sla.tone}`}>{sla.label}</strong><span className="mt-1 block text-xs text-slate-400">ครบกำหนด {formatDateTime(item.sla?.due_at || item.inspection_due_at)}</span></div>
        <div className="border-b border-slate-200 p-4 sm:border-b-0 sm:border-r"><span className="text-xs font-semibold text-slate-500">ผลตรวจ QC</span><strong className="mt-2 block text-sm text-slate-900">{inspectedCount} / {parts.length} รายการ</strong><div className="mt-2 h-1.5 rounded-sm bg-slate-100"><div className="h-full rounded-sm bg-emerald-500" style={{ width: `${parts.length ? (inspectedCount / parts.length) * 100 : 0}%` }} /></div></div>
        <div className="p-4"><span className="text-xs font-semibold text-slate-500">ราคา</span><strong className="mt-2 block text-sm text-slate-900">{formatMoney(item.final_quote ?? item.preliminary_quote)}</strong><span className="mt-1 block text-xs text-slate-400">{item.final_quote != null ? "ราคาสุดท้าย" : item.preliminary_quote != null ? "ราคาเบื้องต้น" : "ยังไม่เสนอราคา"}</span></div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <section className="card overflow-hidden">
            <div className="surface-header flex items-center justify-between gap-4 px-5 py-4 sm:px-6"><div><h2 className="flex items-center gap-2 font-bold text-slate-950"><PackageCheck size={18} className="text-brand-600" aria-hidden="true" /> รายการสินค้า</h2><p className="mt-1 text-xs text-slate-500">ข้อมูลจากไฟล์นำเข้า</p></div><span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{parts.length} รายการ</span></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[45rem] text-left text-xs">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3 font-semibold">สินค้า</th><th className="px-4 py-3 font-semibold">หมวดหมู่</th><th className="px-4 py-3 font-semibold">Serial</th><th className="px-4 py-3 font-semibold">จำนวน</th><th className="px-6 py-3 font-semibold">สภาพที่แจ้ง</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{parts.map((part) => <tr key={part.id}><td className="px-6 py-4"><strong className="block text-sm text-slate-900">{part.brand} {part.model}</strong>{part.notes ? <span className="mt-1 block max-w-xs text-[0.68rem] text-slate-500">{part.notes}</span> : null}</td><td className="px-4 py-4 text-slate-600">{part.category}</td><td className="px-4 py-4 font-mono text-[0.7rem] text-slate-600">{part.serial_number || "—"}</td><td className="px-4 py-4 text-slate-600">{part.quantity}</td><td className="px-6 py-4 text-slate-600">{part.claimed_condition}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section className="card p-5 sm:p-6" id="inspection">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="flex items-center gap-2 font-bold text-slate-950"><ClipboardCheck size={18} className="text-brand-600" aria-hidden="true" /> QC Checklist</h2><p className="mt-1 text-xs text-slate-500">ต้องบันทึกผลครบทุกชิ้นก่อนเสนอราคาสุดท้าย</p></div><span className={inspectedCount === parts.length && parts.length ? "badge-green" : "badge-amber"}>{inspectedCount === parts.length && parts.length ? "ตรวจครบแล้ว" : `รอตรวจ ${Math.max(0, parts.length - inspectedCount)} รายการ`}</span></div>
            {parts.length ? <div className="space-y-3">{parts.map((part) => <InspectionCard key={part.id} item={item} part={part} onSaved={result.reload} />)}</div> : <p className="py-8 text-center text-sm text-slate-500">ไม่มีรายการสินค้า</p>}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6"><div><h2 className="flex items-center gap-2 font-bold text-slate-950"><Camera size={18} className="text-brand-600" aria-hidden="true" /> หลักฐานและไฟล์แนบ</h2><p className="mt-1 text-xs text-slate-500">รูปสินค้า เอกสาร หรือผลการตรวจ</p></div><button type="button" className="btn btn-secondary" onClick={() => attachmentInput.current?.click()} disabled={uploading}><Upload size={15} aria-hidden="true" /> {uploading ? "กำลังอัปโหลด…" : "เพิ่มไฟล์"}</button><input ref={attachmentInput} type="file" className="sr-only" accept="image/*,.pdf" onChange={(event) => { void uploadAttachment(event.target.files?.[0]); event.target.value = ""; }} /></div>
            {uploadError ? <div className="px-5 pt-4 sm:px-6"><InlineAlert tone="danger">{uploadError}</InlineAlert></div> : null}
            {item.attachments?.length ? <ul className="divide-y divide-slate-100">{item.attachments.map((file) => <li className="flex items-center gap-3 px-5 py-3.5 sm:px-6" key={file.id}><span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500"><Paperclip size={16} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{file.filename}</span><span className="mt-0.5 block text-[0.66rem] text-slate-400">{formatFileSize(file.size_bytes)} · {formatDateTime(file.created_at)}</span></span>{file.url ? <a href={file.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand-700">เปิดไฟล์</a> : null}</li>)}</ul> : <div className="px-6 py-8 text-center text-sm text-slate-500"><Paperclip size={22} className="mx-auto mb-2 text-slate-300" aria-hidden="true" />ยังไม่มีไฟล์แนบ</div>}
          </section>

          <section className="card p-5 sm:p-6">
            <div className="mb-5"><h2 className="flex items-center gap-2 font-bold text-slate-950"><History size={18} className="text-brand-600" aria-hidden="true" /> Audit trail</h2><p className="mt-1 text-xs text-slate-500">ประวัติสถานะ ผู้ดำเนินการ และเหตุผล</p></div>
            {item.status_events?.length ? <ol className="relative ml-2 border-l border-slate-200">{[...item.status_events].reverse().map((event, index) => <li className="relative pb-6 pl-6 last:pb-0" key={event.id}><span className={`absolute -left-[0.42rem] top-1 grid h-3 w-3 rounded-full border-2 border-white ${index === 0 ? "bg-brand-600 ring-4 ring-brand-50" : "bg-slate-300"}`} /><div className="flex flex-col justify-between gap-1 sm:flex-row"><div><p className="text-xs font-bold text-slate-800">{event.from_status ? <>{statusLabels[event.from_status]} <ArrowRight className="mx-1 inline" size={12} aria-hidden="true" /></> : null}{statusLabels[event.to_status]}</p><p className="mt-1 text-[0.68rem] text-slate-500">{event.actor_name || "ระบบ"}{event.actor_role ? ` · ${roleLabels[event.actor_role]}` : ""}</p>{event.note ? <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{event.note}</p> : null}</div><time className="shrink-0 text-[0.66rem] text-slate-400">{formatDateTime(event.created_at)}</time></div></li>)}</ol> : <p className="py-6 text-center text-sm text-slate-500">ยังไม่มีประวัติ</p>}
          </section>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-950"><Building2 size={18} className="text-brand-600" aria-hidden="true" /> ข้อมูลผู้ขาย</h2>
            <dl className="mt-5 space-y-4 text-xs">
              <div className="flex gap-3"><UserRound size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /><div><dt className="text-slate-400">ชื่อผู้ขาย</dt><dd className="mt-1 font-semibold leading-5 text-slate-800">{item.seller_name}</dd></div></div>
              <div className="flex gap-3"><FileText size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /><div><dt className="text-slate-400">Seller reference</dt><dd className="mt-1 font-semibold text-slate-800">{item.seller_ref}</dd></div></div>
              <div className="flex gap-3">{item.seller_contact?.includes("@") ? <Mail size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" /> : <Phone size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />}<div><dt className="text-slate-400">ข้อมูลติดต่อ</dt><dd className="mt-1 break-all font-semibold leading-5 text-slate-800">{item.seller_contact || "ไม่ระบุ"}</dd></div></div>
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-950"><CalendarClock size={18} className="text-brand-600" aria-hidden="true" /> วันที่สำคัญ</h2>
            <dl className="mt-5 space-y-3 text-xs"><div className="flex justify-between gap-4"><dt className="text-slate-500">สร้างเคส</dt><dd className="text-right font-semibold text-slate-700">{formatDateTime(item.created_at)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">รับสินค้า</dt><dd className="text-right font-semibold text-slate-700">{formatDateTime(item.received_at)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">ครบกำหนด QC</dt><dd className={`text-right font-semibold ${sla.tone}`}>{formatDateTime(item.sla?.due_at || item.inspection_due_at)}</dd></div><div className="flex justify-between gap-4"><dt className="text-slate-500">ปิดงาน</dt><dd className="text-right font-semibold text-slate-700">{formatDateTime(item.completed_at || item.paid_at)}</dd></div></dl>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 font-bold text-slate-950"><ShieldCheck size={18} className="text-brand-600" aria-hidden="true" /> Business rules</h2>
            <ul className="mt-4 space-y-3 text-[0.7rem] leading-5 text-slate-600"><li className="flex gap-2"><CircleDot size={14} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" /> ตรวจ QC ครบทุกชิ้นก่อน Final quote</li><li className="flex gap-2"><CircleDot size={14} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" /> เหตุผลจำเป็นเมื่อพัก ปฏิเสธ หรือส่งคืน</li><li className="flex gap-2"><CircleDot size={14} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" /> Manager เท่านั้นที่ยืนยันชำระเงินและคืนสินค้า</li></ul>
            {!transitions.length ? <div className="mt-4 flex gap-2 rounded-lg bg-slate-50 p-3 text-[0.68rem] leading-5 text-slate-500"><AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden="true" /> ไม่มี action สำหรับบทบาทนี้ในสถานะปัจจุบัน</div> : null}
          </section>
        </aside>
      </div>

      {transitionOpen ? <TransitionDialog item={item} onClose={() => setTransitionOpen(false)} onDone={(next) => { result.setData(next); setTransitionOpen(false); }} /> : null}
    </>
  );
}
