import type { CaseStatus, Grade, Role, SlaInfo } from "@/lib/types";

export const statusLabels: Record<CaseStatus, string> = {
  NEW: "รายการใหม่",
  PRELIMINARY_QUOTED: "เสนอราคาเบื้องต้น",
  AWAITING_DELIVERY: "รอรับสินค้า",
  RECEIVED: "รับสินค้าแล้ว",
  INSPECTING: "กำลังตรวจ QC",
  FINAL_QUOTED: "เสนอราคาสุดท้าย",
  PAID: "ชำระเงินแล้ว",
  REJECTED: "ปฏิเสธ",
  ON_HOLD: "พักรายการ",
  RETURN_REQUESTED: "รอส่งคืน",
  RETURNED: "ส่งคืนแล้ว",
};

export const roleLabels: Record<Role, string> = {
  ESTIMATOR: "เจ้าหน้าที่ประเมินราคา",
  INSPECTOR: "เจ้าหน้าที่ตรวจสอบ",
  MANAGER: "ผู้จัดการ",
};

export const gradeLabels: Record<Grade, string> = {
  N: "N · ใหม่",
  A: "A · ดีเยี่ยม",
  B: "B · ใช้งานได้ดี",
  C: "C · มีร่องรอย",
  D: "D · ต้องซ่อม",
  JUNK: "JUNK · ไม่รับซื้อ",
};

export const statusTone: Record<CaseStatus, string> = {
  NEW: "badge-neutral",
  PRELIMINARY_QUOTED: "badge-blue",
  AWAITING_DELIVERY: "badge-cyan",
  RECEIVED: "badge-violet",
  INSPECTING: "badge-amber",
  FINAL_QUOTED: "badge-indigo",
  PAID: "badge-green",
  REJECTED: "badge-red",
  ON_HOLD: "badge-slate",
  RETURN_REQUESTED: "badge-orange",
  RETURNED: "badge-neutral",
};

export const statusOrder: CaseStatus[] = [
  "NEW",
  "PRELIMINARY_QUOTED",
  "AWAITING_DELIVERY",
  "RECEIVED",
  "INSPECTING",
  "FINAL_QUOTED",
  "PAID",
  "RETURN_REQUESTED",
  "RETURNED",
  "ON_HOLD",
  "REJECTED",
];

const transitionMap: Record<CaseStatus, CaseStatus[]> = {
  NEW: ["PRELIMINARY_QUOTED", "REJECTED", "ON_HOLD"],
  PRELIMINARY_QUOTED: ["AWAITING_DELIVERY", "REJECTED", "ON_HOLD"],
  AWAITING_DELIVERY: ["RECEIVED", "ON_HOLD"],
  RECEIVED: ["INSPECTING", "ON_HOLD"],
  INSPECTING: ["FINAL_QUOTED", "ON_HOLD"],
  FINAL_QUOTED: ["PAID", "RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURNED"],
  ON_HOLD: ["NEW", "PRELIMINARY_QUOTED", "AWAITING_DELIVERY", "RECEIVED", "INSPECTING"],
  PAID: [],
  REJECTED: [],
  RETURNED: [],
};

const roleTargets: Record<Role, CaseStatus[]> = {
  ESTIMATOR: ["PRELIMINARY_QUOTED", "AWAITING_DELIVERY", "RECEIVED", "FINAL_QUOTED", "RETURN_REQUESTED", "REJECTED", "ON_HOLD"],
  INSPECTOR: ["INSPECTING", "ON_HOLD"],
  MANAGER: statusOrder,
};

export function allowedTransitions(status: CaseStatus, role: Role): CaseStatus[] {
  return transitionMap[status].filter((target) => roleTargets[role].includes(target));
}

export function formatMoney(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function caseDisplayId(item: { id?: string | number; case_no?: string; case_number?: string }): string {
  return item.case_number || item.case_no || (item.id != null ? `FA-${String(item.id).padStart(5, "0")}` : "—");
}

export function slaPresentation(sla?: SlaInfo | null): { label: string; tone: string } {
  if (!sla || sla.state === "NOT_STARTED") return { label: "ยังไม่เริ่ม SLA", tone: "text-slate-500" };
  if (sla.state === "COMPLETED") return { label: "เสร็จภายใน SLA", tone: "text-emerald-700" };
  if (sla.state === "OVERDUE") {
    const late = sla.business_days_remaining == null ? "" : ` ${Math.abs(sla.business_days_remaining)} วัน`;
    return { label: `เกินกำหนด${late}`, tone: "text-rose-700" };
  }
  if (sla.state === "DUE_SOON") return { label: "ใกล้ครบกำหนด", tone: "text-amber-700" };
  const days = sla.business_days_remaining == null ? "" : ` · เหลือ ${sla.business_days_remaining} วันทำการ`;
  return { label: `อยู่ในกำหนด${days}`, tone: "text-blue-700" };
}
