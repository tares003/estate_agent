'use client';

import { type MouseEvent } from 'react';
import { Button } from '@estate/ui';

/**
 * "Search near me" — the geolocation entry point for radius search (master spec
 * §K.1). On click it asks the browser for the user's coordinates (no third-party
 * geocoding needed), writes them into the filter form's hidden lat/lng fields,
 * defaults the distance to 5 if unset, and submits — so the catalogue re-renders
 * server-side with `?lat=…&lng=…&radius=…`. Progressive: if geolocation is
 * unavailable the button is simply inert.
 */
export function NearMeButton() {
  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    const form = event.currentTarget.form;
    if (!form || typeof navigator === 'undefined' || !navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((position) => {
      const setField = (name: string, value: string): void => {
        const field = form.elements.namedItem(name);
        if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
          field.value = value;
        }
      };
      setField('lat', String(position.coords.latitude));
      setField('lng', String(position.coords.longitude));

      // Give "near me" a sensible default radius when the user hasn't picked one.
      const radius = form.elements.namedItem('radius');
      if (radius instanceof HTMLSelectElement && radius.value === '') radius.value = '5';

      form.requestSubmit();
    });
  }

  return (
    <Button type="button" variant="secondary" onClick={handleClick}>
      Search near me
    </Button>
  );
}
