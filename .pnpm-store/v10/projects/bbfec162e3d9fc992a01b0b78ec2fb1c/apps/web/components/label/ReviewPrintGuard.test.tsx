import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

/**
 * The review page's print guard. jsdom has no layout, so the measurement is controlled here;
 * the real measurement is covered by lib/labelFit.test.ts and the Edge print-guard run.
 */
type Report = { index: number; problems: string[] }[];
const overflowing = vi.fn<() => Report>(() => []);
vi.mock('../../lib/labelFit', () => ({ labelFitReport: () => overflowing() }));
const LABEL_1_NAME: Report = [{ index: 0, problems: ['medicine name too long to print in full'] }];
vi.mock('../../app/actions/sms', () => ({ sendClientSms: vi.fn() }));

import { LabelActionPage } from './LabelActionPage';
import { useLabelStore } from '../../store/labelStore';

function renderPage() {
  const onSave = vi.fn();
  const onPrintAndSave = vi.fn();
  render(<LabelActionPage onSave={onSave} onDelete={vi.fn()} onPrintAndSave={onPrintAndSave} onBack={vi.fn()} />);
  return { onSave, onPrintAndSave };
}

beforeEach(() => {
  useLabelStore.getState().allClear();
  overflowing.mockReset();
  overflowing.mockReturnValue([]);
});

describe('review page print guard', () => {
  it('a label that fits can be printed', async () => {
    const user = userEvent.setup();
    const { onPrintAndSave } = renderPage();
    await user.click(screen.getByRole('button', { name: /Print & Save/ }));
    expect(onPrintAndSave).toHaveBeenCalledTimes(1);
  });

  it('an overflowing label blocks Print & Save, with the reason shown', async () => {
    overflowing.mockReturnValue(LABEL_1_NAME);
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /Print & Save/ })).toBeDisabled());
    expect(screen.getByTestId('print-blocked')).toHaveTextContent('label 1 has more text than fits on the 70 × 50 mm label');
    expect(screen.getByTestId('print-blocked')).toHaveTextContent('label 1: medicine name too long to print in full');
    expect(screen.getByTestId('label-overflow-0')).toHaveTextContent('Cannot print this label in full: medicine name too long to print in full');
  });

  it('measures again when Print & Save is pressed and refuses if the label no longer fits', async () => {
    const user = userEvent.setup();
    const { onPrintAndSave } = renderPage();
    await waitFor(() => expect(overflowing).toHaveBeenCalled());
    overflowing.mockReturnValue(LABEL_1_NAME); // e.g. the font finished loading and lines grew
    await user.click(screen.getByRole('button', { name: /Print & Save/ }));
    expect(onPrintAndSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('print-blocked')).toBeInTheDocument();
  });

  it('saving without printing stays available and says what it does', async () => {
    overflowing.mockReturnValue(LABEL_1_NAME);
    const user = userEvent.setup();
    const { onSave } = renderPage();
    const save = screen.getByRole('button', { name: /Save without printing/ });
    expect(save).toHaveAttribute('title', 'Records the prescription as completed, without printing. This is not a draft.');
    await user.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('the preview caption states the real label size', () => {
    renderPage();
    expect(screen.getByText('Actual size 70 × 50 mm print preview')).toBeInTheDocument();
  });
});

describe('Print label only (not saved)', () => {
  function renderWithPrintOnly() {
    const onPrintOnly = vi.fn();
    const onPrintAndSave = vi.fn();
    render(<LabelActionPage onSave={vi.fn()} onDelete={vi.fn()} onPrintAndSave={onPrintAndSave} onPrintOnly={onPrintOnly} onBack={vi.fn()} />);
    return { onPrintOnly, onPrintAndSave, button: () => screen.getByRole('button', { name: 'Print label only (not saved)' }) };
  }

  it('is offered beside Print & Save, says it saves nothing, and needs no patient or medicine name', async () => {
    const user = userEvent.setup();
    useLabelStore.getState().setProductQuantity(10); // no patient, no medicine
    const { onPrintOnly, onPrintAndSave, button } = renderWithPrintOnly();
    expect(button()).toHaveAttribute('title', expect.stringContaining('without saving a prescription, deducting stock or recording the print'));
    await user.click(button());
    expect(onPrintOnly).toHaveBeenCalledTimes(1);
    expect(onPrintAndSave).not.toHaveBeenCalled();
  });

  it('is blocked exactly like Print & Save when a label would be cut off, and re-measures at print time', async () => {
    overflowing.mockReturnValue(LABEL_1_NAME);
    const { onPrintOnly, button } = renderWithPrintOnly();
    await waitFor(() => expect(button()).toBeDisabled());
    expect(screen.getByRole('button', { name: /Print & Save/ })).toBeDisabled();
    expect(onPrintOnly).not.toHaveBeenCalled();
  });

  it('is not shown where the page provides no print-only action', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: 'Print label only (not saved)' })).toBeNull();
  });
});
