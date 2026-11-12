// Daily cap on Claude calls, so the public demo cannot run up the API bill while it stays
// open for judging. Counted in Postgres when available (survives Render restarts),
// otherwise in memory. Server-only.
import { once, sql } from "./db";

const MAX_PER_DAY = Number(process.env.MAX_CLAUDE_CALLS_PER_DAY ?? 400);
// Per visitor (IP), so one person cannot use up the whole day's checks for everyone else.
const MAX_PER_IP_PER_DAY = Number(process.env.MAX_CLAUDE_CALLS_PER_IP ?? 60);

export class BudgetError extends Error {
  status = 429;
  constructor(message = "The LiveProof demo reached its daily limit of AI checks. Please try again tomorrow (UTC).") {
    super(message);
  }
}

// The visitor's IP as Render's proxy reports it.
export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

const initTable = once(() => sql!`create table if not exists claude_usage (day date primary key, calls int not null default 0)`);

const g = globalThis as typeof globalThis & { __liveproofUsage?: Map<string, number> };
const memory: Map<string, number> = (g.__liveproofUsage ??= new Map());

// Counts one Claude call for today (UTC) and throws BudgetError once a cap is passed.
export async function spendClaudeCall(ip: string) {
  const day = new Date().toISOString().slice(0, 10);
  const ipKey = `${day}|${ip}`;
  for (const key of memory.keys()) if (!key.startsWith(day)) memory.delete(key); // forget past days
  const ipCalls = (memory.get(ipKey) ?? 0) + 1;
  memory.set(ipKey, ipCalls);
  if (ipCalls > MAX_PER_IP_PER_DAY) {
    throw new BudgetError("You reached today's limit of AI checks on this demo. Please try again tomorrow (UTC).");
  }
  let calls: number;
  if (sql) {
    await initTable();
    const rows = await sql`insert into claude_usage (day, calls) values (${day}, 1)
      on conflict (day) do update set calls = claude_usage.calls + 1 returning calls`;
    calls = Number(rows[0]?.calls ?? 0);
  } else {
    calls = (memory.get(day) ?? 0) + 1;
    memory.set(day, calls);
  }
  if (calls > MAX_PER_DAY) throw new BudgetError();
}
