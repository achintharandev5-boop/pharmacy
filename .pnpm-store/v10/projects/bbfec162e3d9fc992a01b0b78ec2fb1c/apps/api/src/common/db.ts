import {
  BadRequestException,
  ConflictException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

const logger = new Logger('Database');

export interface DbError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/** Error codes meaning the database schema is older than the code expects (a migration is missing). */
const SCHEMA_CODES = new Set(['42P01', '42703', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205']);

const CONFLICT_HINTS = new Set(['INSUFFICIENT_STOCK', 'DUPLICATE', 'REQUEST_IN_PROGRESS', 'STOCK_CHANGED']);

/**
 * Converts a Supabase/PostgREST error into an HTTP exception.
 *
 * Only the error code and the operation name are logged: Postgres messages and details can
 * contain row values (names, phone numbers), so they never reach the logs.
 */
export function toHttpError(error: DbError, operation: string): HttpException {
  const code = error.code || 'NETWORK';
  logger.error(`${operation} failed (${code})`);

  if (code === 'P0001') {
    // Raised on purpose by this project's database functions (RAISE ... USING HINT = '<CODE>').
    // Their messages are written by us and contain no row values beyond names and quantities.
    const appCode = error.hint || 'REJECTED';
    const body = { code: appCode, message: error.message || `Could not ${operation}.` };
    if (appCode === 'NOT_FOUND') return new NotFoundException(body);
    if (CONFLICT_HINTS.has(appCode)) return new ConflictException(body);
    return new BadRequestException(body);
  }
  if (code === 'PGRST116') {
    return new NotFoundException({ code: 'NOT_FOUND', message: 'The requested record was not found.' });
  }
  if (code === '23505') {
    return new ConflictException({ code: 'DUPLICATE', message: `Could not ${operation}: a matching record already exists.` });
  }
  if (code === '23503') {
    return new BadRequestException({
      code: 'INVALID_REFERENCE',
      message: `Could not ${operation}: it refers to a record that does not exist.`,
    });
  }
  if (code === '23514' || code === '22P02' || code === '22007' || code === '22008') {
    return new BadRequestException({
      code: 'INVALID_VALUE',
      message: `Could not ${operation}: a value was rejected by the database.`,
    });
  }
  if (SCHEMA_CODES.has(code)) {
    return new ServiceUnavailableException({
      code: 'SCHEMA_OUT_OF_DATE',
      message: `Could not ${operation}: the database schema is out of date. A pending database migration must be applied.`,
    });
  }
  return new ServiceUnavailableException({
    code: 'DATABASE_UNAVAILABLE',
    message: `Could not ${operation}: the database did not respond. No changes were confirmed. Please try again.`,
  });
}

interface DbResult<T> {
  data: T | null;
  error: DbError | null;
}

/** Throws if a Supabase result carries an error, otherwise returns its data (which may be null). */
export function unwrap<T>(result: DbResult<T>, operation: string): T | null {
  if (result.error) throw toHttpError(result.error, operation);
  return result.data;
}

/** Like unwrap, but a missing row is also an error. */
export function unwrapRequired<T>(result: DbResult<T>, operation: string): T {
  const data = unwrap(result, operation);
  if (data === null || data === undefined) {
    throw new NotFoundException({ code: 'NOT_FOUND', message: 'The requested record was not found.' });
  }
  return data;
}

/** For list queries: an error is thrown, never turned into an empty list. */
export function unwrapList<T>(result: DbResult<T[]>, operation: string): T[] {
  const data = unwrap(result, operation);
  return Array.isArray(data) ? data : [];
}

/** Escapes a user-supplied term for use inside a PostgREST `ilike` / `or()` filter. */
export function likeTerm(term: string): string {
  // Strip characters that have meaning in PostgREST filter syntax, then escape LIKE wildcards.
  return term
    .replace(/[,()"\\]/g, ' ')
    .replace(/[%_]/g, (c) => `\\${c}`)
    .trim();
}
