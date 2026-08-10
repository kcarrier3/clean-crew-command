import { supabase } from '@/integrations/supabase/client';

const PAGE = 1000;

/**
 * Fetch every row from a table, paging past Supabase's 1000-row response cap.
 * Without this, tables with more than 1000 rows (e.g. accounts) silently
 * truncate and newly added records can look "missing" in search.
 */
export async function fetchAllRows<T = any>(
  table: string,
  select = '*',
  orderBy?: { column: string; ascending?: boolean; nullsFirst?: boolean },
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = (supabase as any).from(table).select(select);
    if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending ?? true, nullsFirst: orderBy.nullsFirst });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}
