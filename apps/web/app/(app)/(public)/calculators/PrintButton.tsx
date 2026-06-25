'use client';

import { Button } from '@estate/ui';

// EPIC-W FR-W-12 — print / save-as-PDF the calculator result. A tiny client atom:
// the browser's own print dialog (which offers "Save as PDF") is the lightest way
// to let a user keep their indicative figures. `print:hidden` keeps the control
// itself off the printed page.

export function PrintButton() {
  return (
    <Button variant="secondary" className="print:hidden" onClick={() => window.print()}>
      Print / save as PDF
    </Button>
  );
}
