import { connection } from "next/server";

// Health check. Shows which commit is live (Render sets RENDER_GIT_COMMIT) and where
// buyer links are stored (postgres keeps them across Render restarts; memory does not).
export async function GET() {
  await connection();
  return Response.json({
    ok: true,
    commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null,
    storage: process.env.DATABASE_URL ? "postgres" : "memory",
  });
}
