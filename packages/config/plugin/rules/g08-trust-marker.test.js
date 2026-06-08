import { it } from 'vitest';
import { makeRuleTester } from './_rule-tester.js';
import rule from './g08-trust-marker.js';

// G8 — Trust-marker guard. A bare rent / price value rendered directly inside a
// host JSX element (span, div, p, td, strong, b) must be accompanied by an
// adjacent frequency / qualifier marker (PCM, PW, PA, per calendar month, guide
// price, offers in region, …). A figure with no frequency is misleading to the
// customer, so the guard rejects it.
//
// Heuristic by nature (see the rule's header comment): it matches the targeted
// member-property names and a marker regex over sibling text; it cannot reason
// about values resolved at runtime.
it('G8 trust-marker: flags a bare rent/price figure in a host tag with no frequency marker', () => {
  makeRuleTester().run('@estate/trust-marker', rule, {
    valid: [
      // A dedicated component (not a targeted host tag) owns the marker itself —
      // there is no bare member child of a host element to inspect.
      { code: 'const x = <RentFigure amount={property.rentPcm} frequency="pcm" />;' },
      // Frequency marker present as sibling JSX text alongside the figure.
      { code: 'const x = <span>{formatGBP(property.rentPcm)} PCM</span>;' },
      { code: 'const x = <p>{formatGBP(property.rentPw)} per week</p>;' },
      { code: 'const x = <td>{formatGBP(property.rentPa)} per annum</td>;' },
      { code: 'const x = <div>Guide price {formatGBP(property.price)}</div>;' },
      { code: 'const x = <strong>{formatGBP(property.price)} offers in region</strong>;' },
      { code: 'const x = <span>{property.rentPcm} pcm</span>;' },
      // A host tag with no rent/price member child is irrelevant to this guard.
      { code: 'const x = <span>{property.displayAddress}</span>;' },
      // Plain string content in a host tag is fine.
      { code: 'const x = <div>From £1,200 per calendar month</div>;' },
    ],
    invalid: [
      // Bare rentPcm rendered via formatGBP wrapper, no frequency marker text.
      {
        code: 'const x = <span>{formatGBP(property.rentPcm)}</span>;',
        errors: [{ messageId: 'missingTrustMarker' }],
      },
      // Bare member directly in the container, no marker.
      {
        code: 'const x = <strong>{property.price}</strong>;',
        errors: [{ messageId: 'missingTrustMarker' }],
      },
      // rentPw in a table cell with no frequency.
      {
        code: 'const x = <td>{formatGBP(property.rentPw)}</td>;',
        errors: [{ messageId: 'missingTrustMarker' }],
      },
      // rentPa in a paragraph with no qualifier.
      {
        code: 'const x = <p>{property.rentPa}</p>;',
        errors: [{ messageId: 'missingTrustMarker' }],
      },
    ],
  });
});
