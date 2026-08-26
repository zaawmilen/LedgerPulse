export class UnbalancedTransactionError extends Error {
  constructor(debits: string, credits: string) {
    super(`Transaction is not balanced: debits=${debits} credits=${credits}`);
    this.name = "UnbalancedTransactionError";
  }
}

export class EmptyTransactionError extends Error {
  constructor() {
    super("A transaction must have at least one debit and one credit entry");
    this.name = "EmptyTransactionError";
  }
}

export class InsufficientFundsError extends Error {
  constructor(accountId: string) {
    super(`Insufficient available funds on account ${accountId}`);
    this.name = "InsufficientFundsError";
  }
}
