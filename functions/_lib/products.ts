import type { Env } from "./types";

export interface Product {
  slug: string; name: string; tagline?: string; priceUsd: number; status: "available" | "coming-soon" | string;
  licensed?: boolean; maxActivations?: number; download?: string; version?: string; page?: string; access?: string;
}

/** Reads public/data/projects.json through the static asset binding, so prices can't be tampered with client-side. */
export async function loadProducts(env: Env, request: Request): Promise<Product[]> {
  const url = new URL("/data/projects.json", request.url);
  const res = await env.ASSETS.fetch(url.toString());
  if (!res.ok) throw new Error("projects.json unavailable");
  return (await res.json()) as Product[];
}

export async function findProduct(env: Env, request: Request, slug: string): Promise<Product | null> {
  const all = await loadProducts(env, request);
  return all.find(p => p.slug === slug) ?? null;
}
