export type DisplayCurrency = 'VND' | 'USD';

const DEMO_VND_PER_USD = 25000;
let displayCurrency: DisplayCurrency = 'VND';

export function setDisplayCurrency(value: string) {
  displayCurrency = value === 'USD' ? 'USD' : 'VND';
}

export function formatCurrency(value: number): string {
  if (displayCurrency === 'USD') return `≈ $${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value / DEMO_VND_PER_USD)}`;
  return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
}
