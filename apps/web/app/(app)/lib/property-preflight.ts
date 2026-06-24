import type { PublishPreflightInput } from '@estate/validators';

// EPIC-F FR-F-8 — assemble the §H.5 Tab 9 pre-flight checklist input. The checklist
// itself (the pure policy) lives in @estate/validators; this read model gathers the
// denormalised publish-state it needs: the listing's own columns plus aggregate
// reads over its images (count, a primary, a floorplan) and documents (EPC,
// material information, floorplan). Pure query-shaping over a STRUCTURAL Prisma
// client (DB-free to unit-test, mirrors admin-properties.ts); the live query runs
// tenant-scoped (RLS) via withTenant. Returns null for an absent / soft-deleted
// listing.

/** The Property columns the checklist reads. */
interface PreflightPropertyRow {
  id: string;
  description: string | null;
  keyFeatures: unknown;
  metaTitle: string | null;
  metaDescription: string | null;
  latitude: number | null;
  longitude: number | null;
  councilTaxBand: string | null;
  tenure: string | null;
  epcRating: string | null;
  materialInfoUrl: string | null;
}

/** The structural client the read model needs (a real PrismaClient satisfies it). */
export interface PublishPreflightReader {
  property: {
    findFirst(args: { where: Record<string, unknown> }): Promise<PreflightPropertyRow | null>;
  };
  propertyImage: {
    count(args: { where: Record<string, unknown> }): Promise<number>;
    findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
  };
  propertyDocument: {
    findMany(args: { where: Record<string, unknown> }): Promise<{ type: string }[]>;
  };
}

function countKeyFeatures(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Load the §H.5 Tab 9 checklist input for a listing, or null if it is absent /
 * soft-deleted. Reads the listing plus its image + document aggregates inside the
 * caller's tenant scope.
 */
export async function loadPublishPreflightInput(
  db: PublishPreflightReader,
  propertyId: string,
): Promise<PublishPreflightInput | null> {
  const property = await db.property.findFirst({ where: { id: propertyId, deletedAt: null } });
  if (!property) return null;

  const [imageCount, mainImage, floorplanImage, documents] = await Promise.all([
    db.propertyImage.count({ where: { propertyId } }),
    db.propertyImage.findFirst({ where: { propertyId, isPrimary: true } }),
    db.propertyImage.findFirst({ where: { propertyId, isFloorplan: true } }),
    db.propertyDocument.findMany({ where: { propertyId } }),
  ]);
  const docTypes = new Set(documents.map((doc) => doc.type));

  return {
    imageCount,
    hasMainImage: mainImage !== null,
    hasFloorplan: floorplanImage !== null || docTypes.has('floorplan'),
    hasEpcDocument: docTypes.has('epc'),
    epcRating: property.epcRating,
    hasMaterialInformation:
      docTypes.has('material_information') ||
      (typeof property.materialInfoUrl === 'string' && property.materialInfoUrl.length > 0),
    description: property.description,
    keyFeatureCount: countKeyFeatures(property.keyFeatures),
    metaTitle: property.metaTitle,
    metaDescription: property.metaDescription,
    latitude: property.latitude,
    longitude: property.longitude,
    councilTaxBand: property.councilTaxBand,
    tenure: property.tenure,
  };
}
