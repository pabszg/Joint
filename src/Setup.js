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
  ['Alquiler', '🏠', true],
  ['Supermercado', '🛒', true],
  ['Restaurantes', '🍽️', true],
  ['Delivery', '🛵', true],
  ['Transporte', '🚗', true],
  ['Salud', '💊', true],
  ['Ropa', '👗', true],
  ['Entretenimiento', '🎬', true],
  ['Suscripciones', '📱', true],
  ['Hogar y Limpieza', '🧹', true],
  ['Viajes', '✈️', true],
  ['Formación', '📚', true],
  ['Ahorros', '💰', true],
  ['Otros', '🔧', true],
  ['Comisiones y Banco', '🏦', true]
];

var SEED_BUDGETS = [
  ['Alquiler', 900, 80],
  ['Supermercado', 300, 80],
  ['Restaurantes', 150, 80],
  ['Delivery', 80, 80],
  ['Transporte', 100, 80],
  ['Salud', 100, 80],
  ['Ropa', 100, 80],
  ['Entretenimiento', 80, 80],
  ['Suscripciones', 50, 80],
  ['Hogar y Limpieza', 60, 80],
  ['Viajes', 200, 80],
  ['Formación', 80, 80],
  ['Ahorros', 200, 80],
  ['Otros', 50, 80],
  ['Comisiones y Banco', 30, 80]
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

/**
 * Step 1: Edit YOUR_SHEET_ID below, then run this function once from the editor.
 * Get the ID from your Sheet URL: docs.google.com/spreadsheets/d/YOUR_ID_HERE/edit
 */
function configureBot() {
  var SHEET_ID = '1B-pmYDAjfojW7q8kUhY3IA1lLCWAPgAFTfp48xvnPpE'; // ← paste your Sheet ID here
  if (SHEET_ID === 'YOUR_SHEET_ID') {
    throw new Error('Please replace YOUR_SHEET_ID in configureBot() before running.');
  }
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', SHEET_ID);
  Logger.log('Spreadsheet ID saved: ' + SHEET_ID);
}

// Keep the parameterised version for programmatic use
function setSpreadsheetId(id) {
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', id);
  Logger.log('Spreadsheet ID saved: ' + id);
}

function setupSpreadsheet() {
  var ss = getSpreadsheet();

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
 * Step 5: Paste your Web App URL below, then run this once to register the Telegram webhook.
 * Get the URL from: Deploy → Manage deployments → copy the Web app URL.
 */
function setWebhook() {
  var WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyXcikz6OnWishTySk8UosQJl59VKzgu2SKUnJVSyWraqdi78AHeLigf9a_Olk5mhtgZQ/exec';

  var config = getConfig();
  if (!config.telegramBotToken) {
    throw new Error('TelegramBotToken is empty in the Config sheet.');
  }

  var apiUrl = 'https://api.telegram.org/bot' + config.telegramBotToken + '/setWebhook';
  var response = UrlFetchApp.fetch(apiUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ url: WEB_APP_URL }),
    muteHttpExceptions: true
  });
  var result = JSON.parse(response.getContentText());
  Logger.log(result.ok ? 'Webhook set: ' + WEB_APP_URL : 'Failed: ' + JSON.stringify(result));
}

/**
 * Run this from the Apps Script editor if the bot stops responding to all messages.
 * This resets the deduplication state so the next incoming update is processed fresh.
 * After resetting, Telegram may retry the last update — this is harmless but expected.
 */
function resetDeduplication() {
  PropertiesService.getScriptProperties().deleteProperty(DEDUP_PROPERTY_KEY);
  Logger.log('Deduplication state reset. The next Telegram update will be processed.');
}

function deleteWebhook() {
  var config = getConfig();
  var response = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + config.telegramBotToken + '/deleteWebhook',
    { method: 'post', muteHttpExceptions: true }
  );
  Logger.log(JSON.parse(response.getContentText()));
}
