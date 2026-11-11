// Daily cap on Claude calls, so the public demo cannot run up the API bill while it stays
// open for judging. Counted in Postgres when available (survives Render restarts),
// otherwise in memory. Server-only.
import { once, sql } from "./db";

const MAX_PER_DAY = Number(process.env.MAX_CLAUDE_CALLS_PER_DAY ?? 200);

export class BudgetError extends Error {
  status = 429;
  constructor() {
    super("The LiveProof demo reached its daily limit of AI checks. Please try again tomorrow (UTC).");
  }
}

const initTable = once(() => sql!`create table if not exists claude_usage (day date primary key, calls int not null default 0)`);

const g = globalThis as typeof globalThis & { __liveproofUsage?: Map<string, number> };
const memory: Map<string, number> = (g.__liveproofUsage ??= new Map());

// Counts one Claude call for today (UTC) and throws BudgetError once the cap is passed.
export async function spendClaudeCall() {
  const day = new Date().toISOString().slice(0, 10);
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
