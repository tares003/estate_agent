import type { PropertyCardProps } from '@estate/ui';
import { formatPrice, priceQualifier, rentFrequency, toCardStatus } from './format.js';

// EPIC-F property catalogue data layer. Pure mapping from §J Property rows to the
// PropertyCard view model — unit-tested with a fake client; the live queries run
// against tenant-scoped Postgres (RLS) via withTenant in the route. Keeping the
// client structural (not the full PrismaClient) keeps this testable without a DB.

/** The Property columns the catalogue reads. */
export interface PropertyRow {
  slug: string;
  displayAddress: string;
  postcode: string;
  title: string | null;
  saleType: string;
  marketStatus: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  receptions: number | null;
}

export interface PropertyReader {
  property: {
    findMany(args: {
      where?: Record<string, unknown>;
      orderBy?: unknown;
      take?: number;
    }): Promise<PropertyRow[]>;
  };
}

export interface ListPropertiesOptions {
  saleType?: 'sale' | 'rent';
  take?: number;
}

/** Map one §J Property row to PropertyCard props (trust markers applied). */
export function toCardProps(row: PropertyRow): PropertyCardProps {
  const card: PropertyCardProps = {
    href: `/properties/${row.slug}`,
    status: toCardStatus(row.marketStatus),
    priceQualifier: priceQualifier(row.marketStatus),
    price: formatPrice(row.price),
    title: row.title ?? row.displayAddress,
    address: `${row.displayAddress}, ${row.postcode}`,
  };
  const freq = rentFrequency(row.saleType);
  if (freq) card.rentFrequency = freq;
  if (row.bedrooms != null) card.bedrooms = row.bedrooms;
  if (row.bathrooms != null) card.bathrooms = row.bathrooms;
  return card;
}

/** List published, non-withdrawn properties for the catalogue, newest first. */
export async function listProperties(
  db: PropertyReader,
  options: ListPropertiesOptions = {},
): Promise<PropertyCardProps[]> {
  const where: Record<string, unknown> = { publishedAt: { not: null }, deletedAt: null };
  if (options.saleType) where['saleType'] = options.saleType;
  const rows = await db.property.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    take: options.take ?? 24,
  });
  return rows.map(toCardProps);
}
