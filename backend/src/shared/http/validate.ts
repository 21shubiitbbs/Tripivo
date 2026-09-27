import { HttpError } from './errors.js';

// Small helpers for reading untrusted request input. Each throws a 400 with a message naming
// the field, so handlers can read input in one line and let errorHandler respond.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** A path parameter that must be a uuid; anything else is treated as not found. */
export function uuidParam(value: unknown, what: string): string {
  if (!isUuid(value)) throw HttpError.notFound(`${what} not found`);
  return value;
}

export function requiredString(value: unknown, field: string, maxLength = 2000): string {
  if (typeof value !== 'string' || !value.trim()) throw HttpError.badRequest(`${field} is required`);
  if (value.trim().length > maxLength) throw HttpError.badRequest(`${field} is too long`);
  return value.trim();
}

/** `undefined` when absent (leave unchanged), `null` when explicitly cleared with "" or null. */
export function optionalString(value: unknown, field: string, maxLength = 2000): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw HttpError.badRequest(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw HttpError.badRequest(`${field} is too long`);
  return trimmed || null;
}

export function optionalInt(value: unknown, field: string, min: number, max: number): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isInteger(number) || number < min || number > max) {
    throw HttpError.badRequest(`${field} must be a whole number between ${min} and ${max}`);
  }
  return number;
}

export function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw HttpError.badRequest(`${field} must be a number`);
  }
  return number;
}

/** An array of short strings, e.g. interest keys. Also accepts a comma-separated string (query params). */
export function stringList(value: unknown, field: string, maxItems = 30): string[] | undefined {
  if (value === undefined || value === '') return undefined;
  const items = typeof value === 'string' ? value.split(',') : value;
  if (!Array.isArray(items) || items.length > maxItems || !items.every((item) => typeof item === 'string')) {
    throw HttpError.badRequest(`${field} must be a list of strings`);
  }
  return [...new Set(items.map((item: string) => item.trim()).filter(Boolean))].map((item) => item.slice(0, 60));
}

export function optionalDate(value: unknown, field: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw HttpError.badRequest(`${field} must be a date like 2026-10-15`);
  }
  return value;
}

export function requiredDate(value: unknown, field: string): string {
  const date = optionalDate(value, field);
  if (!date) throw HttpError.badRequest(`${field} is required`);
  return date;
}

export function oneOf<const T extends readonly string[]>(values: T, value: unknown, field: string): T[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    throw HttpError.badRequest(`${field} must be one of ${values.join(', ')}`);
  }
  return value as T[number];
}
