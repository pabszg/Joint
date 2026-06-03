// src/Setup.js
// Run setupSpreadsheet() once from the Apps Script editor to initialize the workbook.

var SHEET_NAMES = {
  EXPENSES: 'Expenses',
  BUDGETS: 'Budgets',
  CATEGORIES: 'Categories',
  CORRECTIONS: 'Corrections',
  DASHBOARD: 'Dashboard',
  REPORTS: 'Reports',
  CONFIG: 'Config',
  ITEMS: 'Items'
};

var EXPENSE_HEADERS = [
  'ID', 'Date', 'Merchant', 'Amount', 'Currency',
  'EUR Amount', 'Category', 'Person', 'Notes', 'Has Items', 'Receipt URL'
];

var BUDGET_HEADERS = ['Category', 'Monthly Limit (EUR)', 'Alert Threshold %'];

var CATEGORY_HEADERS = ['Category', 'Emoji', 'Active'];

var CORRECTION_HEADERS = ['Timestamp', 'Merchant', 'Gemini Guess', 'User Correction', 'Confidence at Time'];

var ITEMS_HEADERS = ['Expense ID', 'Item Name', 'Quantity', 'Unit Price', 'Category Override'];

var CONFIG_HEADERS = ['Key', 'Value'];

var SEED_CATEGORIES = [
  ['Rent', '🏠', true],
  ['Groceries', '🛒', true],
  ['Dining out', '🍽️', true],
  ['Delivery', '🛵', true],
  ['Transport', '🚗', true],
  ['Health', '💊', true],
  ['Clothing', '👗', true],
  ['Entertainment', '🎬', true],
  ['Subscriptions', '📱', true],
  ['Home & Cleaning', '🧹', true],
  ['Travel', '✈️', true],
  ['Learning', '📚', true],
  ['Savings', '💰', true],
  ['Other', '🔧', true],
  ['Fees & Banking', '🏦', true]
];

var SEED_BUDGETS = [
  ['Rent', 900, 80],
  ['Groceries', 300, 80],
  ['Dining out', 150, 80],
  ['Delivery', 80, 80],
  ['Transport', 100, 80],
  ['Health', 100, 80],
  ['Clothing', 100, 80],
  ['Entertainment', 80, 80],
  ['Subscriptions', 50, 80],
  ['Home & Cleaning', 60, 80],
  ['Travel', 200, 80],
  ['Learning', 80, 80],
  ['Savings', 200, 80],
  ['Other', 50, 80],
  ['Fees & Banking', 30, 80]
];

var SEED_CONFIG = [
  ['User1Name', 'Pablo'],
  ['User1TelegramID', ''],
  ['User2Name', 'Partner'],
  ['User2TelegramID', ''],
  ['BaseCurrency', 'EUR'],
  ['GeminiAPIKey', ''],
  ['TelegramBotToken', ''],
  ['DriveFolderID', ''],
  ['ReportDayOfMonth', '1'],
  ['DefaultAlertThreshold', '80']
];

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function setHeaders(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function setupSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var expenses = getOrCreateSheet(ss, SHEET_NAMES.EXPENSES);
  setHeaders(expenses, EXPENSE_HEADERS);

  var items = getOrCreateSheet(ss, SHEET_NAMES.ITEMS);
  setHeaders(items, ITEMS_HEADERS);

  var budgets = getOrCreateSheet(ss, SHEET_NAMES.BUDGETS);
  setHeaders(budgets, BUDGET_HEADERS);
  if (budgets.getLastRow() <= 1) {
    budgets.getRange(2, 1, SEED_BUDGETS.length, 3).setValues(SEED_BUDGETS);
  }

  var categories = getOrCreateSheet(ss, SHEET_NAMES.CATEGORIES);
  setHeaders(categories, CATEGORY_HEADERS);
  if (categories.getLastRow() <= 1) {
    categories.getRange(2, 1, SEED_CATEGORIES.length, 3).setValues(SEED_CATEGORIES);
  }

  var corrections = getOrCreateSheet(ss, SHEET_NAMES.CORRECTIONS);
  setHeaders(corrections, CORRECTION_HEADERS);

  getOrCreateSheet(ss, SHEET_NAMES.DASHBOARD);
  getOrCreateSheet(ss, SHEET_NAMES.REPORTS);

  var config = getOrCreateSheet(ss, SHEET_NAMES.CONFIG);
  setHeaders(config, CONFIG_HEADERS);
  if (config.getLastRow() <= 1) {
    config.getRange(2, 1, SEED_CONFIG.length, 2).setValues(SEED_CONFIG);
  }

  // Install time-based triggers (weekly digest + monthly report)
  try {
    installTriggers();
  } catch (e) {
    Logger.log('Note: Could not install triggers automatically: ' + e.message);
    Logger.log('Run installTriggers() manually from the Triggers.gs file.');
  }

  Logger.log('Setup complete. Fill in Config tab with your API keys and Telegram IDs.');
}

/**
 * Call this from the Apps Script editor after deploying as a Web App.
 * Paste your Web App URL and Bot Token in the Config sheet first.
 * Run once to register the Telegram webhook.
 */
function setWebhook() {
  var config = getConfig();
  var url = 'https://api.telegram.org/bot' + config.telegramBotToken + '/setWebhook';
  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ url: ScriptApp.getService().getUrl() }),
    muteHttpExceptions: true
  });
  var result = JSON.parse(response.getContentText());
  Logger.log(result.ok ? 'Webhook set successfully.' : 'Failed: ' + JSON.stringify(result));
}

function deleteWebhook() {
  var config = getConfig();
  var response = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + config.telegramBotToken + '/deleteWebhook',
    { method: 'post', muteHttpExceptions: true }
  );
  Logger.log(JSON.parse(response.getContentText()));
}
