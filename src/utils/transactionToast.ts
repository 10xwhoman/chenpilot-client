export const TRANSACTION_TOAST_DEDUPE_WINDOW_MS = 5000;

function hashMessage(message: string): string {
  let hash = 2166136261;
  for (let index = 0; index < message.length; index += 1) {
    hash ^= message.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function transactionToastId(message: string, now = Date.now()): string {
  return `transaction-${hashMessage(message)}-${Math.floor(now / TRANSACTION_TOAST_DEDUPE_WINDOW_MS)}`;
}
