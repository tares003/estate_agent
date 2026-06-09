// responsive-coverage: opt-out all — asserts the geolocation behaviour of the
// "Search near me" control; its layout sits inside the filter bar (covered by the
// page-level Playwright e2e pass, design-requirements §3).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NearMeButton } from './NearMeButton.js';

/** Render the button inside a form carrying the fields it populates. */
function renderInForm() {
  return render(
    <form>
      <input type="hidden" name="lat" defaultValue="" />
      <input type="hidden" name="lng" defaultValue="" />
      <select name="radius" defaultValue="" aria-label="radius">
        <option value="" />
        <option value="5">5</option>
      </select>
      <NearMeButton />
    </form>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('NearMeButton', () => {
  it('writes geolocation coordinates into the form, defaults the radius, and submits', async () => {
    const getCurrentPosition = vi.fn(
      (success: (pos: { coords: { latitude: number; longitude: number } }) => void) => {
        success({ coords: { latitude: 51.5074, longitude: -0.1278 } });
      },
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, 'requestSubmit')
      .mockImplementation(() => undefined);

    renderInForm();
    await userEvent.click(screen.getByRole('button', { name: /Search near me/i }));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect((document.querySelector('input[name="lat"]') as HTMLInputElement).value).toBe('51.5074');
    expect((document.querySelector('input[name="lng"]') as HTMLInputElement).value).toBe('-0.1278');
    // an unset radius defaults to 5 for "near me"
    expect((document.querySelector('select[name="radius"]') as HTMLSelectElement).value).toBe('5');
    expect(requestSubmit).toHaveBeenCalledTimes(1);

    requestSubmit.mockRestore();
  });

  it('is inert when geolocation is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const requestSubmit = vi
      .spyOn(HTMLFormElement.prototype, 'requestSubmit')
      .mockImplementation(() => undefined);

    renderInForm();
    await userEvent.click(screen.getByRole('button', { name: /Search near me/i }));

    expect(requestSubmit).not.toHaveBeenCalled();
    requestSubmit.mockRestore();
  });
});
