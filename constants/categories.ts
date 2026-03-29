export type CategoryType = 'money' | 'learning' | 'health' | 'rest' | 'wasted';

export const categories: Array<{ key: CategoryType; label: string; color: string }> = [
  { key: 'money', label: 'Money', color: '#F0A500' },
  { key: 'learning', label: 'Learning', color: '#2E86AB' },
  { key: 'health', label: 'Health', color: '#4CAF50' },
  { key: 'rest', label: 'Rest', color: '#9B59B6' },
  { key: 'wasted', label: 'Wasted', color: '#E74C3C' },
];
