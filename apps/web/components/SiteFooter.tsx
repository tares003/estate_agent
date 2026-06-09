// EPIC-C/D public footer chrome. Extracted from the public layout (B24) so the
// indicative-pricing / rent-frequency trust note (a trust marker, G8) stays
// unit-tested after the layout became async glue. The CMS-managed multi-column
// footer (location='footer') is a later EPIC-L render that will consume the same
// getMenu spine; this is the V1 static shell.
export function SiteFooter() {
  return (
    <footer className="bg-surface-raised border-border mt-16 border-t">
      <div className="container t-body-sm text-text-secondary py-10">
        <p>
          © Estate Platform. Property details are indicative only; rent figures are shown PCM unless
          stated otherwise.
        </p>
      </div>
    </footer>
  );
}
