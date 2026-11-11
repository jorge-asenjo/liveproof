import { exportAuthorized, getAttempt } from "@/lib/attempts";

// One captured eval attempt with its frames. Token-protected, like the list.
export async function GET(request: Request, ctx: RouteContext<"/api/eval/attempts/[id]">) {
  if (!exportAuthorized(request)) return new Response("Not found", { status: 404 });
  const { id } = await ctx.params;
  const attempt = await getAttempt(id);
  if (!attempt) return new Response("Not found", { status: 404 });
  return Response.json(attempt);
}
