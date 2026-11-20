import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { unwrap, unwrapList } from '../common/db';
import { addDays, startOfZonedDay } from '../common/time';
import {
  AUDIT_EVENT_ID,
  AUDITED_ENTITIES,
  DEFAULT_AUDIT_PAGE_SIZE,
  MAX_AUDIT_PAGE_SIZE,
  RECORD_REFERENCE,
  type ListAuditLogQueryDto,
} from './dto/list-audit-log.dto';

/**
 * The only columns ever read. The table holds no values today; naming the columns means a column
 * added later (for example old/new values) is not exposed until it has been reviewed.
 */
const COLUMNS =
  'id, occurred_at, actor_id, action, entity_type, entity_id, changed_fields';

/** A column name as the triggers write it. Anything else is withheld rather than shown. */
const FIELD_NAME = /^[a-z][a-z0-9_]{0,62}$/;

interface AuditRow {
  id: number | string;
  occurred_at: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changed_fields: string[] | null;
}

export interface AuditEvent {
  id: string;
  occurred_at: string;
  action: string;
  entity_type: string;
  /** Human name of the module; null for a table this version does not know. */
  module: string | null;
  entity_id: string | null;
  /** Column names only. The audit log never records values. Null for inserts and deletes. */
  changed_fields: string[] | null;
  /** Entries withheld because they did not look like a column name. */
  withheld_fields: number;
  /** Null when the change was recorded without a user. */
  actor: { id: string; name: string | null } | null;
}

export interface AuditPage {
  items: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Read-only access to `audit_log`. There is deliberately no write path: this service never
 * inserts, updates or deletes audit rows.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditLog');
  private readonly timeZone: string;

  constructor(
    private readonly supabase: SupabaseService,
    config: ConfigService,
  ) {
    this.timeZone = config.get<string>('PHARMACY_TIMEZONE') ?? 'Asia/Colombo';
  }

  private get db() {
    return this.supabase.getClient();
  }

  /** One page of events, newest first; ties on time are broken by id so pages never overlap. */
  async list(query: ListAuditLogQueryDto = {}): Promise<AuditPage> {
    const page = query.page ?? 1;
    const pageSize = Math.min(
      query.pageSize ?? DEFAULT_AUDIT_PAGE_SIZE,
      MAX_AUDIT_PAGE_SIZE,
    );
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException({
        code: 'INVALID_RANGE',
        message: 'The start date must be on or before the end date.',
      });

    // The same filters are applied to the count and to the page.
    const filtered = (columns: string, count = false) => {
      let q = this.db
        .from('audit_log')
        .select(columns, count ? { count: 'exact', head: true } : undefined);
      if (query.from)
        q = q.gte(
          'occurred_at',
          startOfZonedDay(this.timeZone, query.from).toISOString(),
        );
      if (query.to)
        q = q.lt(
          'occurred_at',
          startOfZonedDay(this.timeZone, addDays(query.to, 1)).toISOString(),
        );
      if (query.action) q = q.eq('action', query.action);
      if (query.entity) q = q.eq('entity_type', query.entity);
      if (query.actor?.toLowerCase() === 'none') q = q.is('actor_id', null);
      else if (query.actor) q = q.eq('actor_id', query.actor.toLowerCase());
      if (query.record) q = q.eq('entity_id', query.record);
      return q;
    };

    const [countRes, rowsRes] = await Promise.all([
      filtered('id', true),
      filtered(COLUMNS)
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1),
    ]);
    unwrap(countRes, 'count audit events');
    const rows = unwrapList(
      rowsRes as unknown as { data: AuditRow[] | null; error: null },
      'load the audit log',
    );
    const items = await this.present(rows);
    return { items, total: countRes.count ?? items.length, page, pageSize };
  }

  async get(id: string): Promise<AuditEvent> {
    if (!AUDIT_EVENT_ID.test(id))
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'The audit event id must be a positive whole number.',
      });
    const row = unwrap<AuditRow>(
      await this.db
        .from('audit_log')
        .select(COLUMNS)
        .eq('id', Number(id))
        .maybeSingle(),
      'load the audit event',
    );
    if (!row)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'The audit event was not found.',
      });
    const [event] = await this.present([row]);
    return event;
  }

  /** Builds the response from known columns only and adds user names where a profile exists. */
  private async present(rows: AuditRow[]): Promise<AuditEvent[]> {
    const names = await this.actorNames([
      ...new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v)),
    ]);
    return rows.map((r) => {
      const fields = Array.isArray(r.changed_fields) ? r.changed_fields : null;
      const shown = fields?.filter(
        (f) => typeof f === 'string' && FIELD_NAME.test(f),
      );
      return {
        id: String(r.id),
        occurred_at: r.occurred_at,
        action: r.action,
        entity_type: r.entity_type,
        module:
          (AUDITED_ENTITIES as Record<string, string>)[r.entity_type] ?? null,
        entity_id:
          r.entity_id && RECORD_REFERENCE.test(r.entity_id)
            ? r.entity_id
            : null,
        changed_fields: shown ?? null,
        withheld_fields: (fields?.length ?? 0) - (shown?.length ?? 0),
        actor: r.actor_id
          ? { id: r.actor_id, name: names.get(r.actor_id) ?? null }
          : null,
      };
    });
  }

  /**
   * Display names from `user_profiles`. Names are a convenience: if the lookup fails the events
   * are still returned, identified by user id.
   */
  private async actorNames(ids: string[]): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (ids.length === 0) return names;
    const res = await this.db
      .from('user_profiles')
      .select('id, full_name')
      .in('id', ids);
    if (res.error) {
      this.logger.warn(
        `user names for the audit log could not be loaded (${res.error.code ?? 'NETWORK'})`,
      );
      return names;
    }
    for (const p of (res.data ?? []) as {
      id: string;
      full_name: string | null;
    }[])
      if (p.full_name) names.set(p.id, p.full_name);
    return names;
  }
}
