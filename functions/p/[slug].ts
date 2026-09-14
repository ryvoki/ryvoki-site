import type { Ctx } from "../_lib/types";

/** /p/:slug -> serves the project detail page; the page reads the slug from the URL. */
export const onRequestGet = async ({ request, env }: Ctx<{ slug: string }>) => {
  const res = await env.ASSETS.fetch(new URL("/projects/view.html", request.url).toString());
  return new Response(res.body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
};
