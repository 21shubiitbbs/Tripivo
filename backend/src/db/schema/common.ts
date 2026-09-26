// Scalar types as node-postgres returns them. Row types in this folder mirror the tables
// created by backend/migrations; update them in the same change as any new migration.
//
//   uuid, text, char -> string        timestamptz -> Date
//   date             -> DateString    numeric     -> Money (string, to keep amounts exact)
//   smallint         -> number        text[]      -> string[]
//   jsonb            -> parsed JSON

/** A `uuid` primary or foreign key. */
export type Uuid = string;

/** A `numeric(12, 2)` value, e.g. "1499.00". Convert deliberately; never do float math on money. */
export type Money = string;

/** A `date` value, e.g. "2026-10-01" (see the DATE parser in db/pool.ts). */
export type DateString = string;

/** ISO 4217 code stored in `char(3)` columns, e.g. "INR". */
export type CurrencyCode = string;

export type CreatedAt = {
  created_at: Date;
};

/** Columns on tables whose `updated_at` is maintained by the `set_updated_at()` trigger. */
export type Timestamps = CreatedAt & {
  updated_at: Date;
};
