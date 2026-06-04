// tests/TelegramService.test.js
const { formatExpenseConfirmation, formatAmount, getCategoryEmoji, telegramPost, sendConfirmation, sendEditFieldMenu } = require('../src/TelegramService');

test('formatAmount formats EUR correctly', () => {
  expect(formatAmount(47.3, 'EUR')).toBe('€47.30');
});

test('formatAmount shows currency code for non-EUR', () => {
  expect(formatAmount(55.0, 'USD')).toBe('USD55.00');
});

test('getCategoryEmoji returns correct emoji', () => {
  expect(getCategoryEmoji('Supermercado')).toBe('🛒');
  expect(getCategoryEmoji('Formación')).toBe('📚');
  expect(getCategoryEmoji('Unknown')).toBe('📌');
});

test('formatExpenseConfirmation includes key fields', () => {
  const expense = { merchant: 'Zara', amount: 89.95, currency: 'EUR', category: 'Clothing', date: '2026-06-02', receiptUrl: 'https://drive.google.com/abc' };
  const text = formatExpenseConfirmation(expense);
  expect(text).toContain('Zara');
  expect(text).toContain('€89.95');
  expect(text).toContain('Clothing');
  expect(text).toContain('Recibo guardado en Drive ✓');
});

test('formatExpenseConfirmation omits receipt line when no URL', () => {
  const expense = { merchant: 'Mercadona', amount: 47.3, currency: 'EUR', category: 'Groceries', date: '2026-06-03', receiptUrl: '' };
  const text = formatExpenseConfirmation(expense);
  expect(text).not.toContain('Recibo guardado');
});

test('sendConfirmation sends reply_markup as an object, not a JSON string', () => {
  let capturedBody;
  global.UrlFetchApp.fetch = jest.fn().mockImplementation((_url, options) => {
    capturedBody = JSON.parse(options.payload);
    return {
      getContentText: jest.fn().mockReturnValue(JSON.stringify({ ok: true, result: {} })),
      getContent: jest.fn().mockReturnValue([])
    };
  });
  const expense = { merchant: 'Mercadona', amount: 47.3, currency: 'EUR', category: 'Groceries', date: '2026-06-03' };
  sendConfirmation('token', 123, 'text', expense);
  // Telegram requires reply_markup to be an object when content-type is application/json
  expect(typeof capturedBody.reply_markup).toBe('object');
  expect(capturedBody.reply_markup.inline_keyboard).toBeDefined();
});

test('sendEditFieldMenu sends reply_markup as an object, not a JSON string', () => {
  let capturedBody;
  global.UrlFetchApp.fetch = jest.fn().mockImplementation((_url, options) => {
    capturedBody = JSON.parse(options.payload);
    return {
      getContentText: jest.fn().mockReturnValue(JSON.stringify({ ok: true, result: {} })),
      getContent: jest.fn().mockReturnValue([])
    };
  });
  sendEditFieldMenu('token', 123);
  expect(typeof capturedBody.reply_markup).toBe('object');
  expect(capturedBody.reply_markup.inline_keyboard).toBeDefined();
});

test('telegramPost logs error when Telegram API returns ok: false', () => {
  global.UrlFetchApp.fetch = jest.fn().mockReturnValue({
    getContentText: jest.fn().mockReturnValue(JSON.stringify({ ok: false, error_code: 401, description: 'Unauthorized' })),
    getContent: jest.fn().mockReturnValue([])
  });
  telegramPost('bad-token', 'sendMessage', { chat_id: 123, text: 'hi' });
  expect(global.Logger.log).toHaveBeenCalledWith(
    expect.stringContaining('Telegram API error [sendMessage]')
  );
});

test('formatAmount handles null amount gracefully instead of showing NaN', () => {
  expect(formatAmount(null, 'EUR')).toBe('€0.00');
  expect(formatAmount(undefined, 'EUR')).toBe('€0.00');
});

test('formatExpenseConfirmation shows fallback for null merchant instead of showing "null"', () => {
  const expense = { merchant: null, amount: null, currency: 'EUR', category: 'Otros', date: '2026-06-03', receiptUrl: '' };
  const text = formatExpenseConfirmation(expense);
  expect(text).not.toContain(': null');
  expect(text).not.toContain('NaN');
});

test('telegramPost returns {ok: false} and logs when response body is not valid JSON', () => {
  global.UrlFetchApp.fetch = jest.fn().mockReturnValue({
    getContentText: jest.fn().mockReturnValue('<html>502 Bad Gateway</html>'),
    getContent: jest.fn().mockReturnValue([])
  });
  const result = telegramPost('token', 'sendMessage', { chat_id: 123, text: 'hi' });
  expect(result).toEqual({ ok: false });
  expect(global.Logger.log).toHaveBeenCalledWith(
    expect.stringContaining('Telegram API parse error [sendMessage]')
  );
});
