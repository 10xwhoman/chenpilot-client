import { describe, expect, it } from 'vitest';
import { transactionToastId, TRANSACTION_TOAST_DEDUPE_WINDOW_MS } from './transactionToast';

describe('transaction toast policy', () => {
  it('reuses an id for duplicate messages inside the dedupe window', () => {
    expect(transactionToastId('Payment complete', 1000)).toBe(
      transactionToastId('Payment complete', TRANSACTION_TOAST_DEDUPE_WINDOW_MS - 1),
    );
  });

  it('allows the same message to be shown again after the dedupe window', () => {
    expect(transactionToastId('Payment complete', 1000)).not.toBe(
      transactionToastId('Payment complete', 7000),
    );
  });
});
