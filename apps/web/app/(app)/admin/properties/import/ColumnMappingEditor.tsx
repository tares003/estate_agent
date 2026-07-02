'use client';

import { useMemo } from 'react';
import { Select } from '@estate/ui';
import {
  CRM_PRESET_NAMES,
  IMPORT_COLUMNS,
  IMPORT_REQUIRED_COLUMNS,
  getPreset,
  unmappedRequiredColumns,
  type ColumnMapping,
  type ImportColumn,
  type PresetName,
} from '@estate/validators';

// EPIC-X FR-X-3 — the interactive column-mapping editor.
//
// Given the source headers detected in the upload, the admin maps each onto a canonical
// property field, or applies a CRM preset (Reapit, Alto, Jupix, Vebra, Rex) in one click.
// The editor is fully controlled by its parent (the import form owns the mapping state and
// passes it back down); every change calls `onMappingChange` with the resolved
// `ColumnMapping`. Required canonical fields are flagged and, while any is unmapped, the
// editor surfaces a live `role="alert"` warning so the admin fixes the mapping before the
// dry run. Native `<select>` controls (via the EPIC-L `Select` atom) keep it keyboard- and
// screen-reader-accessible by construction (G9); token-driven classes only (G7).

const REQUIRED_SET = new Set<ImportColumn>(IMPORT_REQUIRED_COLUMNS);

/** Human-readable preset names for the selector. */
const PRESET_LABELS: Record<PresetName, string> = {
  reapit: 'Reapit',
  alto: 'Alto',
  jupix: 'Jupix',
  vebra: 'Vebra',
  rex: 'Rex',
};

/** Turn a canonical column key into a friendly label (e.g. `displayAddress` → "Display address"). */
function columnLabel(column: ImportColumn): string {
  const spaced = column.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
  const words = spaced.trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The canonical-field options for a per-column select, required fields flagged first. */
function canonicalOptions(): { value: string; label: string }[] {
  return IMPORT_COLUMNS.map((column) => ({
    value: column,
    label: REQUIRED_SET.has(column) ? `${columnLabel(column)} (required)` : columnLabel(column),
  }));
}

export interface ColumnMappingEditorProps {
  /** The source headers detected in the uploaded file's header row. */
  detectedColumns: string[];
  /** Called with the full resolved mapping whenever a column or the preset changes. */
  onMappingChange: (mapping: ColumnMapping) => void;
  /** The current mapping (controlled). Absent entries are unmapped. */
  mapping?: ColumnMapping;
}

/**
 * ColumnMappingEditor — maps arbitrary CSV headers onto canonical property fields
 * (FR-X-3). Presented as a labelled grid: each source header on the left, a canonical-
 * field dropdown on the right, with a one-click CRM preset selector above.
 */
export function ColumnMappingEditor({
  detectedColumns,
  onMappingChange,
  mapping,
}: ColumnMappingEditorProps): React.ReactElement {
  const current = mapping ?? {};
  const options = useMemo(() => canonicalOptions(), []);

  // Which required canonical fields the current mapping does not yet map.
  const missingRequired = useMemo(() => unmappedRequiredColumns(current), [current]);

  /** Apply a whole preset, but only for headers actually present in this upload. */
  function applyPreset(name: PresetName): void {
    const preset = getPreset(name);
    const next: ColumnMapping = { ...current };
    for (const header of detectedColumns) {
      const target = preset[header];
      if (target !== undefined) next[header] = target;
    }
    onMappingChange(next);
  }

  /** Map (or unmap, on blank) a single source header. */
  function setColumn(header: string, value: string): void {
    const next: ColumnMapping = { ...current };
    if (value === '') {
      delete next[header];
    } else {
      next[header] = value as ImportColumn;
    }
    onMappingChange(next);
  }

  return (
    <section aria-labelledby="mapping-editor-heading" className="flex flex-col gap-4">
      <h3 id="mapping-editor-heading" className="t-body-md font-semibold">
        Map your columns
      </h3>
      <p className="t-body-sm text-text-secondary max-w-[60ch]">
        Match each column from your file to a property field, or apply a preset for your CRM. Fields
        marked <span className="font-semibold">(required)</span> must be mapped before you can
        import.
      </p>

      <div className="max-w-[24rem]">
        <Select
          label="CRM preset"
          placeholder="Choose a preset…"
          hint="Applies the standard mapping for a known CRM export."
          defaultValue=""
          onChange={(event) => {
            const value = event.target.value;
            if (value !== '') applyPreset(value as PresetName);
          }}
        >
          <option value="" disabled hidden>
            Choose a preset…
          </option>
          {CRM_PRESET_NAMES.map((name) => (
            <option key={name} value={name}>
              {PRESET_LABELS[name]}
            </option>
          ))}
        </Select>
      </div>

      <ul className="flex flex-col gap-4">
        {detectedColumns.map((header) => (
          <li
            key={header}
            className="border-divider flex flex-col gap-2 rounded-lg border p-4 md:flex-row md:items-end md:gap-4"
          >
            <div className="flex flex-col gap-1 md:w-1/2">
              <span className="t-body-sm font-semibold">{header}</span>
              <span className="t-body-sm text-text-secondary">Column in your file</span>
            </div>
            <div className="md:w-1/2">
              <Select
                label={`Map “${header}” to`}
                placeholder="Not mapped"
                value={current[header] ?? ''}
                options={options}
                onChange={(event) => setColumn(header, event.target.value)}
              />
            </div>
          </li>
        ))}
      </ul>

      {missingRequired.length > 0 ? (
        <p role="alert" className="t-body-sm text-danger">
          Still to map ({missingRequired.length} required{' '}
          {missingRequired.length === 1 ? 'field' : 'fields'}):{' '}
          {missingRequired.map(columnLabel).join(', ')}.
        </p>
      ) : null}
    </section>
  );
}
