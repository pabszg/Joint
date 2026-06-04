// tests/Webhook.test.js

// Set up global service mocks before requiring Webhook
beforeEach(() => {
  jest.resetModules();
  global.getConfig = jest.fn().mockReturnValue({
    user1Name: 'Pablo', user1TelegramId: '111',
    user2Name: 'Ana', user2TelegramId: '222',
    geminiApiKey: 'test-key', telegramBotToken: 'test-token',
    driveFolderId: 'drive-id', baseCurrency: 'EUR',
    defaultAlertThreshold: 80
  });
  global.getState = jest.fn().mockReturnValue(null);
  global.setState = jest.fn();
  global.clearState = jest.fn();
  global.classifyExpense = jest.fn().mockReturnValue({
    merchant: 'Mercadona', amount: 47.30, currency: 'EUR',
    date: '2026-06-03', category: 'Groceries', notes: '',
    confidence: 0.97, has_items: false, items: []
  });
  global.classifyReceipt = jest.fn().mockReturnValue({
    merchant: 'Zara', amount: 89.95, currency: 'EUR',
    date: '2026-06-02', category: 'Clothing', notes: '',
    confidence: 0.92, has_items: false, items: []
  });
  global.getCategories = jest.fn().mockReturnValue(['Groceries', 'Clothing']);
  global.getCorrections = jest.fn().mockReturnValue([]);
  global.getBudgets = jest.fn().mockReturnValue([
    { category: 'Groceries', limit: 300, alertThreshold: 80 }
  ]);
  global.getCategoryMonthSpend = jest.fn().mockReturnValue(142.30);
  global.appendExpense = jest.fn().mockReturnValue('EXP-001');
  global.appendCorrection = jest.fn();
  global.saveReceiptToDrive = jest.fn().mockReturnValue('https://drive.google.com/abc');
  global.getFilePath = jest.fn().mockReturnValue('photos/file.jpg');
  global.downloadFile = jest.fn().mockReturnValue([]);
  global.sendMessage = jest.fn();
  global.sendConfirmation = jest.fn();
  global.sendEditFieldMenu = jest.fn();
  global.answerCallbackQuery = jest.fn();
  global.formatExpenseConfirmation = jest.fn().mockReturnValue('🧾 Expense parsed...');
  global.formatBudgetSave = jest.fn().mockReturnValue('Groceries: €142 / €300 (47%)');
  global.checkBudget = jest.fn().mockReturnValue(null);
  global.formatBudgetAlert = jest.fn().mockReturnValue('⚠️ Budget alert');
  global.isLowConfidence = jest.fn().mockReturnValue(false);
  global.getPersonName = jest.fn().mockReturnValue('Pablo');
  global.getMonthExpenses = jest.fn().mockReturnValue([]);
  global.formatStatusMessage = jest.fn().mockReturnValue('📊 Status...');
  global.getDaysInMonth = jest.fn().mockReturnValue(30);
});

const loadWebhook = () => require('../src/Webhook');

test('handleTextExpense calls classifyExpense and sendConfirmation', () => {
  loadWebhook();
  const message = { chat: { id: 123 }, from: { id: 111, first_name: 'Pablo' }, text: 'Mercadona 47.30' };
  handleTextExpense(message);
  expect(global.classifyExpense).toHaveBeenCalled();
  expect(global.setState).toHaveBeenCalledWith(123, expect.objectContaining({ action: 'awaiting_confirmation' }));
  expect(global.sendConfirmation).toHaveBeenCalled();
});

test('handleTextExpense sends a processing message before calling Gemini', () => {
  loadWebhook();
  const message = { chat: { id: 123 }, from: { id: 111 }, text: 'Mercadona 47.30' };
  const callOrder = [];
  global.sendMessage.mockImplementation(() => callOrder.push('sendMessage'));
  global.classifyExpense.mockImplementation(() => { callOrder.push('classifyExpense'); return global.classifyExpense.mock.results[0]?.value ?? { merchant: 'Mercadona', amount: 47.30, currency: 'EUR', date: '2026-06-03', category: 'Groceries', notes: '', confidence: 0.97, has_items: false, items: [] }; });
  handleTextExpense(message);
  expect(callOrder[0]).toBe('sendMessage');
  expect(callOrder[1]).toBe('classifyExpense');
  expect(global.sendMessage).toHaveBeenCalledWith('test-token', 123, expect.stringContaining('⏳'));
});

test('handleConfirmCallback saves expense and clears state', () => {
  loadWebhook();
  global.getState.mockReturnValue({
    action: 'awaiting_confirmation',
    expense: { merchant: 'Mercadona', amount: 47.30, currency: 'EUR', date: '2026-06-03', category: 'Groceries', eurAmount: 47.30, person: 'Pablo', notes: '', hasItems: false, receiptUrl: '' }
  });
  const callbackQuery = { id: 'cbq1', data: 'confirm', message: { chat: { id: 123 }, message_id: 1 }, from: { id: 111 } };
  handleCallbackQuery(callbackQuery);
  expect(global.appendExpense).toHaveBeenCalled();
  expect(global.clearState).toHaveBeenCalledWith(123);
  expect(global.sendMessage).toHaveBeenCalled();
});

test('handleCancelCallback clears state and sends cancellation message', () => {
  loadWebhook();
  global.getState.mockReturnValue({ action: 'awaiting_confirmation', expense: {} });
  const callbackQuery = { id: 'cbq2', data: 'cancel', message: { chat: { id: 123 }, message_id: 1 }, from: { id: 111 } };
  handleCallbackQuery(callbackQuery);
  expect(global.clearState).toHaveBeenCalledWith(123);
  expect(global.sendMessage).toHaveBeenCalledWith(
    expect.any(String), 123, expect.stringContaining('cancelado')
  );
});

test('handleStatus sends formatted status message', () => {
  loadWebhook();
  const message = { chat: { id: 123 }, from: { id: 111 }, text: '/status' };
  handleStatus(message);
  expect(global.getMonthExpenses).toHaveBeenCalled();
  expect(global.sendMessage).toHaveBeenCalledWith(
    expect.any(String), 123, expect.any(String)
  );
});

test('handleUpdate routes /start to handleStart and sends welcome message', () => {
  loadWebhook();
  const message = { chat: { id: 123 }, from: { id: 111 }, text: '/start' };
  handleUpdate({ update_id: 1, message });
  expect(global.sendMessage).toHaveBeenCalledWith(
    'test-token', 123, expect.stringContaining('Bienvenido')
  );
});

describe('isDuplicate', () => {
  let store;
  beforeEach(() => {
    store = {};
    // mockReturnValue (not a factory) is intentional — the same object must be returned on
    // every getScriptProperties() call so that state written by one isDuplicate() call is
    // visible to the next call within the same test.
    PropertiesService.getScriptProperties = jest.fn().mockReturnValue({
      getProperty: jest.fn((key) => store[key] || null),
      setProperty: jest.fn((key, value) => { store[key] = value; }),
      deleteProperty: jest.fn((key) => { delete store[key]; })
    });
    loadWebhook();
  });

  test('first occurrence of an update_id is not a duplicate', () => {
    expect(isDuplicate(1000)).toBe(false);
  });

  test('same update_id a second time is a duplicate', () => {
    isDuplicate(1000);
    expect(isDuplicate(1000)).toBe(true);
  });

  test('higher update_id after a stored one is not a duplicate', () => {
    isDuplicate(1000);
    expect(isDuplicate(1001)).toBe(false);
  });

  test('lower update_id than stored is treated as duplicate', () => {
    isDuplicate(1000);
    expect(isDuplicate(999)).toBe(true);
  });
});
