// En dev, le proxy Vite redirige /api vers le port 3001
// En prod (Railway), front + API sont servis par le même process → /api fonctionne aussi
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('reform_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('reform_token');
    localStorage.removeItem('reform_user');
    if (!path.includes('/auth/')) window.location.href = '/login';
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: any) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: any) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: async <T>(path: string, file: File): Promise<T> => {
    const token = getToken();
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      body: fd,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'upload_failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
};

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'member';
}

export interface Organization {
  id: string;
  name: string;
  status: 'prospect' | 'client' | 'inactive';
  siren?: string | null;
  spk?: boolean;
  spkPulse?: boolean;
  industry?: string | null;
  size?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  zipcode?: string | null;
  country?: string | null;
  notes?: string | null;
  ownerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  notes?: string | null;
}

export type DealStage = 'to_qualify' | 'contacted' | 'meeting' | 'proposal' | 'negotiation' | 'won' | 'lost';

export const OFFER_TYPES = ['Appui conseil', 'Formation', 'Bilan carbone', 'Activation', 'Certification', 'Diagnostic'] as const;
export type OfferType = typeof OFFER_TYPES[number];

export interface Deal {
  id: string;
  organizationId: string;
  title: string;
  stage: DealStage;
  offerType?: OfferType | string | null;
  amount?: number | null;
  probability?: number | null;
  expectedCloseAt?: string | null;
  serviceStartAt?: string | null;
  serviceEndAt?: string | null;
  invoiceDate1?: string | null;
  invoiceAmount1?: number | null;
  invoiceDate2?: string | null;
  invoiceAmount2?: number | null;
  invoiceDate3?: string | null;
  invoiceAmount3?: number | null;
  closedAt?: string | null;
  lostReason?: string | null;
  ownerId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  organizationId: string;
  dealId?: string | null;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task';
  subject: string;
  body?: string | null;
  occurredAt: string;
  done: boolean;
  authorId?: string | null;
}

export type InvoiceStatus = 'to_invoice' | 'invoiced' | 'partially_paid' | 'paid';

export interface Engagement {
  id: string;
  organizationId: string;
  dealId?: string | null;
  title: string;
  description?: string | null;
  offerType?: OfferType | string | null;
  spk?: boolean;
  spkPulse?: boolean;
  totalAmount: number;
  paidAmount: number;
  status: 'active' | 'completed' | 'cancelled';
  invoiceStatus: InvoiceStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  invoicedAt?: string | null;
  invoicedAmount?: number | null;
  invoiceRef?: string | null;
  invoiceDate1?: string | null;
  invoiceAmount1?: number | null;
  invoiceDate2?: string | null;
  invoiceAmount2?: number | null;
  invoiceDate3?: string | null;
  invoiceAmount3?: number | null;
}

export type MilestoneStatus = 'to_invoice' | 'invoiced' | 'paid' | 'overdue';

export interface Milestone {
  id: string;
  engagementId: string;
  label: string;
  amount: number;
  dueDate?: string | null;
  invoicedAt?: string | null;
  invoiceRef?: string | null;
  status: MilestoneStatus;
  notes?: string | null;
}

export interface Payment {
  id: string;
  milestoneId: string;
  amount: number;
  receivedAt: string;
  method?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface OrgDetail extends Organization {
  contacts: Contact[];
  deals: Deal[];
  activities: Activity[];
  engagements: Engagement[];
}

export interface EngagementDetail extends Engagement {
  milestones: Milestone[];
  payments: Payment[];
}
