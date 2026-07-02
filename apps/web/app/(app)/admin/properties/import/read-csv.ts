import { mappingSchema, type ColumnMapping } from '@estate/validators';

// EPIC-X FR-X-1 / FR-X-2 / FR-X-3 — the shared upload-reader for the bulk CSV property
// import.
//
// Both the audited import (`importPropertiesFromCsv`) and the DRY-RUN preview
// (`previewPropertyImport`) read the uploaded file the same way: reject an absent /
// oversized / wrong-type upload before any parsing, otherwise return the file text. They
// also read the optional column MAPPING the same way. Kept as one pure-ish helper so the
// size / type / mapping rules cannot drift between the two entry points. No session, no
// DB — just the FormData surface.

/** Max upload size accepted inline (larger catalogues use scheduled feeds — FR-X-7). */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Read the optional column mapping (FR-X-3) from the submission. The form posts the
 * mapping as a JSON string under `mapping`; this parses it and validates it with the
 * SHARED `mappingSchema` so a tampered/malformed mapping can never target a field the
 * importer does not understand. Returns `undefined` when absent or invalid — the parser
 * then falls back to the header-as-is convention, so a bad mapping degrades gracefully
 * rather than failing the whole upload.
 */
export function readImportMapping(formData: FormData): ColumnMapping | undefined {
  const raw = formData.get('mapping');
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const result = mappingSchema.safeParse(parsed);
  return result.success ? result.data : undefined;
}

/** Read the uploaded CSV file from the submission, or an error when absent/oversized/wrong-type. */
export async function readImportCsv(
  formData: FormData,
): Promise<{ text: string } | { error: string }> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a CSV file to import.' };
  }
  if (file.size > IMPORT_MAX_BYTES) {
    return { error: 'The file is larger than 5 MB. Use a scheduled feed for larger imports.' };
  }
  const name = file.name.toLowerCase();
  if (!name.endsWith('.csv') && file.type !== 'text/csv') {
    return { error: 'The file must be a .csv file.' };
  }
  return { text: await file.text() };
}
