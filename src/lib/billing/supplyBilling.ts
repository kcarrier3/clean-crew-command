/**
 * Turns resale supply drop-offs into Ready to Bill items.
 *
 * A movement is billable when the item is flagged `resale` and it was sold
 * (dropped off) at a customer account. Once it has been pushed into the
 * billing queue we stamp `billing_event_id` on the movement so the same
 * drop-off can never be queued — or billed — twice.
 */
import { supabase } from '@/integrations/supabase/client';
import { db } from '@/components/billing/billingApi';

export const SUPPLY_BILLING_SOURCE = 'supply_usage';

export interface SupplyUsageLine {
  id: string;
  date: string;
  itemName: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface SupplyUsageGroup {
  jobSiteId: string;
  jobSiteName: string;
  customerName: string | null;
  crmCompanyId: string | null;
  crmDealId: string | null;
  crmLeadId: string | null;
  billingEmail: string | null;
  lines: SupplyUsageLine[];
  totalQty: number;
  totalAmount: number;
  /** Most recent drop-off in the group — used as the "completed" date. */
  latestAt: string;
  earliestAt: string;
}

interface SiteRow {
  id: string; name: string; client_name: string | null; billing_email: string | null;
  crm_company_id: string | null; crm_deal_id: string | null; crm_lead_id: string | null;
}

/** Resale drop-offs that have not yet been pushed into the billing queue. */
export const fetchUnbilledSupplyUsage = async (): Promise<SupplyUsageGroup[]> => {
  const { data: moves, error } = await db
    .from('supply_movements')
    .select('id, job_site_id, quantity, unit_price, total_value, created_at, movement_type, item:supply_items(id, name, unit, sale_price, kind)')
    .eq('movement_type', 'sell')
    .is('billing_event_id', null)
    .not('job_site_id', 'is', null)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = (moves ?? []).filter((m: any) => m.item?.kind === 'resale');
  if (!rows.length) return [];

  const siteIds = [...new Set(rows.map((m: any) => m.job_site_id))] as string[];
  const { data: sites } = await db
    .from('job_sites')
    .select('id, name, client_name, billing_email, crm_company_id, crm_deal_id, crm_lead_id')
    .in('id', siteIds);
  const siteById = new Map<string, SiteRow>((sites ?? []).map((s: SiteRow) => [s.id, s]));

  const groups = new Map<string, SupplyUsageGroup>();
  for (const m of rows as any[]) {
    const site = siteById.get(m.job_site_id);
    if (!site) continue;
    const qty = Number(m.quantity || 0);
    const unitPrice = m.unit_price != null ? Number(m.unit_price) : Number(m.item.sale_price ?? 0);
    const total = m.total_value != null ? Number(m.total_value) : unitPrice * qty;

    let g = groups.get(site.id);
    if (!g) {
      g = {
        jobSiteId: site.id,
        jobSiteName: site.name,
        customerName: site.client_name ?? site.name,
        crmCompanyId: site.crm_company_id,
        crmDealId: site.crm_deal_id,
        crmLeadId: site.crm_lead_id,
        billingEmail: site.billing_email,
        lines: [], totalQty: 0, totalAmount: 0,
        latestAt: m.created_at, earliestAt: m.created_at,
      };
      groups.set(site.id, g);
    }
    g.lines.push({
      id: m.id, date: m.created_at, itemName: m.item.name, qty,
      unit: m.item.unit, unitPrice, total,
    });
    g.totalQty += qty;
    g.totalAmount += total;
    if (m.created_at > g.latestAt) g.latestAt = m.created_at;
    if (m.created_at < g.earliestAt) g.earliestAt = m.created_at;
  }

  return [...groups.values()]
    .filter(g => g.totalAmount > 0)
    .sort((a, b) => a.jobSiteName.localeCompare(b.jobSiteName));
};

const dateOnly = (iso: string) => iso.slice(0, 10);

/** Creates one Ready to Bill item per account and stamps its movements. */
export const queueSupplyUsage = async (groups: SupplyUsageGroup[]): Promise<number> => {
  if (!groups.length) return 0;
  const { data: userData } = await supabase.auth.getUser();
  let created = 0;

  for (const g of groups) {
    const period = g.earliestAt === g.latestAt
      ? dateOnly(g.latestAt)
      : `${dateOnly(g.earliestAt)} – ${dateOnly(g.latestAt)}`;

    const description = g.lines
      .map(l => `${l.qty} ${l.unit} ${l.itemName} @ $${l.unitPrice.toFixed(2)} = $${l.total.toFixed(2)}`)
      .join('\n');

    const { data: event, error } = await db.from('billing_events').insert({
      job_site_id: g.jobSiteId,
      crm_company_id: g.crmCompanyId,
      crm_deal_id: g.crmDealId,
      crm_lead_id: g.crmLeadId,
      source: SUPPLY_BILLING_SOURCE,
      label: `Supplies delivered — ${g.jobSiteName} (${period})`,
      description,
      amount: Math.round(g.totalAmount * 100) / 100,
      billing_email: g.billingEmail,
      status: 'ready',
      completed_at: g.latestAt,
      created_by: userData?.user?.id ?? null,
    }).select().single();
    if (error) throw error;

    const { error: linkErr } = await db.from('supply_movements')
      .update({ billing_event_id: event.id })
      .in('id', g.lines.map(l => l.id));
    if (linkErr) throw linkErr;
    created += 1;
  }
  return created;
};
