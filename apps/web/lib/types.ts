export type Role = "ESTIMATOR" | "INSPECTOR" | "MANAGER";

export type CaseStatus =
  | "NEW"
  | "PRELIMINARY_QUOTED"
  | "AWAITING_DELIVERY"
  | "RECEIVED"
  | "INSPECTING"
  | "FINAL_QUOTED"
  | "PAID"
  | "REJECTED"
  | "ON_HOLD"
  | "RETURN_REQUESTED"
  | "RETURNED";

export type Grade = "N" | "A" | "B" | "C" | "D" | "JUNK";
export type CheckResult = "PASS" | "FAIL" | "NOT_TESTED";

export interface User {
  id: number | string;
  username: string;
  full_name: string;
  role: Role;
}

export interface PartItem {
  id: number | string;
  brand: string;
  model: string;
  category: string;
  quantity: number;
  claimed_condition: string;
  serial_number?: string | null;
  notes?: string | null;
}

export interface Inspection {
  id: number | string;
  part_item_id: number | string;
  grade: Grade;
  power_result: CheckResult;
  appearance_result: CheckResult;
  serial_verified: boolean;
  accessories_complete: boolean;
  notes?: string | null;
  inspector_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StatusEvent {
  id: number | string;
  from_status?: CaseStatus | null;
  to_status: CaseStatus;
  note?: string | null;
  actor_name?: string | null;
  actor_role?: Role | null;
  created_at: string;
}

export interface Attachment {
  id: number | string;
  filename: string;
  content_type?: string | null;
  size_bytes?: number | null;
  url?: string | null;
  created_at?: string;
}

export interface SlaInfo {
  due_at?: string | null;
  state: "NOT_STARTED" | "ON_TRACK" | "DUE_SOON" | "OVERDUE" | "COMPLETED";
  business_days_remaining?: number | null;
}

export interface BuybackCase {
  id: number | string;
  case_no?: string;
  case_number?: string;
  seller_ref: string;
  seller_name: string;
  seller_contact?: string | null;
  status: CaseStatus;
  previous_status?: CaseStatus | null;
  preliminary_quote?: number | null;
  final_quote?: number | null;
  created_at: string;
  updated_at?: string;
  received_at?: string | null;
  inspection_due_at?: string | null;
  paid_at?: string | null;
  hold_reason?: string | null;
  resolution_reason?: string | null;
  completed_at?: string | null;
  item_count?: number;
  parts: PartItem[];
  inspections: Inspection[];
  status_events: StatusEvent[];
  attachments: Attachment[];
  sla?: SlaInfo | null;
}

export interface CaseListResponse {
  items: BuybackCase[];
  total: number;
  page: number;
  page_size: number;
}

export interface ReportCaseRow {
  case_number: string;
  seller_ref: string;
  seller_name: string;
  status: CaseStatus;
  item_count: number;
  preliminary_quote?: number | null;
  final_quote?: number | null;
  received_at?: string | null;
  inspection_due_at?: string | null;
  sla_state: string;
  created_at: string;
  completed_at?: string | null;
}

export interface CasesReportResponse {
  title: string;
  generated_at: string;
  data_notice: string;
  total: number;
  rows: ReportCaseRow[];
}

export interface DashboardSummary {
  total_cases?: number;
  active_cases?: number;
  open_cases?: number;
  pending_cases?: number;
  overdue_cases?: number;
  due_soon_cases?: number;
  completed_cases?: number;
  average_cycle_hours?: number | null;
  avg_cycle_hours?: number | null;
  by_status?: Partial<Record<CaseStatus, number>>;
  status_counts?: Partial<Record<CaseStatus, number>>;
  recent_cases?: BuybackCase[];
}

export interface ImportRow {
  row_number: number;
  data: Record<string, string | number | null>;
  is_valid: boolean;
  field_errors: Record<string, string | string[]>;
}

export interface ImportJob {
  id: number | string;
  status: string;
  filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  rows: ImportRow[];
  committed_at?: string | null;
}

export interface ApiErrorDetail {
  code?: string;
  message?: string;
  field_errors?: Record<string, string | string[]>;
}

export interface TransitionInput {
  to_status: CaseStatus;
  note?: string;
  preliminary_quote?: number;
  final_quote?: number;
}

export interface InspectionInput {
  part_item_id: number | string;
  grade: Grade;
  power_result: CheckResult;
  appearance_result: CheckResult;
  serial_verified: boolean;
  accessories_complete: boolean;
  notes?: string;
}
