/**
 * Test-only, in-memory stand-in for the subset of the Supabase query builder the services use.
 * Never import this from application code.
 *
 * Supports: select (incl. count/head), insert, update, delete, eq/neq/in/gt/gte/lt/lte/ilike/is,
 * order, limit, maybeSingle, single, rpc. Embedded relations in select() are not resolved.
 * Unique constraints and error injection make failure paths testable.
 */
import { randomUUID } from 'crypto';

type Row = Record<string, any>;
type Op = 'select' | 'insert' | 'update' | 'delete';
type DbError = { code?: string; message: string };

interface FailRule {
  table: string;
  op: Op;
  error: DbError;
  /** Fail only the nth matching call (1-based); otherwise every call. */
  nth?: number;
  seen: number;
}

export class FakeSupabase {
  tables: Record<string, Row[]> = {};
  unique: Record<string, string[][]> = {};
  calls: { table: string; op: Op }[] = [];
  rpcHandlers: Record<string, (args: any) => { data: any; error: DbError | null }> = {};
  private failures: FailRule[] = [];
  /** Called before an update is applied; lets a test simulate a concurrent writer. */
  beforeUpdate?: (table: string) => void;

  constructor(seed: Record<string, Row[]> = {}) {
    for (const [name, rows] of Object.entries(seed)) this.tables[name] = rows.map((r) => ({ ...r }));
  }

  table(name: string): Row[] {
    return (this.tables[name] ??= []);
  }

  fail(table: string, op: Op, error: DbError = { message: 'fetch failed' }, nth?: number) {
    this.failures.push({ table, op, error, nth, seen: 0 });
    return this;
  }

  injected(table: string, op: Op): DbError | null {
    for (const rule of this.failures) {
      if (rule.table !== table || rule.op !== op) continue;
      rule.seen++;
      if (rule.nth === undefined || rule.nth === rule.seen) return rule.error;
    }
    return null;
  }

  client() {
    return {
      from: (table: string) => new Query(this, table),
      rpc: async (fn: string, args: any) => {
        const handler = this.rpcHandlers[fn];
        if (!handler) return { data: null, error: { code: 'PGRST202', message: `function ${fn} not found` } };
        return handler(args);
      },
    };
  }
}

class Query implements PromiseLike<{ data: any; error: DbError | null; count?: number | null }> {
  private op: Op = 'select';
  private payload: Row[] | Row | null = null;
  private filters: ((r: Row) => boolean)[] = [];
  private orderBy: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private returning = false;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private countMode = false;
  private head = false;

  constructor(
    private readonly db: FakeSupabase,
    private readonly name: string,
  ) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.countMode = Boolean(opts?.count);
      this.head = Boolean(opts?.head);
    } else {
      this.returning = true;
    }
    return this;
  }
  insert(rows: Row[] | Row) {
    this.op = 'insert';
    this.payload = rows;
    return this;
  }
  update(values: Row) {
    this.op = 'update';
    this.payload = values;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col: string, v: any) {
    this.filters.push((r) => r[col] === v);
    return this;
  }
  neq(col: string, v: any) {
    this.filters.push((r) => r[col] !== v);
    return this;
  }
  in(col: string, vs: any[]) {
    this.filters.push((r) => vs.includes(r[col]));
    return this;
  }
  gt(col: string, v: any) {
    this.filters.push((r) => r[col] !== null && r[col] !== undefined && r[col] > v);
    return this;
  }
  gte(col: string, v: any) {
    this.filters.push((r) => r[col] !== null && r[col] !== undefined && r[col] >= v);
    return this;
  }
  lt(col: string, v: any) {
    this.filters.push((r) => r[col] !== null && r[col] !== undefined && r[col] < v);
    return this;
  }
  lte(col: string, v: any) {
    this.filters.push((r) => r[col] !== null && r[col] !== undefined && r[col] <= v);
    return this;
  }
  is(col: string, v: any) {
    this.filters.push((r) => (r[col] ?? null) === v);
    return this;
  }
  ilike(col: string, pattern: string) {
    const needle = pattern.replace(/^%|%$/g, '').replace(/\\([%_])/g, '$1').toLowerCase();
    this.filters.push((r) => String(r[col] ?? '').toLowerCase().includes(needle));
    return this;
  }
  /** Supports `a.ilike.%x%,b.ilike.%x%` only. */
  or(expr: string) {
    const clauses = expr.split(',').map((c) => {
      const [col, , ...rest] = c.split('.');
      const needle = rest.join('.').replace(/^%|%$/g, '').replace(/\\([%_])/g, '$1').toLowerCase();
      return (r: Row) => String(r[col] ?? '').toLowerCase().includes(needle);
    });
    this.filters.push((r) => clauses.some((f) => f(r)));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.mode = 'single';
    return this;
  }
  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }

  then<R1, R2>(
    onfulfilled?: (value: { data: any; error: DbError | null; count?: number | null }) => R1 | PromiseLike<R1>,
    onrejected?: (reason: any) => R2 | PromiseLike<R2>,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }

  private execute(): { data: any; error: DbError | null; count?: number | null } {
    this.db.calls.push({ table: this.name, op: this.op });
    const injected = this.db.injected(this.name, this.op);
    if (injected) return { data: null, error: injected };

    const rows = this.db.table(this.name);
    const match = (r: Row) => this.filters.every((f) => f(r));
    let result: Row[] = [];

    if (this.op === 'select') {
      result = rows.filter(match);
      for (const { col, asc } of [...this.orderBy].reverse()) {
        result.sort((a, b) => (a[col] === b[col] ? 0 : (a[col] ?? '') > (b[col] ?? '') ? 1 : -1) * (asc ? 1 : -1));
      }
      if (this.limitN !== null) result = result.slice(0, this.limitN);
      if (this.countMode && this.head) return { data: null, error: null, count: result.length };
    } else if (this.op === 'insert') {
      const incoming = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((r) => ({
        id: randomUUID(),
        created_at: new Date().toISOString(),
        ...r,
      }));
      for (const row of incoming) {
        for (const cols of this.db.unique[this.name] ?? []) {
          const clash = [...rows, ...incoming.filter((x) => x !== row)].some((existing) =>
            cols.every((c) => existing[c] === row[c]),
          );
          if (clash) return { data: null, error: { code: '23505', message: 'duplicate key' } };
        }
      }
      rows.push(...incoming);
      result = incoming;
      if (!this.returning) return { data: null, error: null };
    } else if (this.op === 'update') {
      this.db.beforeUpdate?.(this.name);
      result = rows.filter(match);
      for (const r of result) Object.assign(r, this.payload);
      if (!this.returning) return { data: null, error: null };
    } else {
      result = rows.filter(match);
      this.db.tables[this.name] = rows.filter((r) => !match(r));
      if (!this.returning) return { data: null, error: null };
    }

    const copies = result.map((r) => ({ ...r }));
    if (this.mode === 'single') {
      if (copies.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } };
      return { data: copies[0], error: null };
    }
    if (this.mode === 'maybe') {
      if (copies.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
      return { data: copies[0] ?? null, error: null };
    }
    return { data: copies, error: null };
  }
}
