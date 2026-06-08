# G8 — Trust markers on price / valuation / rent

**Catches:** a price or rent figure rendered to the public without its required trust/disclosure marker (`PRODUCT.md` §8).

**Enforced by:** the ESLint rule `estate/trust-marker` (`packages/config/plugin/rules/g08-trust-marker.js`, messageId `missingTrustMarker`). This rule is a heuristic — it covers the most common bare-figure pattern; the full §8 matrix (valuation "indicative only", calculator "guidance only", review source + date range, AI-copy flag) is also a review-checklist item.

**Trigger:** a host JSX element (`span`, `div`, `p`, `td`, `strong`, `b`) whose children include a member expression named `rent` / `rentPcm` / `rentPw` / `rentPa` / `price` (optionally wrapped in a formatter call) **without** an adjacent frequency/qualifier marker matching `PCM` / `PW` / `PA` / `per month` / `per week` / `per annum` / `guide price` / `offers in region`.

**How to satisfy:** render through a marker-bearing component or include the qualifier text:

```tsx
<RentFigure amount={property.rentPcm} frequency="pcm" />   // → "£1,200 PCM"
<span>{formatGBP(property.rentPcm)} PCM</span>             // qualifier present
```

**Canonical violation → fix:** `<span>{formatGBP(property.rentPcm)}</span>` (no frequency) fails; adding the `PCM` marker (or using `<RentFigure>`) passes.
