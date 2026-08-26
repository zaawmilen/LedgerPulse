export type EntryDirection = "debit" | "credit";

export type TransactionType =
  | "payment"
  | "hold_capture"
  | "reversal"
  | "payout"
  | "settlement";

export interface LedgerEntryInput {
  accountId: string;
  direction: EntryDirection;
  /** Decimal string, e.g. "125.50" — never a binary float. */
  amount: string;
  currency: string;
}

export interface PostTransactionInput {
  tenantId: string;
  type: TransactionType;
  currency: string;
  entries: LedgerEntryInput[];
  reference?: string;
  reversesTransactionId?: string;
}

export interface PostedTransaction {
  transactionId: string;
  tenantId: string;
  type: TransactionType;
  currency: string;
  postedAt: string;
  entries: Array<LedgerEntryInput & { entryId: string }>;
}
