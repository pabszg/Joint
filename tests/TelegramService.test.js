// tests/TelegramService.test.js
const { formatExpenseConfirmation, formatAmount, getCategoryEmoji } = require('../src/TelegramService');

test('formatAmount formats EUR correctly', () => {
  expect(formatAmount(47.3, 'EUR')).toBe('€47.30');
});

test('formatAmount shows currency code for non-EUR', () => {
  expect(formatAmount(55.0, 'USD')).toBe('USD55.00');
});

test('getCategoryEmoji returns correct emoji', () => {
  expect(getCategoryEmoji('Groceries')).toBe('🛒');
  expect(getCategoryEmoji('Learning')).toBe('📚');
  expect(getCategoryEmoji('Unknown')).toBe('📌');
});

test('formatExpenseConfirmation includes key fields', () => {
  const expense = { merchant: 'Zara', amount: 89.95, currency: 'EUR', category: 'Clothing', date: '2026-06-02', receiptUrl: 'https://drive.google.com/abc' };
  const text = formatExpenseConfirmation(expense);
  expect(text).toContain('Zara');
  expect(text).toContain('€89.95');
  expect(text).toContain('Clothing');
  expect(text).toContain('Receipt saved to Drive ✓');
});

test('formatExpenseConfirmation omits receipt line when no URL', () => {
  const expense = { merchant: 'Mercadona', amount: 47.3, currency: 'EUR', category: 'Groceries', date: '2026-06-03', receiptUrl: '' };
  const text = formatExpenseConfirmation(expense);
  expect(text).not.toContain('Receipt saved');
});
