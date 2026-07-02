// responsive-coverage: opt-out all — asserts the mapping grid, preset selector and the
// required-field validation state; layout is the admin-routes Playwright pass.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { REAPIT_PRESET, type ColumnMapping } from '@estate/validators';

import { ColumnMappingEditor } from './ColumnMappingEditor.js';

// EPIC-X FR-X-3 — the interactive column-mapping editor. The admin sees each source
// header from their upload with a dropdown of canonical fields, can apply a CRM preset in
// one click, and is warned when a required canonical field is still unmapped. onChange
// fires with the resolved ColumnMapping whenever a mapping or preset changes.

const REAPIT_HEADERS = Object.keys(REAPIT_PRESET);

describe('ColumnMappingEditor (FR-X-3)', () => {
  it('renders one mapping control per detected source column', () => {
    render(
      <ColumnMappingEditor
        detectedColumns={['Agency Reference', 'Postcode']}
        onMappingChange={vi.fn()}
      />,
    );
    // Each source header is labelled and mappable.
    expect(screen.getByText('Agency Reference')).toBeTruthy();
    expect(screen.getByText('Postcode')).toBeTruthy();
    // Two select controls (one per source column).
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2);
  });

  it('offers the CRM presets in a preset selector', () => {
    render(<ColumnMappingEditor detectedColumns={REAPIT_HEADERS} onMappingChange={vi.fn()} />);
    const presetControl = screen.getByLabelText(/preset/i);
    const options = within(presetControl)
      .getAllByRole('option')
      .map((o) => o.textContent?.toLowerCase());
    expect(options?.some((o) => o?.includes('reapit'))).toBe(true);
    expect(options?.some((o) => o?.includes('alto'))).toBe(true);
  });

  it('applying a preset populates the full mapping and fires onChange', () => {
    const onMappingChange = vi.fn();
    render(
      <ColumnMappingEditor detectedColumns={REAPIT_HEADERS} onMappingChange={onMappingChange} />,
    );
    fireEvent.change(screen.getByLabelText(/preset/i), { target: { value: 'reapit' } });
    expect(onMappingChange).toHaveBeenCalled();
    const last = onMappingChange.mock.calls.at(-1)![0] as ColumnMapping;
    // The Reapit preset maps the reference and postcode onto canonical fields.
    expect(last['Agency Reference']).toBe('reference');
    expect(last['Postcode']).toBe('postcode');
  });

  it('editing a single source column fires onChange with that mapping', () => {
    const onMappingChange = vi.fn();
    render(
      <ColumnMappingEditor
        detectedColumns={['Agency Reference']}
        onMappingChange={onMappingChange}
      />,
    );
    const select = screen.getByLabelText(/map .*agency reference/i);
    fireEvent.change(select, { target: { value: 'reference' } });
    const last = onMappingChange.mock.calls.at(-1)![0] as ColumnMapping;
    expect(last['Agency Reference']).toBe('reference');
  });

  it('marks required canonical fields and warns while any is unmapped', () => {
    render(
      <ColumnMappingEditor
        detectedColumns={['Agency Reference']}
        onMappingChange={vi.fn()}
        mapping={{ 'Agency Reference': 'reference' }}
      />,
    );
    // With only `reference` mapped, the required fields listingType / saleType /
    // displayAddress / postcode are still missing — surfaced as an alert.
    const status = screen.getByRole('alert');
    expect(status.textContent?.toLowerCase()).toContain('postcode');
    expect(status.textContent?.toLowerCase()).toContain('required');
  });

  it('shows no unmapped-required warning once every required field is mapped', () => {
    render(
      <ColumnMappingEditor
        detectedColumns={REAPIT_HEADERS}
        onMappingChange={vi.fn()}
        mapping={REAPIT_PRESET}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reflects a controlled mapping prop in the per-column selects', () => {
    render(
      <ColumnMappingEditor
        detectedColumns={['Agency Reference']}
        onMappingChange={vi.fn()}
        mapping={{ 'Agency Reference': 'reference' }}
      />,
    );
    const select = screen.getByLabelText(/map .*agency reference/i) as HTMLSelectElement;
    expect(select.value).toBe('reference');
  });

  it('lets a column be unmapped (blank canonical target)', () => {
    const onMappingChange = vi.fn();
    render(
      <ColumnMappingEditor
        detectedColumns={['Agency Reference']}
        onMappingChange={onMappingChange}
        mapping={{ 'Agency Reference': 'reference' }}
      />,
    );
    const select = screen.getByLabelText(/map .*agency reference/i);
    fireEvent.change(select, { target: { value: '' } });
    const last = onMappingChange.mock.calls.at(-1)![0] as ColumnMapping;
    expect(last['Agency Reference']).toBeUndefined();
  });
});
