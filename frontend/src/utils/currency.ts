/**
 * Format currency strictly adhering to the Indian Numbering System
 * e.g., ₹1,25,000, ₹12,500, ₹1,500
 */
export function formatINR(value: number, includeDecimals = false): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '₹0';
  }

  const isNegative = value < 0;
  const absValue = Math.abs(value);

  const parts = includeDecimals 
    ? absValue.toFixed(2).split('.') 
    : [Math.round(absValue).toString()];

  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian currency formatting: last 3 digits, then groups of 2 digits
  if (integerPart.length > 3) {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  const formatted = (isNegative ? '-' : '') + '₹' + integerPart + (decimalPart ? '.' + decimalPart : '');
  return formatted;
}

/**
 * Format compact INR for chart labels and concise widgets
 * e.g., ₹1.2L, ₹45K, ₹1.5Cr
 */
export function formatCompactINR(value: number): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '₹0';
  }

  const isNegative = value < 0;
  const abs = Math.abs(value);
  const prefix = isNegative ? '-₹' : '₹';

  if (abs >= 10000000) {
    return prefix + (abs / 10000000).toFixed(1) + 'Cr';
  }
  if (abs >= 100000) {
    return prefix + (abs / 100000).toFixed(1) + 'L';
  }
  if (abs >= 1000) {
    return prefix + (abs / 1000).toFixed(0) + 'K';
  }
  return prefix + abs.toString();
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
}
