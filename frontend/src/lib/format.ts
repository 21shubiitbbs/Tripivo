import type { TripSummary } from './api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatPrice(amount: number) {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/** An amount in minor units (paise), e.g. 125050 → "₹1,250.50"; whole amounts drop the ".00". */
export function formatMoney(minor: number, currency = 'INR') {
  const major = minor / 100;
  const decimals = minor % 100 === 0 ? 0 : 2;
  const symbol = currency === 'INR' ? '₹' : `${currency} `;
  const sign = major < 0 ? '-' : '';
  return `${sign}${symbol}${Math.abs(major).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: 2 })}`;
}

/** "₹8,500", "₹5,000 - ₹10,000", "Under ₹5,000" or "₹20,000+". */
export function formatBudget(trip: Pick<TripSummary, 'budgetMin' | 'budgetMax'>) {
  const { budgetMin: min, budgetMax: max } = trip;
  if (min !== null && max !== null) return min === max ? formatPrice(max) : `${formatPrice(min)} - ${formatPrice(max)}`;
  if (max !== null) return `Under ${formatPrice(max)}`;
  if (min !== null) return `${formatPrice(min)}+`;
  return 'Price on request';
}

/** "15 Oct" from "2026-10-15". */
export function formatDay(iso: string) {
  const [, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

/** "15 Oct - 18 Oct", or "Dates to be decided". */
export function formatDateRange(trip: Pick<TripSummary, 'startDate' | 'endDate'>) {
  if (!trip.startDate) return 'Dates to be decided';
  return trip.endDate ? `${formatDay(trip.startDate)} - ${formatDay(trip.endDate)}` : formatDay(trip.startDate);
}

/** "2 minutes ago", "3 hours ago", "Yesterday", "5 days ago", "12 Oct". */
export function timeAgo(value: string) {
  const seconds = Math.max(0, (Date.now() - Date.parse(value)) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  const date = new Date(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "10:30 AM" today, "Yesterday", or "12 Oct" for chat lists. */
export function chatTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function clockTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function errorMessage(error: unknown, fallback = 'Something went wrong') {
  return error instanceof Error ? error.message : fallback;
}
