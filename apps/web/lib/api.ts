export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getToken(): string | null {
  return accessToken;
}

export function setToken(token: string | null) {
  accessToken = token;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_BASE}/api/v1/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (response) => {
      if (!response.ok) return null;
      const body = await response.json() as { accessToken?: string };
      accessToken = body.accessToken ?? null;
      return accessToken;
    })
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let token = getToken();
  if (!token) token = await refreshAccessToken();
  if (!token) throw new ApiError('Sign in to view your procurement workspace.', 401);

  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (response.status === 401 && !path.startsWith('/auth/')) {
    token = await refreshAccessToken();
    if (token) return apiFetch<T>(path, init);
  }
  if (!response.ok) {
    throw new ApiError(body?.message ?? `Request failed (${response.status})`, response.status);
  }
  return body as T;
}

export function formatMoney(value: number | string | null | undefined, currency = 'BWP') {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-BW', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function statusTone(status: string): string {
  const upper = status?.toUpperCase() ?? '';
  if (['PAID', 'CLOSED', 'COMPLETED', 'APPROVED', 'DELIVERED', 'AWARDED', 'ACCEPTED'].includes(upper)) {
    return 'bg-emerald-100 text-emerald-800';
  }
  if (['REJECTED', 'CANCELLED', 'VOID', 'DISPUTED', 'EXPIRED', 'WITHDRAWN'].includes(upper)) {
    return 'bg-red-100 text-red-800';
  }
  if (['PARTIALLY_DELIVERED', 'PARTIALLY_PAID', 'UNDER_REVIEW', 'SUBMITTED', 'PENDING'].includes(upper)) {
    return 'bg-amber-100 text-amber-800';
  }
  return 'bg-slate-200 text-slate-800';
}
