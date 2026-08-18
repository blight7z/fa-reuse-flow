import type {
  Attachment,
  BuybackCase,
  CaseListResponse,
  CasesReportResponse,
  CaseStatus,
  DashboardSummary,
  ImportJob,
  Inspection,
  InspectionInput,
  TransitionInput,
  User,
} from "@/lib/types";

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors?: Record<string, string | string[]>;

  constructor(message: string, status: number, code?: string, fieldErrors?: Record<string, string | string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

function unwrap<T>(payload: T | { data: T }): T {
  if (payload && typeof payload === "object" && "data" in payload) return (payload as { data: T }).data;
  return payload as T;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(isForm ? {} : init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    const outer = payload as { detail?: unknown; message?: string } | undefined;
    const detail = (outer?.detail ?? payload) as
      | { code?: string; message?: string; field_errors?: Record<string, string | string[]> }
      | string
      | undefined;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message || outer?.message || `ไม่สามารถทำรายการได้ (${response.status})`;
    throw new ApiError(
      message,
      response.status,
      typeof detail === "object" ? detail.code : undefined,
      typeof detail === "object" ? detail.field_errors : undefined,
    );
  }

  if (response.status === 204) return undefined as T;
  return unwrap<T>((await response.json()) as T | { data: T });
}

export const api = {
  async login(username: string, password: string): Promise<User> {
    const result = await request<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    return result.user;
  },
  async logout(): Promise<void> {
    await request<void>("/auth/logout", { method: "POST" });
  },
  async me(): Promise<User> {
    const result = await request<{ user: User }>("/auth/me");
    return result.user;
  },
  cases(params: { status?: CaseStatus | ""; page?: number; pageSize?: number } = {}): Promise<CaseListResponse> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    query.set("page", String(params.page ?? 1));
    query.set("page_size", String(params.pageSize ?? 20));
    return request<CaseListResponse>(`/cases?${query}`);
  },
  caseDetail(id: string | number): Promise<BuybackCase> {
    return request<BuybackCase>(`/cases/${id}`);
  },
  transition(id: string | number, input: TransitionInput): Promise<BuybackCase> {
    return request<BuybackCase>(`/cases/${id}/transition`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  inspection(id: string | number, input: InspectionInput): Promise<Inspection> {
    return request<Inspection>(`/cases/${id}/inspections`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  attachments(id: string | number): Promise<Attachment[]> {
    return request<Attachment[]>(`/cases/${id}/attachments`);
  },
  uploadAttachment(id: string | number, file: File): Promise<Attachment> {
    const body = new FormData();
    body.append("file", file);
    return request<Attachment>(`/cases/${id}/attachments`, { method: "POST", body });
  },
  dashboard(): Promise<DashboardSummary> {
    return request<DashboardSummary>("/dashboard/summary");
  },
  uploadImport(file: File): Promise<ImportJob> {
    const body = new FormData();
    body.append("file", file);
    return request<ImportJob>("/imports", { method: "POST", body });
  },
  importJob(id: string | number): Promise<ImportJob> {
    return request<ImportJob>(`/imports/${id}`);
  },
  commitImport(id: string | number, sellerName: string, sellerContact?: string): Promise<{ job: ImportJob; case: BuybackCase }> {
    return request<{ job: ImportJob; case: BuybackCase }>(`/imports/${id}/commit`, {
      method: "POST",
      body: JSON.stringify({ seller_name: sellerName, seller_contact: sellerContact || undefined }),
    });
  },
  reportCases(): Promise<CasesReportResponse> {
    return request<CasesReportResponse>("/reports/cases");
  },
  csvUrl: `${API_BASE}/reports/cases.csv`,
};

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
    if (error.status === 403) return "บทบาทของคุณไม่มีสิทธิ์ทำรายการนี้";
    if (error.status === 409) return error.message || "ข้อมูลมีการเปลี่ยนแปลง กรุณาโหลดใหม่";
    return error.message;
  }
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่คาดคิด";
}
