import { PoolClient, Pool } from "pg";
import { getPool } from "../db/pool";
import { fromScaled, toScaled } from "../domain/money";

export interface AccountBalance {
  accountId: string;
  posted: string; // credits - debits across posted ledger entries
  held: string; // sum of active holds
  available: string; // posted - held
}

/**
 * Derives an account's balance from immutable ledger_entries and active
 * holds — there is no stored balance column to drift out of sync (I11:
 * ledger state can be reconstructed from immutable entries).
 *
 * Pass a transaction client to read a locked, consistent snapshot inside a
 * larger operation (e.g. createHold); omit it to read the pool for a plain
 * balance query.
 */
export async function getBalance(
  accountId: string,
  clientOrPool: PoolClient | Pool = getPool()
): Promise<AccountBalance> {
  const postedResult = await clientOrPool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END), 0)
         AS net
     FROM ledger_entries
     WHERE account_id = $1`,
    [accountId]
  );

  const heldResult = await clientOrPool.query(
    `SELECT COALESCE(SUM(amount), 0) AS held
     FROM holds
     WHERE account_id = $1 AND status = 'active'`,
    [accountId]
  );

  const posted = toScaled(String(postedResult.rows[0].net));
  const held = toScaled(String(heldResult.rows[0].held));

  return {
    accountId,
    posted: fromScaled(posted),
    held: fromScaled(held),
    available: fromScaled(posted - held),
  };
}
