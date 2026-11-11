import { exportAuthorized, listAttempts } from "@/lib/attempts";

// Lists the captured eval attempts (see lib/attempts.ts). Token-protected; without
// EVAL_EXPORT_TOKEN this route answers 404 like any unknown path.
export async function GET(request: Request) {
  if (!exportAuthorized(request)) return new Response("Not found", { status: 404 });
  return Response.json({ attempts: await listAttempts() });
}
