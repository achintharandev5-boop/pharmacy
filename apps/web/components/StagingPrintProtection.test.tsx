import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StagingPrintProtection } from './StagingPrintProtection';
import { LabelCard } from './PrintableLabel';

afterEach(() => vi.unstubAllEnvs());
describe('staging clinical issuance containment', () => {
  it('has no print override outside staging', () => {
    const { container } = render(<StagingPrintProtection />);
    expect(container).toBeEmptyDOMElement();
  });
  it('installs a print-only blocker even for the browser print command', () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_PROFILE', 'synthetic-staging');
    const { container } = render(<StagingPrintProtection />);
    expect(screen.getByText(/PRINTING DISABLED/)).toBeInTheDocument();
    expect(container.querySelector('style')?.textContent).toContain('body > * { display: none !important; }');
  });
  it('does not invent a label without input', () => {
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_PROFILE', 'synthetic-staging');
    const { container } = render(<LabelCard labelItem={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
