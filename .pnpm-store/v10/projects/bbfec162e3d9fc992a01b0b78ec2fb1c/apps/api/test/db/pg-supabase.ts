/**
 * TEST ONLY. A stand-in for the subset of the Supabase client the API uses, executed against
 * a real local PostgreSQL database that has every migration applied.
 *
 * Every query runs inside its own transaction as `service_role` (the role the API's secret key
 * maps to on Supabase), so grants, RLS, constraints, triggers and the database functions
 * behave as they would behind PostgREST. Errors carry the same fields PostgREST returns
 * (code, message, hint, details).
 *
 * Supported: select (columns, embedded relations resolved through foreign keys, `count`
 * aggregates, count/head), insert, update, delete, eq/neq/in/gt/gte/lt/lte/ilike/is/or,
 * order, limit, single, maybeSingle, rpc. Supabase Auth is not part of this: tests supply
 * their own `auth` object.
 *
 * Never import this from application code. It refuses non-local database hosts.
 */
import { Pool, types } from 'pg';

// Match PostgREST's JSON output: numbers as numbers, dates as strings, timestamps as ISO strings.
types.setTypeParser(1700, (v) => Number(v)); // numeric
types.setTypeParser(20, (v) => Number(v)); // int8
types.setTypeParser(1082, (v) => v); // date
types.setTypeParser(1114, (v) => new Date(v + 'Z').toISOString()); // timestamp
types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz

type Row = Record<string, any>;
type DbError = { code?: string; message: string; hint?: string | null; details?: string | null };
type Result = { data: any; error: DbError | null; count?: number | null };
type Fk = { child: string; parent: string; column: string };

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unsupported identifier in test adapter: ${name}`);
  return `"${name}"`;
};

export function assertLocal(url: string) {
  const host = new URL(url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(`Refusing to run database tests against non-local host '${host}'.`);
  }
}

export class PgSupabase {
  private fks: Fk[] | null = null;

  constructor(readonly pool: Pool) {}

  async foreignKeys(): Promise<Fk[]> {
    if (!this.fks) {
      const { rows } = await this.pool.query(`
        SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent, a.attname AS column
        FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace AND array_length(c.conkey, 1) = 1`);
      this.fks = rows as Fk[];
    }
    return this.fks;
  }

  /** Runs one statement as service_role in its own transaction. */
  async run(sql: string, params: unknown[]): Promise<{ rows: Row[]; error: DbError | null }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE service_role');
      const res = await client.query(sql, params);
      await client.query('COMMIT');
      return { rows: res.rows, error: null };
    } catch (e: any) {
      await client.query('ROLLBACK').catch(() => undefined);
      return { rows: [], error: { code: e.code, message: e.message, hint: e.hint ?? null, details: e.detail ?? null } };
    } finally {
      client.release();
    }
  }

  client(auth: unknown) {
    return {
      auth,
      from: (table: string) => new PgQuery(this, table),
      rpc: async (fn: string, args: Record<string, unknown>): Promise<Result> => {
        const names = Object.keys(args);
        const sql = `SELECT ${ident(fn)}(${names.map((n, i) => `${ident(n)} => $${i + 1}`).join(', ')}) AS result`;
        const { rows, error } = await this.run(sql, names.map((n) => toParam(args[n])));
        return error ? { data: null, error } : { data: rows[0]?.result ?? null, error: null };
      },
    };
  }
}

function toParam(v: unknown) {
  // pg would send JS arrays as Postgres arrays; jsonb columns need JSON text.
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}

/** Splits a select list on top-level commas. */
function splitTop(spec: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of spec) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

class PgQuery implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private columns = '*';
  private payload: Row | Row[] | null = null;
  private where: { sql: (p: () => string) => string; values: unknown[] }[] = [];
  private orders: string[] = [];
  private limitN: number | null = null;
  private returning = false;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private countMode = false;
  private head = false;

  constructor(
    private readonly db: PgSupabase,
    private readonly table: string,
  ) {}

  select(columns = '*', opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.columns = columns;
      this.countMode = Boolean(opts?.count);
      this.head = Boolean(opts?.head);
    } else {
      this.returning = true;
      this.columns = columns;
    }
    return this;
  }
  insert(rows: Row | Row[]) {
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

  private cond(col: string, op: string, value: unknown) {
    this.where.push({ sql: (p) => `${ident(col)} ${op} ${p()}`, values: [value] });
    return this;
  }
  eq(c: string, v: unknown) {
    return this.cond(c, '=', v);
  }
  neq(c: string, v: unknown) {
    return this.cond(c, '<>', v);
  }
  gt(c: string, v: unknown) {
    return this.cond(c, '>', v);
  }
  gte(c: string, v: unknown) {
    return this.cond(c, '>=', v);
  }
  lt(c: string, v: unknown) {
    return this.cond(c, '<', v);
  }
  lte(c: string, v: unknown) {
    return this.cond(c, '<=', v);
  }
  ilike(c: string, v: string) {
    return this.cond(c, 'ILIKE', v);
  }
  in(c: string, values: unknown[]) {
    this.where.push({ sql: (p) => `${ident(c)} = ANY(${p()})`, values: [values] });
    return this;
  }
  is(c: string, v: null | boolean) {
    this.where.push({ sql: () => `${ident(c)} IS ${v === null ? 'NULL' : v ? 'TRUE' : 'FALSE'}`, values: [] });
    return this;
  }
  /** PostgREST `or` syntax limited to `col.op.value` terms with eq/ilike. */
  or(expr: string) {
    const terms = expr.split(',').map((t) => {
      const [col, op, ...rest] = t.split('.');
      const value = rest.join('.');
      if (op !== 'ilike' && op !== 'eq') throw new Error(`Unsupported or() operator in test adapter: ${op}`);
      return { col, op: op === 'ilike' ? 'ILIKE' : '=', value };
    });
    this.where.push({
      sql: (p) => `(${terms.map((t) => `${ident(t.col)}::text ${t.op} ${p()}`).join(' OR ')})`,
      values: terms.map((t) => t.value),
    });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    const asc = opts?.ascending !== false;
    const nulls = opts?.nullsFirst === undefined ? '' : opts.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST';
    this.orders.push(`${ident(col)} ${asc ? 'ASC' : 'DESC'}${nulls}`);
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

  then<A = Result, B = never>(ok?: ((v: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return this.execute().then(ok, fail);
  }

  private whereSql(params: unknown[]) {
    if (this.where.length === 0) return '';
    const parts = this.where.map((w) => {
      let i = 0;
      return w.sql(() => {
        params.push(w.values[i++]);
        return `$${params.length}`;
      });
    });
    return ` WHERE ${parts.join(' AND ')}`;
  }

  /** Builds the select list for `table` aliased as `alias`, resolving embedded relations. */
  private async selectList(table: string, alias: string, spec: string): Promise<string> {
    const fks = await this.db.foreignKeys();
    const out: string[] = [];
    for (const part of splitTop(spec)) {
      const m = /^([a-z_]+)\((.*)\)$/s.exec(part);
      if (!m) {
        out.push(part === '*' ? `${alias}.*` : `${alias}.${ident(part)}`);
        continue;
      }
      const [, rel, inner] = m;
      const sub = `${alias}_${rel}`;
      const toOne = fks.find((f) => f.child === table && f.parent === rel);
      const toMany = fks.find((f) => f.child === rel && f.parent === table);
      if (toOne) {
        const cols = await this.selectList(rel, sub, inner);
        out.push(
          `(SELECT row_to_json(x) FROM (SELECT ${cols} FROM ${ident(rel)} ${sub} WHERE ${sub}."id" = ${alias}.${ident(toOne.column)}) x) AS ${ident(rel)}`,
        );
      } else if (toMany) {
        if (inner.trim() === 'count') {
          out.push(
            `json_build_array(json_build_object('count', (SELECT count(*) FROM ${ident(rel)} ${sub} WHERE ${sub}.${ident(toMany.column)} = ${alias}."id"))) AS ${ident(rel)}`,
          );
        } else {
          const cols = await this.selectList(rel, sub, inner);
          out.push(
            `coalesce((SELECT json_agg(x) FROM (SELECT ${cols} FROM ${ident(rel)} ${sub} WHERE ${sub}.${ident(toMany.column)} = ${alias}."id") x), '[]'::json) AS ${ident(rel)}`,
          );
        }
      } else {
        throw new Error(`Test adapter: no foreign key between ${table} and ${rel}`);
      }
    }
    return out.join(', ');
  }

  private async execute(): Promise<Result> {
    const t = ident(this.table);
    const params: unknown[] = [];
    let sql: string;

    if (this.op === 'select') {
      const where = this.whereSql(params);
      let count: number | null = null;
      if (this.countMode) {
        const c = await this.db.run(`SELECT count(*)::int AS n FROM ${t} b${where}`, params);
        if (c.error) return { data: null, error: c.error, count: null };
        count = c.rows[0].n;
        if (this.head) return { data: null, error: null, count };
      }
      const cols = await this.selectList(this.table, 'b', this.columns);
      sql = `SELECT ${cols} FROM ${t} b${where}`;
      if (this.orders.length) sql += ` ORDER BY ${this.orders.map((o) => `b.${o}`).join(', ')}`;
      if (this.limitN !== null) sql += ` LIMIT ${Number(this.limitN)}`;
      const res = await this.db.run(sql, params);
      return this.shape(res, count);
    }

    if (this.op === 'insert') {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload!];
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const values = rows.map(
        (r) =>
          `(${cols
            .map((c) => {
              if (!(c in r) || r[c] === undefined) return 'DEFAULT';
              params.push(toParam(r[c]));
              return `$${params.length}`;
            })
            .join(', ')})`,
      );
      sql = `INSERT INTO ${t} AS b (${cols.map(ident).join(', ')}) VALUES ${values.join(', ')} RETURNING *`;
    } else if (this.op === 'update') {
      const sets = Object.entries(this.payload as Row)
        .filter(([, v]) => v !== undefined)
        .map(([c, v]) => {
          params.push(toParam(v));
          return `${ident(c)} = $${params.length}`;
        });
      sql = `UPDATE ${t} AS b SET ${sets.join(', ')}${this.whereSql(params)} RETURNING *`;
    } else {
      sql = `DELETE FROM ${t} AS b${this.whereSql(params)} RETURNING *`;
    }

    const res = await this.db.run(sql, params);
    if (res.error || !this.returning) return { data: res.error ? null : null, error: res.error };
    if (this.columns !== '*' && this.columns.trim() !== '') {
      const keep = splitTop(this.columns);
      if (!keep.includes('*')) res.rows = res.rows.map((r) => Object.fromEntries(keep.map((k) => [k, r[k]])));
    }
    return this.shape(res, null);
  }

  private shape(res: { rows: Row[]; error: DbError | null }, count: number | null): Result {
    if (res.error) return { data: null, error: res.error, count };
    if (this.mode === 'many') return { data: res.rows, error: null, count };
    if (res.rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' }, count };
    if (res.rows.length === 0) {
      return this.mode === 'maybe'
        ? { data: null, error: null, count }
        : { data: null, error: { code: 'PGRST116', message: 'no rows returned' }, count };
    }
    return { data: res.rows[0], error: null, count };
  }
}
