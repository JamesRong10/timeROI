import { CategoryType } from '../constants/categories';
import { TimeEntry } from '../store/useTimeStore';

export function getTotalTime(entries: TimeEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.duration, 0);
}

export function getWastedTime(entries: TimeEntry[]): number {
  return entries
    .filter((entry) => entry.category === 'wasted')
    .reduce((sum, entry) => sum + entry.duration, 0);
}

export function getProductiveTime(entries: TimeEntry[]): number {
  return entries
    .filter((entry) => entry.category !== 'wasted')
    .reduce((sum, entry) => sum + entry.duration, 0);
}

export function getDollarValue(wastedMinutes: number): number {
  const hourlyRate = 15;
  return (wastedMinutes / 60) * hourlyRate;
}

export function isProductive(category: CategoryType): boolean {
  return category !== 'wasted';
}
