import { connection } from "next/server";

// Health check. Also shows which commit is live (Render sets RENDER_GIT_COMMIT).
export async function GET() {
  await connection();
  return Response.json({ ok: true, commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? null });
}
