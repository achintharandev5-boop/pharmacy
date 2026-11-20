'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Hide on narrow screens (below md). */
  hideOnMobile?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Accessible description of the table. */
  caption: string;
  /** Makes each row a link to this URL. */
  rowHref?: (row: T) => string | null;
  /** Rows per page; paginates on the client when there are more rows. */
  pageSize?: number;
  className?: string;
}

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

export function DataTable<T>({ columns, rows, rowKey, caption, rowHref, pageSize = 25, className }: DataTableProps<T>) {
  const router = useRouter();
  const [requestedPage, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  // Stay in range when the rows shrink (for example after filtering).
  const page = Math.min(requestedPage, pageCount);

  const visible = rows.length > pageSize ? rows.slice((page - 1) * pageSize, page * pageSize) : rows;

  return (
    <div className={className}>
      <div className="overflow-x-auto" role="region" aria-label={`${caption} table`} tabIndex={0}>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border bg-surface">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 text-xs font-semibold text-subtle whitespace-nowrap',
                    ALIGN[c.align ?? 'left'],
                    c.hideOnMobile && 'hidden md:table-cell',
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const href = rowHref?.(row) ?? null;
              return (
                <tr
                  key={rowKey(row)}
                  onClick={href ? () => router.push(href) : undefined}
                  className={cn('border-b border-border last:border-b-0', href && 'cursor-pointer hover:bg-[var(--color-row-hover)]')}
                >
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={cn(
                        'px-4 py-3 align-middle text-fg',
                        ALIGN[c.align ?? 'left'],
                        c.hideOnMobile && 'hidden md:table-cell',
                        c.className,
                      )}
                    >
                      {/* The first cell carries a real link so rows are keyboard-reachable. */}
                      {i === 0 && href ? (
                        <a
                          href={href}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push(href);
                          }}
                          className="font-medium text-fg hover:text-primary hover:underline underline-offset-2"
                        >
                          {c.cell(row)}
                        </a>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && <Pagination page={page} pageCount={pageCount} total={rows.length} pageSize={pageSize} onChange={setPage} />}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-subtle">
      <span className="tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <span className="tabular text-xs">
          Page {page} of {pageCount}
        </span>
        <Button size="sm" iconRight={ChevronRight} disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  );
}
