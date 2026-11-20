import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { likeTerm, toHttpError, unwrap, unwrapList, unwrapRequired } from './db';

describe('database error mapping', () => {
  it('maps a network failure to 503, never to an empty result', () => {
    expect(() => unwrapList({ data: null, error: { message: 'fetch failed' } }, 'load records')).toThrow(
      ServiceUnavailableException,
    );
  });

  it('maps constraint violations to client errors', () => {
    expect(toHttpError({ code: '23505' }, 'save')).toBeInstanceOf(ConflictException);
    expect(toHttpError({ code: '23503' }, 'save')).toBeInstanceOf(BadRequestException);
    expect(toHttpError({ code: '23514' }, 'save')).toBeInstanceOf(BadRequestException);
  });

  it('reports a missing column or function as an out-of-date schema', () => {
    const err = toHttpError({ code: 'PGRST204' }, 'save patient');
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect(err.getResponse()).toMatchObject({ code: 'SCHEMA_OUT_OF_DATE' });
  });

  it('passes through deliberate rejections from database functions', () => {
    const err = toHttpError({ code: 'P0001', hint: 'INSUFFICIENT_STOCK', message: 'Only 3 units available' }, 'adjust stock');
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toEqual({ code: 'INSUFFICIENT_STOCK', message: 'Only 3 units available' });
    expect(toHttpError({ code: 'P0001', hint: 'NOT_FOUND', message: 'x' }, 'op')).toBeInstanceOf(NotFoundException);
    expect(toHttpError({ code: 'P0001', hint: 'EXPIRED_BATCH', message: 'x' }, 'op')).toBeInstanceOf(BadRequestException);
  });

  it('treats a missing required row as not found', () => {
    expect(() => unwrapRequired({ data: null, error: null }, 'load')).toThrow(NotFoundException);
    expect(unwrap({ data: null, error: null }, 'load')).toBeNull();
  });

  it('neutralises PostgREST filter syntax in search terms', () => {
    expect(likeTerm('a,b(c)')).toBe('a b c');
    expect(likeTerm('50%_off')).toBe('50\\%\\_off');
  });
});
