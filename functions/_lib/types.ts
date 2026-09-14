// Minimal Cloudflare types so this project has zero runtime dependencies.
export interface D1Meta { changes?: number; last_row_id?: number; duration?: number }
export interface D1Result<T = unknown> { results: T[]; success: boolean; meta: D1Meta }
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}
export interface D1Database { prepare(query: string): D1PreparedStatement; batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> }
export interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface Env {
  DB: D1Database;
  BLOBS?: KVNamespace;
  ASSETS: { fetch(input: string | Request): Promise<Response> };
  SITE_URL?: string;
  PAYMENT_PROVIDER?: string;
  NOWPAYMENTS_API_BASE?: string;
  NOWPAYMENTS_API_KEY?: string;
  NOWPAYMENTS_IPN_SECRET?: string;
  ADMIN_TOKEN?: string;
  LICENSE_SIGNING_KEY?: string;
}

export interface Ctx<P extends Record<string, string> = Record<string, string>> {
  request: Request;
  env: Env;
  params: P;
  waitUntil(promise: Promise<unknown>): void;
}

export interface OrderRow {
  id: string; product: string; email: string | null; price_usd: number; status: string; provider: string;
  invoice_id: string | null; payment_id: string | null; pay_currency: string | null; actually_paid: number | null;
  license_id: number | null; created_at: string; paid_at: string | null;
}
export interface LicenseRow {
  id: number; key: string; product: string; order_id: string | null; status: string; max_activations: number; note: string | null; created_at: string;
}
