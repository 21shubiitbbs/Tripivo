import { pool, type Queryable } from '../../../db/pool.js';
import type { PhoneOtpCodeRow } from '../../../db/schema/index.js';

// ---- Codes (console provider) ------------------------------------------------------------

/** Replaces any previous code for the number, resetting its attempt count. */
export async function saveOtpCode(
  phone: string,
  codeHash: string,
  expiresAt: Date,
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `INSERT INTO phone_otp_codes (phone, code_hash, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (phone) DO UPDATE
       SET code_hash = EXCLUDED.code_hash,
           expires_at = EXCLUDED.expires_at,
           attempts = 0,
           created_at = now()`,
    [phone, codeHash, expiresAt],
  );
}

export async function findOtpCode(phone: string, db: Queryable = pool): Promise<PhoneOtpCodeRow | null> {
  const { rows } = await db.query<PhoneOtpCodeRow>(
    'SELECT * FROM phone_otp_codes WHERE phone = $1',
    [phone],
  );
  return rows[0] ?? null;
}

export async function incrementOtpAttempts(phone: string, db: Queryable = pool): Promise<void> {
  await db.query('UPDATE phone_otp_codes SET attempts = attempts + 1 WHERE phone = $1', [phone]);
}

export async function deleteOtpCode(phone: string, db: Queryable = pool): Promise<void> {
  await db.query('DELETE FROM phone_otp_codes WHERE phone = $1', [phone]);
}

// ---- Send log (rate limiting) ------------------------------------------------------------

export type OtpSendStats = {
  /** Seconds since the last code was sent to this number, or null if none recently. */
  secondsSinceLastSendToPhone: number | null;
  sendsToPhoneLastHour: number;
  sendsFromIpLastHour: number;
};

export async function getOtpSendStats(
  phone: string,
  ip: string | null,
  db: Queryable = pool,
): Promise<OtpSendStats> {
  const { rows } = await db.query<{
    seconds_since_last: number | null;
    phone_count: number;
    ip_count: number;
  }>(
    `SELECT
       (SELECT extract(epoch FROM now() - max(created_at))::float8
          FROM phone_otp_sends WHERE phone = $1)                                         AS seconds_since_last,
       (SELECT count(*)::int FROM phone_otp_sends
          WHERE phone = $1 AND created_at > now() - interval '1 hour')                   AS phone_count,
       (SELECT count(*)::int FROM phone_otp_sends
          WHERE $2::text IS NOT NULL AND ip = $2 AND created_at > now() - interval '1 hour') AS ip_count`,
    [phone, ip],
  );
  const row = rows[0];
  return {
    secondsSinceLastSendToPhone: row.seconds_since_last,
    sendsToPhoneLastHour: row.phone_count,
    sendsFromIpLastHour: row.ip_count,
  };
}

/** Logs a send and prunes entries old enough to no longer matter for any limit. */
export async function recordOtpSend(phone: string, ip: string | null, db: Queryable = pool): Promise<void> {
  await db.query('INSERT INTO phone_otp_sends (phone, ip) VALUES ($1, $2)', [phone, ip]);
  await db.query("DELETE FROM phone_otp_sends WHERE created_at < now() - interval '1 day'");
}
