import { withTransaction } from "../db/pool";
import { getBalance } from "./getBalance";
import { toScaled } from "../domain/money";
import { InsufficientFundsError } from "./errors";

export interface CreateHoldInput {
  accountId: string;
  amount: string;
  reference?: string;
}

export interface CreatedHold {
  holdId: string;
  accountId: string;
  amount: string;
  status: "active";
}

/**
 * Reserves funds against an account. Enforces I4 (a hold cannot exceed
 * available funds) using PostgreSQL row locking, NOT a Redis lock —
 * Redis is not the authoritative anti-double-spend mechanism here (Section
 * 8, ADR-004).
 *
 * The account row is locked with SELECT ... FOR UPDATE before the balance
 * is read, so two concurrent createHold calls against the same account
 * serialize: the second call's balance read blocks until the first call's
 * transaction commits or rolls back, and it sees the first hold's effect.
 */
export async function createHold(input: CreateHoldInput): Promise<CreatedHold> {
  return withTransaction(async (client) => {
    await client.query(
      `SELECT account_id FROM accounts WHERE account_id = $1 FOR UPDATE`,
      [input.accountId]
    );

    const balance = await getBalance(input.accountId, client);
    const available = toScaled(balance.available);
    const requested = toScaled(input.amount);

    if (requested > available) {
      throw new InsufficientFundsError(input.accountId);
    }

    const result = await client.query(
      `INSERT INTO holds (account_id, amount, reference)
       VALUES ($1, $2, $3)
       RETURNING hold_id, account_id, amount, status`,
      [input.accountId, input.amount, input.reference ?? null]
    );

    return result.rows[0];
  });
}
