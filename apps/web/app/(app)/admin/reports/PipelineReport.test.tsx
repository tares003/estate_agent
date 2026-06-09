// responsive-coverage: opt-out all — asserts the KPI + by-source rendering; layout
// is the admin-routes Playwright pass (design-requirements §3).
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';

import type { EnquiryPipelineReport } from '../../lib/enquiry-reports.js';
import { PipelineReport } from './PipelineReport.js';

const report: EnquiryPipelineReport = {
  byStatus: {
    new: 10,
    contacted: 6,
    viewing_booked: 0,
    valuation_booked: 0,
    waiting: 0,
    converted: 4,
    lost: 0,
    archived: 0,
  },
  total: 20,
  contacted: 10,
  converted: 4,
  conversionRate: 0.2,
};

describe('PipelineReport', () => {
  it('renders the funnel KPIs including a formatted conversion rate', () => {
    render(<PipelineReport report={report} sources={[{ source: '/buy', count: 7 }]} />);
    const funnel = within(screen.getByRole('region', { name: 'Conversion funnel' }));
    expect(funnel.getByText('Total enquiries')).toBeInTheDocument();
    expect(funnel.getByText('20')).toBeInTheDocument();
    expect(funnel.getByText('Conversion rate')).toBeInTheDocument();
    expect(funnel.getByText('20.0%')).toBeInTheDocument();
  });

  it('renders the by-source table', () => {
    render(
      <PipelineReport
        report={report}
        sources={[
          { source: '/buy', count: 7 },
          { source: '(direct)', count: 3 },
        ]}
      />,
    );
    const table = within(screen.getByRole('table'));
    expect(table.getByText('/buy')).toBeInTheDocument();
    expect(table.getByText('(direct)')).toBeInTheDocument();
  });

  it('shows an empty state when there are no enquiries', () => {
    render(<PipelineReport report={report} sources={[]} />);
    expect(screen.getByText('No enquiries in this period.')).toBeInTheDocument();
  });
});
