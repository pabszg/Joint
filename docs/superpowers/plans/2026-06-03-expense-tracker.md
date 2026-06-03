# Expense Tracker for Couples — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Telegram bot for couples to track shared expenses using Google Apps Script as the backend, Gemini AI for receipt OCR and expense classification, Google Sheets as the database and dashboard, and Google Drive for receipt image storage.

**Architecture:** Apps Script serves as a webhook endpoint (`doPost`); all business logic lives in focused service modules sharing global scope (Apps Script convention); Gemini API handles both text and image expense parsing, returning structured JSON; PropertiesService stores ephemeral conversation state between stateless webhook calls; reinforcement learning is implemented via few-shot correction examples injected into every Gemini prompt.

**Tech Stack:** Google Apps Script, clasp (local development + push), Telegram Bot API, Gemini API (`gemini-2.0-flash`), Google Sheets (SpreadsheetApp), Google Drive (DriveApp), Jest + Node.js (local unit tests)

---

## File Map

| File | Role |
|------|------|
| `src/Config.js` | Reads Config sheet tab; returns typed settings object |
| `src/StateService.js` | Wraps PropertiesService; get/set/clear conversation state per chat_id |
| `src/TelegramService.js` | Telegram Bot API: sendMessage, sendConfirmation, answerCallbackQuery, getFile |
| `src/GeminiService.js` | Builds system prompt (with corrections), calls Gemini API, parses JSON response |
| `src/SheetsService.js` | CRUD for all Sheets tabs: appendExpense, getMonthExpenses, getBudgets, appendCorrection, getCorrections, getCategories |
| `src/DriveService.js` | Downloads Telegram file by file_id, saves base64 to Google Drive, returns shareable URL |
| `src/BudgetService.js` | Pure functions: checkBudget(category, spend, budgets), formatBudgetAlert, formatBudgetStatus |
| `src/ReportService.js` | Pure functions: buildWeeklyDigest(expenses, budgets), buildMonthlyReport(expenses, budgets) |
| `src/Webhook.js` | doPost entry point; routes Telegram updates; implements all conversation flows |
| `src/Triggers.js` | installTriggers(), sendWeeklyDigest(), sendMonthlyReport() — called by time-based triggers |
| `src/Setup.js` | One-time script: creates all 8 Sheets tabs with headers and seed data |
| `tests/setup.js` | Jest global setup — mocks all Apps Script globals |
| `tests/BudgetService.test.js` | Unit tests for budget logic |
| `tests/ReportService.test.js` | Unit tests for report formatting |
| `tests/GeminiService.test.js` | Unit tests for prompt builder and response parser |
| `tests/Webhook.test.js` | Unit tests for routing and conversation flow logic |
| `jest.config.js` | Jest config: node env, setupFilesAfterEnv |
| `package.json` | Dev deps: jest, @google/clasp |
| `.clasp.json` | Clasp config pointing to src/ |
| `appsscript.json` | Apps Script manifest (webapp, timezone, runtime) |

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `jest.config.js`
- Create: `.clasp.json`
- Create: `appsscript.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install clasp globally and initialize the project**

```bash
npm install -g @google/clasp
npm init -y
npm install --save-dev jest
```

- [ ] **Step 2: Create `package.json` test script**

Replace the generated `package.json` with:

```json
{
  "name": "expense-tracker",
  "version": "1.0.0",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "push": "clasp push",
    "pull": "clasp pull"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "@google/clasp": "^2.4.2"
  }
}
```

- [ ] **Step 3: Create `jest.config.js`**

```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  moduleFileExtensions: ['js', 'json']
};
```

- [ ] **Step 4: Create `appsscript.json`**

```json
{
  "timeZone": "Europe/Madrid",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

- [ ] **Step 5: Log in to clasp and create the Apps Script project**

```bash
clasp login
clasp create --title "Expense Tracker" --type webapp --rootDir src
```

This creates a new Apps Script project and writes `.clasp.json`. Verify it contains a `scriptId`.

- [ ] **Step 6: Create `src/` directory and move `appsscript.json` into it**

```bash
mkdir -p src tests/
mv appsscript.json src/
```

- [ ] **Step 7: Update `.gitignore`**

Add to existing `.gitignore`:

```
node_modules/
.clasp.json
```

> Note: `.clasp.json` contains the `scriptId` which is not a secret, but exclude it to avoid accidentally pushing it to a public repo. Store the scriptId somewhere safe (e.g., in a private note).

- [ ] **Step 8: Commit**

```bash
git add package.json jest.config.js src/appsscript.json .gitignore
git commit -m "feat: add project scaffolding — clasp, jest, appsscript manifest"
```

---

## Task 2: Test Mocks for Apps Script Globals

**Files:**
- Create: `tests/setup.js`

Apps Script globals (`SpreadsheetApp`, `PropertiesService`, etc.) don't exist in Node.js. This task creates mock versions so tests can `require()` source files without crashing.

- [ ] **Step 1: Create `tests/setup.js`**

```javascript
// tests/setup.js
// Mock all Apps Script globals used by the source files.
// Tests override individual methods with jest.fn() as needed.

const mockSheet = {
  getLastRow: jest.fn().mockReturnValue(1),
  appendRow: jest.fn(),
  getDataRange: jest.fn().mockReturnValue({
    getValues: jest.fn().mockReturnValue([])
  }),
  getRange: jest.fn().mockReturnValue({
    getValues: jest.fn().mockReturnValue([[]]),
    setValue: jest.fn(),
    setValues: jest.fn()
  }),
  getName: jest.fn().mockReturnValue('Expenses')
};

const mockSpreadsheet = {
  getSheetByName: jest.fn().mockReturnValue(mockSheet),
  insertSheet: jest.fn().mockReturnValue(mockSheet),
  getSheets: jest.fn().mockReturnValue([mockSheet])
};

global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn().mockReturnValue(mockSpreadsheet),
  openById: jest.fn().mockReturnValue(mockSpreadsheet)
};

const mockProperties = {};
global.PropertiesService = {
  getUserProperties: jest.fn().mockReturnValue({
    getProperty: jest.fn((key) => mockProperties[key] || null),
    setProperty: jest.fn((key, value) => { mockProperties[key] = value; }),
    deleteProperty: jest.fn((key) => { delete mockProperties[key]; })
  })
};

global.UrlFetchApp = {
  fetch: jest.fn().mockReturnValue({
    getContentText: jest.fn().mockReturnValue('{}'),
    getContent: jest.fn().mockReturnValue([])
  })
};

global.DriveApp = {
  getFolderById: jest.fn().mockReturnValue({
    createFolder: jest.fn().mockReturnValue({
      getId: jest.fn().mockReturnValue('folder-id'),
      createFile: jest.fn().mockReturnValue({
        getId: jest.fn().mockReturnValue('file-id'),
        setSharing: jest.fn().mockReturnThis()
      }),
      getFoldersByName: jest.fn().mockReturnValue({ hasNext: jest.fn().mockReturnValue(false) })
    }),
    getFoldersByName: jest.fn().mockReturnValue({ hasNext: jest.fn().mockReturnValue(false) })
  }),
  Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
  Permission: { VIEW: 'VIEW' }
};

global.Utilities = {
  base64Encode: jest.fn((data) => Buffer.from(data).toString('base64')),
  newBlob: jest.fn((data, mimeType, name) => ({ data, mimeType, name }))
};

global.ContentService = {
  createTextOutput: jest.fn().mockReturnValue({
    setMimeType: jest.fn().mockReturnThis()
  }),
  MimeType: { JSON: 'application/json' }
};

global.Logger = {
  log: jest.fn()
};

global.ScriptApp = {
  getService: jest.fn().mockReturnValue({
    getUrl: jest.fn().mockReturnValue('https://script.google.com/macros/s/test/exec')
  }),
  newTrigger: jest.fn().mockReturnValue({
    timeBased: jest.fn().mockReturnThis(),
    everyWeeks: jest.fn().mockReturnThis(),
    onWeekDay: jest.fn().mockReturnThis(),
    atHour: jest.fn().mockReturnThis(),
    nearMinute: jest.fn().mockReturnThis(),
    everyDays: jest.fn().mockReturnThis(),
    create: jest.fn()
  }),
  getProjectTriggers: jest.fn().mockReturnValue([]),
  deleteTrigger: jest.fn(),
  WeekDay: { SUNDAY: 1, MONDAY: 2 }
};
```

- [ ] **Step 2: Verify setup loads without errors**

```bash
npx jest --listTests
```

Expected output: `(no test files found)` — that's fine, we just want no crash.

- [ ] **Step 3: Commit**

```bash
git add tests/setup.js
git commit -m "test: add Apps Script global mocks for Jest"
```

---

## Task 3: Sheet Initializer (One-Time Setup)

**Files:**
- Create: `src/Setup.js`

This script is run once from the Apps Script editor to create all 8 tabs with correct headers and seed the Config, Categories, and Budgets tabs.

- [ ] **Step 1: Create `src/Setup.js`**

```javascript
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

  Logger.log('Setup complete. Fill in Config tab with your API keys and Telegram IDs.');
}
```

- [ ] **Step 2: Push to Apps Script and run setup**

```bash
npm run push
```

Then in the Apps Script editor: open `Setup.gs`, select `setupSpreadsheet`, and click **Run**. Verify all 8 tabs appear in the connected Google Sheet.

- [ ] **Step 3: Commit**

```bash
git add src/Setup.js
git commit -m "feat: add one-time sheet initializer with seed data"
```

---

## Task 4: Config Module

**Files:**
- Create: `src/Config.js`

Reads the Config sheet tab and returns a typed settings object. All other modules call `getConfig()` — it's the single source of truth.

- [ ] **Step 1: Create `src/Config.js`**

```javascript
// src/Config.js

function getConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Config');
  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < data.length; i++) {
    var key = data[i][0];
    var value = data[i][1];
    if (key) config[key] = value;
  }
  return {
    user1Name: config['User1Name'] || 'User1',
    user1TelegramId: String(config['User1TelegramID'] || ''),
    user2Name: config['User2Name'] || 'User2',
    user2TelegramId: String(config['User2TelegramID'] || ''),
    baseCurrency: config['BaseCurrency'] || 'EUR',
    geminiApiKey: config['GeminiAPIKey'] || '',
    telegramBotToken: config['TelegramBotToken'] || '',
    driveFolderId: config['DriveFolderID'] || '',
    reportDayOfMonth: parseInt(config['ReportDayOfMonth'] || '1', 10),
    defaultAlertThreshold: parseInt(config['DefaultAlertThreshold'] || '80', 10)
  };
}

function getPersonName(telegramId, config) {
  var id = String(telegramId);
  if (id === config.user1TelegramId) return config.user1Name;
  if (id === config.user2TelegramId) return config.user2Name;
  return 'Unknown';
}

if (typeof module !== 'undefined') {
  module.exports = { getConfig, getPersonName };
}
```

- [ ] **Step 2: Write the test**

Create `tests/Config.test.js`:

```javascript
// tests/Config.test.js

// Arrange mock sheet data
beforeEach(() => {
  const mockData = [
    ['Key', 'Value'],
    ['User1Name', 'Pablo'],
    ['User1TelegramID', '111'],
    ['User2Name', 'Ana'],
    ['User2TelegramID', '222'],
    ['BaseCurrency', 'EUR'],
    ['GeminiAPIKey', 'test-key'],
    ['TelegramBotToken', 'bot-token'],
    ['DriveFolderID', 'drive-id'],
    ['ReportDayOfMonth', '1'],
    ['DefaultAlertThreshold', '80']
  ];
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName.mockReturnValue({
    getDataRange: () => ({ getValues: () => mockData })
  });
});

const { getConfig, getPersonName } = require('../src/Config');

test('getConfig returns correctly typed settings', () => {
  const config = getConfig();
  expect(config.user1Name).toBe('Pablo');
  expect(config.user1TelegramId).toBe('111');
  expect(config.geminiApiKey).toBe('test-key');
  expect(config.reportDayOfMonth).toBe(1);
  expect(config.defaultAlertThreshold).toBe(80);
});

test('getPersonName returns name for user1', () => {
  const config = getConfig();
  expect(getPersonName('111', config)).toBe('Pablo');
});

test('getPersonName returns name for user2', () => {
  const config = getConfig();
  expect(getPersonName('222', config)).toBe('Ana');
});

test('getPersonName returns Unknown for unrecognised ID', () => {
  const config = getConfig();
  expect(getPersonName('999', config)).toBe('Unknown');
});
```

- [ ] **Step 3: Run test — expect FAIL**

```bash
npx jest tests/Config.test.js
```

Expected: FAIL — `getConfig is not a function`

- [ ] **Step 4: Run test again after confirming file is in place**

```bash
npx jest tests/Config.test.js
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/Config.js tests/Config.test.js
git commit -m "feat: add Config module with getConfig and getPersonName"
```

---

## Task 5: StateService

**Files:**
- Create: `src/StateService.js`
- Create: `tests/StateService.test.js`

Manages ephemeral conversation state between stateless webhook calls. State is keyed by Telegram `chat_id` and expires after 10 minutes.

- [ ] **Step 1: Write the failing test**

Create `tests/StateService.test.js`:

```javascript
// tests/StateService.test.js

let storedProperties = {};

beforeEach(() => {
  storedProperties = {};
  PropertiesService.getUserProperties.mockReturnValue({
    getProperty: jest.fn((key) => storedProperties[key] || null),
    setProperty: jest.fn((key, value) => { storedProperties[key] = value; }),
    deleteProperty: jest.fn((key) => { delete storedProperties[key]; })
  });
});

const { getState, setState, clearState } = require('../src/StateService');

test('setState stores serialized state', () => {
  const state = { action: 'awaiting_confirmation', expense: { merchant: 'Zara' } };
  setState(123, state);
  const stored = JSON.parse(storedProperties['state_123']);
  expect(stored.data.action).toBe('awaiting_confirmation');
  expect(stored.data.expense.merchant).toBe('Zara');
});

test('getState returns null when no state stored', () => {
  expect(getState(123)).toBeNull();
});

test('getState returns stored state data', () => {
  const state = { action: 'awaiting_edit_field' };
  setState(123, state);
  expect(getState(123)).toMatchObject(state);
});

test('getState returns null when state is expired', () => {
  const expired = JSON.stringify({ data: { action: 'old' }, expiresAt: Date.now() - 1000 });
  storedProperties['state_123'] = expired;
  expect(getState(123)).toBeNull();
});

test('clearState removes the stored property', () => {
  setState(123, { action: 'awaiting_confirmation' });
  clearState(123);
  expect(storedProperties['state_123']).toBeUndefined();
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/StateService.test.js
```

Expected: FAIL — `getState is not a function`

- [ ] **Step 3: Create `src/StateService.js`**

```javascript
// src/StateService.js

var STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getState(chatId) {
  var props = PropertiesService.getUserProperties();
  var raw = props.getProperty('state_' + chatId);
  if (!raw) return null;
  var stored = JSON.parse(raw);
  if (Date.now() > stored.expiresAt) {
    props.deleteProperty('state_' + chatId);
    return null;
  }
  return stored.data;
}

function setState(chatId, data) {
  var props = PropertiesService.getUserProperties();
  var stored = {
    data: data,
    expiresAt: Date.now() + STATE_TTL_MS
  };
  props.setProperty('state_' + chatId, JSON.stringify(stored));
}

function clearState(chatId) {
  PropertiesService.getUserProperties().deleteProperty('state_' + chatId);
}

if (typeof module !== 'undefined') {
  module.exports = { getState, setState, clearState };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/StateService.test.js
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/StateService.js tests/StateService.test.js
git commit -m "feat: add StateService for ephemeral conversation state"
```

---

## Task 6: TelegramService

**Files:**
- Create: `src/TelegramService.js`

Wraps all Telegram Bot API calls. All outbound messaging goes through this module.

- [ ] **Step 1: Create `src/TelegramService.js`**

```javascript
// src/TelegramService.js

function telegramApiUrl(token, method) {
  return 'https://api.telegram.org/bot' + token + '/' + method;
}

function telegramPost(token, method, payload) {
  var response = UrlFetchApp.fetch(telegramApiUrl(token, method), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  return JSON.parse(response.getContentText());
}

function sendMessage(token, chatId, text) {
  return telegramPost(token, 'sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  });
}

function sendConfirmation(token, chatId, text, expense) {
  var keyboard = {
    inline_keyboard: [[
      { text: '✅ Confirm', callback_data: 'confirm' },
      { text: '✏️ Edit', callback_data: 'edit' },
      { text: '❌ Cancel', callback_data: 'cancel' }
    ]]
  };
  return telegramPost(token, 'sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: JSON.stringify(keyboard)
  });
}

function sendEditFieldMenu(token, chatId) {
  var keyboard = {
    inline_keyboard: [[
      { text: 'Merchant', callback_data: 'edit_merchant' },
      { text: 'Amount', callback_data: 'edit_amount' }
    ], [
      { text: 'Category', callback_data: 'edit_category' },
      { text: 'Date', callback_data: 'edit_date' }
    ]]
  };
  return telegramPost(token, 'sendMessage', {
    chat_id: chatId,
    text: 'Which field do you want to edit?',
    reply_markup: JSON.stringify(keyboard)
  });
}

function answerCallbackQuery(token, callbackQueryId, text) {
  return telegramPost(token, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text || ''
  });
}

function getFilePath(token, fileId) {
  var response = telegramPost(token, 'getFile', { file_id: fileId });
  if (!response.ok) return null;
  return response.result.file_path;
}

function downloadFile(token, filePath) {
  var url = 'https://api.telegram.org/file/bot' + token + '/' + filePath;
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  return response.getContent(); // returns byte array
}

function formatExpenseConfirmation(expense) {
  return [
    '🧾 <b>Expense parsed:</b>',
    'Merchant: ' + expense.merchant,
    'Amount: ' + formatAmount(expense.amount, expense.currency),
    'Category: ' + getCategoryEmoji(expense.category) + ' ' + expense.category,
    'Date: ' + expense.date,
    expense.receiptUrl ? 'Receipt saved to Drive ✓' : ''
  ].filter(Boolean).join('\n');
}

function formatAmount(amount, currency) {
  var symbol = currency === 'EUR' ? '€' : currency;
  return symbol + parseFloat(amount).toFixed(2);
}

function getCategoryEmoji(category) {
  var emojis = {
    'Rent': '🏠', 'Groceries': '🛒', 'Dining out': '🍽️', 'Delivery': '🛵',
    'Transport': '🚗', 'Health': '💊', 'Clothing': '👗', 'Entertainment': '🎬',
    'Subscriptions': '📱', 'Home & Cleaning': '🧹', 'Travel': '✈️',
    'Learning': '📚', 'Savings': '💰', 'Other': '🔧', 'Fees & Banking': '🏦'
  };
  return emojis[category] || '📌';
}

if (typeof module !== 'undefined') {
  module.exports = {
    sendMessage, sendConfirmation, sendEditFieldMenu,
    answerCallbackQuery, getFilePath, downloadFile,
    formatExpenseConfirmation, formatAmount, getCategoryEmoji
  };
}
```

- [ ] **Step 2: Write tests for pure formatting functions**

Create `tests/TelegramService.test.js`:

```javascript
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
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
npx jest tests/TelegramService.test.js
```

Expected: PASS — 5 tests

- [ ] **Step 4: Commit**

```bash
git add src/TelegramService.js tests/TelegramService.test.js
git commit -m "feat: add TelegramService for bot API calls and message formatting"
```

---

## Task 7: GeminiService

**Files:**
- Create: `src/GeminiService.js`
- Create: `tests/GeminiService.test.js`

Builds the Gemini system prompt (injecting corrections for few-shot learning), calls the API, and parses the JSON response.

- [ ] **Step 1: Write the failing tests**

Create `tests/GeminiService.test.js`:

```javascript
// tests/GeminiService.test.js
const { buildSystemPrompt, parseGeminiResponse, isLowConfidence } = require('../src/GeminiService');

const CATEGORIES = [
  'Rent','Groceries','Dining out','Delivery','Transport','Health',
  'Clothing','Entertainment','Subscriptions','Home & Cleaning',
  'Travel','Learning','Savings','Other','Fees & Banking'
];

test('buildSystemPrompt includes all categories', () => {
  const prompt = buildSystemPrompt(CATEGORIES, [], '2026-06-03');
  CATEGORIES.forEach(cat => expect(prompt).toContain(cat));
});

test('buildSystemPrompt includes today date', () => {
  const prompt = buildSystemPrompt(CATEGORIES, [], '2026-06-03');
  expect(prompt).toContain('2026-06-03');
});

test('buildSystemPrompt injects corrections as few-shot examples', () => {
  const corrections = [
    { merchant: 'Mercadona', geminiGuess: 'Dining out', userCorrection: 'Groceries' }
  ];
  const prompt = buildSystemPrompt(CATEGORIES, corrections, '2026-06-03');
  expect(prompt).toContain('Mercadona');
  expect(prompt).toContain('Groceries');
  expect(prompt).toContain('Dining out');
});

test('parseGeminiResponse extracts structured expense', () => {
  const raw = JSON.stringify({
    candidates: [{
      content: { parts: [{ text: JSON.stringify({
        merchant: 'Mercadona', amount: 47.30, currency: 'EUR',
        date: '2026-06-03', category: 'Groceries', notes: '',
        confidence: 0.97, has_items: false, items: []
      })}] }
    }]
  });
  UrlFetchApp.fetch.mockReturnValueOnce({ getContentText: () => raw });
  // parseGeminiResponse is a pure extraction from an already-fetched response text
  const parsed = parseGeminiResponse(raw);
  expect(parsed.merchant).toBe('Mercadona');
  expect(parsed.amount).toBe(47.30);
  expect(parsed.confidence).toBe(0.97);
});

test('isLowConfidence returns true below 0.7', () => {
  expect(isLowConfidence(0.65)).toBe(true);
  expect(isLowConfidence(0.69)).toBe(true);
});

test('isLowConfidence returns false at 0.7 or above', () => {
  expect(isLowConfidence(0.7)).toBe(false);
  expect(isLowConfidence(0.97)).toBe(false);
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/GeminiService.test.js
```

Expected: FAIL — `buildSystemPrompt is not a function`

- [ ] **Step 3: Create `src/GeminiService.js`**

```javascript
// src/GeminiService.js

var GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function buildSystemPrompt(categories, corrections, today) {
  var categoryList = categories.join(', ');

  var correctionsBlock = '';
  if (corrections.length > 0) {
    var examples = corrections.map(function(c) {
      return '- "' + c.merchant + '" → ' + c.userCorrection + ' (not ' + c.geminiGuess + ')';
    }).join('\n');
    correctionsBlock = '\n\nLearned corrections from this couple — prefer these:\n' + examples;
  }

  return [
    'You are an expense parser for a couple\'s shared expense tracker.',
    'Today\'s date is ' + today + '.',
    '',
    'Extract expense data from the user\'s message or receipt image.',
    'Return ONLY valid JSON matching this exact schema — no markdown, no explanation:',
    '{',
    '  "merchant": string,',
    '  "amount": number (no currency symbols),',
    '  "currency": string (ISO 4217, default "EUR"),',
    '  "date": string (ISO 8601, default today),',
    '  "category": string (MUST be one of the categories below),',
    '  "notes": string (empty string if none),',
    '  "confidence": number (0.0 to 1.0),',
    '  "has_items": boolean,',
    '  "items": []',
    '}',
    '',
    'Categories (use EXACTLY these names):',
    categoryList,
    correctionsBlock
  ].join('\n');
}

function parseGeminiResponse(responseText) {
  var result = JSON.parse(responseText);
  var content = result.candidates[0].content.parts[0].text;
  // Strip markdown code blocks if present
  var cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

function isLowConfidence(confidence) {
  return confidence < 0.7;
}

function classifyExpense(text, categories, corrections, apiKey) {
  var today = new Date().toISOString().split('T')[0];
  var prompt = buildSystemPrompt(categories, corrections, today);

  var payload = {
    contents: [{ role: 'user', parts: [{ text: prompt + '\n\nUser message: ' + text }] }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  var response = UrlFetchApp.fetch(GEMINI_API_BASE + '?key=' + apiKey, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  return parseGeminiResponse(response.getContentText());
}

function classifyReceipt(imageBase64, mimeType, categories, corrections, apiKey) {
  var today = new Date().toISOString().split('T')[0];
  var prompt = buildSystemPrompt(categories, corrections, today);
  prompt += '\n\nExtract expense data from this receipt image.';

  var payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
      ]
    }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  var response = UrlFetchApp.fetch(GEMINI_API_BASE + '?key=' + apiKey, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  return parseGeminiResponse(response.getContentText());
}

if (typeof module !== 'undefined') {
  module.exports = { buildSystemPrompt, parseGeminiResponse, isLowConfidence, classifyExpense, classifyReceipt };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/GeminiService.test.js
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/GeminiService.js tests/GeminiService.test.js
git commit -m "feat: add GeminiService with few-shot prompt builder and receipt OCR"
```

---

## Task 8: SheetsService

**Files:**
- Create: `src/SheetsService.js`

All Google Sheets read/write operations. Business logic modules call these functions instead of touching SpreadsheetApp directly.

- [ ] **Step 1: Create `src/SheetsService.js`**

```javascript
// src/SheetsService.js

// Column indices for Expenses tab (0-based)
var EXP_COLS = {
  ID: 0, DATE: 1, MERCHANT: 2, AMOUNT: 3, CURRENCY: 4,
  EUR_AMOUNT: 5, CATEGORY: 6, PERSON: 7, NOTES: 8,
  HAS_ITEMS: 9, RECEIPT_URL: 10
};

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function generateExpenseId() {
  var sheet = getSheet('Expenses');
  var nextNum = sheet.getLastRow(); // row 1 = header, lastRow=1 means 0 expenses → next is EXP-001
  return 'EXP-' + String(nextNum).padStart(3, '0');
}

function appendExpense(expense) {
  var sheet = getSheet('Expenses');
  var id = generateExpenseId();
  var row = [
    id,
    expense.date,
    expense.merchant,
    expense.amount,
    expense.currency,
    expense.eurAmount,
    expense.category,
    expense.person,
    expense.notes || '',
    expense.hasItems || false,
    expense.receiptUrl || ''
  ];
  sheet.appendRow(row);
  return id;
}

function getMonthExpenses(year, month) {
  var sheet = getSheet('Expenses');
  var data = sheet.getDataRange().getValues();
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[EXP_COLS.DATE]) continue;
    var d = new Date(row[EXP_COLS.DATE]);
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      results.push({
        id: row[EXP_COLS.ID],
        date: row[EXP_COLS.DATE],
        merchant: row[EXP_COLS.MERCHANT],
        amount: parseFloat(row[EXP_COLS.AMOUNT]) || 0,
        currency: row[EXP_COLS.CURRENCY],
        eurAmount: parseFloat(row[EXP_COLS.EUR_AMOUNT]) || 0,
        category: row[EXP_COLS.CATEGORY],
        person: row[EXP_COLS.PERSON],
        notes: row[EXP_COLS.NOTES],
        hasItems: row[EXP_COLS.HAS_ITEMS],
        receiptUrl: row[EXP_COLS.RECEIPT_URL]
      });
    }
  }
  return results;
}

function getWeekExpenses() {
  var sheet = getSheet('Expenses');
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[EXP_COLS.DATE]) continue;
    var d = new Date(row[EXP_COLS.DATE]);
    if (d >= weekAgo && d <= now) {
      results.push({
        eurAmount: parseFloat(row[EXP_COLS.EUR_AMOUNT]) || 0,
        category: row[EXP_COLS.CATEGORY],
        person: row[EXP_COLS.PERSON]
      });
    }
  }
  return results;
}

function getCategoryMonthSpend(category, year, month) {
  var expenses = getMonthExpenses(year, month);
  return expenses
    .filter(function(e) { return e.category === category; })
    .reduce(function(sum, e) { return sum + e.eurAmount; }, 0);
}

function getBudgets() {
  var sheet = getSheet('Budgets');
  var data = sheet.getDataRange().getValues();
  var results = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    results.push({
      category: row[0],
      limit: parseFloat(row[1]) || 0,
      alertThreshold: parseFloat(row[2]) || 80
    });
  }
  return results;
}

function getCategories() {
  var sheet = getSheet('Categories');
  var data = sheet.getDataRange().getValues();
  var results = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][2] !== false) { // Active column
      results.push(data[i][0]);
    }
  }
  return results;
}

function getCorrections(limit) {
  var sheet = getSheet('Corrections');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var dataRows = lastRow - 1;
  var startRow = Math.max(2, lastRow - (limit || 20) + 1);
  var numRows = lastRow - startRow + 1;
  var data = sheet.getRange(startRow, 1, numRows, 5).getValues();
  return data.map(function(row) {
    return {
      timestamp: row[0],
      merchant: row[1],
      geminiGuess: row[2],
      userCorrection: row[3],
      confidence: parseFloat(row[4]) || 0
    };
  }).filter(function(c) { return c.merchant; });
}

function appendCorrection(merchant, geminiGuess, userCorrection, confidence) {
  var sheet = getSheet('Corrections');
  sheet.appendRow([new Date().toISOString(), merchant, geminiGuess, userCorrection, confidence]);
}

if (typeof module !== 'undefined') {
  module.exports = {
    appendExpense, getMonthExpenses, getWeekExpenses,
    getCategoryMonthSpend, getBudgets, getCategories,
    getCorrections, appendCorrection, generateExpenseId
  };
}
```

- [ ] **Step 2: Write tests for pure-logic functions**

Create `tests/SheetsService.test.js`:

```javascript
// tests/SheetsService.test.js

const { generateExpenseId } = require('../src/SheetsService');

describe('generateExpenseId', () => {
  test('returns EXP-001 when sheet has only header row', () => {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName.mockReturnValue({
      getLastRow: jest.fn().mockReturnValue(1)
    });
    expect(generateExpenseId()).toBe('EXP-001');
  });

  test('returns EXP-005 when sheet has 5 rows including header', () => {
    SpreadsheetApp.getActiveSpreadsheet().getSheetByName.mockReturnValue({
      getLastRow: jest.fn().mockReturnValue(5)
    });
    expect(generateExpenseId()).toBe('EXP-005');
  });
});
```

- [ ] **Step 3: Run test — expect PASS**

```bash
npx jest tests/SheetsService.test.js
```

Expected: PASS — 2 tests

- [ ] **Step 4: Commit**

```bash
git add src/SheetsService.js tests/SheetsService.test.js
git commit -m "feat: add SheetsService for all Sheets CRUD operations"
```

---

## Task 9: DriveService

**Files:**
- Create: `src/DriveService.js`

Downloads a file from Telegram (by file path) and saves it to Google Drive under `Receipts/YYYY-MM/`, returning a shareable URL.

- [ ] **Step 1: Create `src/DriveService.js`**

```javascript
// src/DriveService.js

function getOrCreateFolder(parent, name) {
  var iter = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(name);
}

function saveReceiptToDrive(byteArray, expenseId, mimeType, driveFolderId) {
  var now = new Date();
  var monthFolder = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  var dateStr = now.toISOString().split('T')[0].replace(/-/g, '');

  var ext = (mimeType === 'image/png') ? 'png' : 'jpg';
  var fileName = 'receipt_' + expenseId + '_' + dateStr + '.' + ext;

  var root = DriveApp.getFolderById(driveFolderId);
  var receiptsFolder = getOrCreateFolder(root, 'Receipts');
  var monthDir = getOrCreateFolder(receiptsFolder, monthFolder);

  var blob = Utilities.newBlob(byteArray, mimeType, fileName);
  var file = monthDir.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return 'https://drive.google.com/file/d/' + file.getId() + '/view';
}

if (typeof module !== 'undefined') {
  module.exports = { saveReceiptToDrive, getOrCreateFolder };
}
```

- [ ] **Step 2: Write tests**

Create `tests/DriveService.test.js`:

```javascript
// tests/DriveService.test.js
const { getOrCreateFolder } = require('../src/DriveService');

test('getOrCreateFolder returns existing folder if found', () => {
  const mockFolder = { name: 'existing' };
  const mockParent = {
    getFoldersByName: jest.fn().mockReturnValue({ hasNext: () => true, next: () => mockFolder }),
    createFolder: jest.fn()
  };
  const result = getOrCreateFolder(mockParent, 'Receipts');
  expect(result).toBe(mockFolder);
  expect(mockParent.createFolder).not.toHaveBeenCalled();
});

test('getOrCreateFolder creates folder when not found', () => {
  const newFolder = { name: 'new' };
  const mockParent = {
    getFoldersByName: jest.fn().mockReturnValue({ hasNext: () => false }),
    createFolder: jest.fn().mockReturnValue(newFolder)
  };
  const result = getOrCreateFolder(mockParent, 'Receipts');
  expect(mockParent.createFolder).toHaveBeenCalledWith('Receipts');
  expect(result).toBe(newFolder);
});
```

- [ ] **Step 3: Run test — expect PASS**

```bash
npx jest tests/DriveService.test.js
```

Expected: PASS — 2 tests

- [ ] **Step 4: Commit**

```bash
git add src/DriveService.js tests/DriveService.test.js
git commit -m "feat: add DriveService for receipt image storage"
```

---

## Task 10: BudgetService

**Files:**
- Create: `src/BudgetService.js`
- Create: `tests/BudgetService.test.js`

Pure functions only — no external API calls. Takes spend and budget data, returns alert text and status strings.

- [ ] **Step 1: Write the failing tests**

Create `tests/BudgetService.test.js`:

```javascript
// tests/BudgetService.test.js
const { checkBudget, formatBudgetSave, formatStatusMessage } = require('../src/BudgetService');

const budgets = [
  { category: 'Groceries', limit: 300, alertThreshold: 80 },
  { category: 'Clothing', limit: 100, alertThreshold: 80 }
];

test('checkBudget returns null when category has no budget', () => {
  expect(checkBudget('Travel', 50, budgets)).toBeNull();
});

test('checkBudget returns null when spend is below threshold', () => {
  expect(checkBudget('Groceries', 100, budgets)).toBeNull(); // 33% < 80%
});

test('checkBudget returns warning object at 80% threshold', () => {
  const result = checkBudget('Groceries', 250, budgets); // 83%
  expect(result).not.toBeNull();
  expect(result.type).toBe('warning');
  expect(result.percentage).toBeCloseTo(83.3, 0);
});

test('checkBudget returns over_budget when spend exceeds limit', () => {
  const result = checkBudget('Clothing', 110, budgets);
  expect(result.type).toBe('over_budget');
  expect(result.percentage).toBeCloseTo(110, 0);
});

test('formatBudgetSave shows spend and budget', () => {
  const text = formatBudgetSave('Groceries', 142.30, 300, 47);
  expect(text).toContain('Groceries');
  expect(text).toContain('142.30');
  expect(text).toContain('300');
  expect(text).toContain('47%');
});

test('formatStatusMessage includes all categories with spend', () => {
  const expenses = [
    { category: 'Groceries', eurAmount: 142 },
    { category: 'Clothing', eurAmount: 90 }
  ];
  const text = formatStatusMessage(expenses, budgets, new Date('2026-06-03'), 30);
  expect(text).toContain('Groceries');
  expect(text).toContain('Clothing');
  expect(text).toContain('142');
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/BudgetService.test.js
```

Expected: FAIL — `checkBudget is not a function`

- [ ] **Step 3: Create `src/BudgetService.js`**

```javascript
// src/BudgetService.js

function checkBudget(category, spend, budgets) {
  var budget = null;
  for (var i = 0; i < budgets.length; i++) {
    if (budgets[i].category === category) { budget = budgets[i]; break; }
  }
  if (!budget) return null;

  var percentage = (spend / budget.limit) * 100;
  if (spend > budget.limit) {
    return { type: 'over_budget', category: category, spend: spend, limit: budget.limit, percentage: percentage };
  }
  if (percentage >= budget.alertThreshold) {
    return { type: 'warning', category: category, spend: spend, limit: budget.limit, percentage: percentage };
  }
  return null;
}

function formatBudgetSave(category, spend, limit, percentage) {
  return category + ' this month: €' + spend.toFixed(2) + ' / €' + limit + ' (' + Math.round(percentage) + '%)';
}

function formatBudgetAlert(alertResult) {
  var emoji = alertResult.type === 'over_budget' ? '🚨' : '⚠️';
  return emoji + ' ' + alertResult.category + ' budget at ' +
    Math.round(alertResult.percentage) + '% (€' +
    alertResult.spend.toFixed(2) + ' / €' + alertResult.limit + ')';
}

function sumByCategory(expenses) {
  var totals = {};
  for (var i = 0; i < expenses.length; i++) {
    var cat = expenses[i].category;
    totals[cat] = (totals[cat] || 0) + (expenses[i].eurAmount || 0);
  }
  return totals;
}

function formatStatusMessage(expenses, budgets, today, daysInMonth) {
  var totals = sumByCategory(expenses);
  var totalSpent = expenses.reduce(function(s, e) { return s + (e.eurAmount || 0); }, 0);
  var totalBudget = budgets.reduce(function(s, b) { return s + b.limit; }, 0);
  var dayOfMonth = today.getDate();
  var projected = daysInMonth > 0 ? (totalSpent / dayOfMonth) * daysInMonth : 0;

  var lines = [
    '📊 <b>' + formatMonthYear(today) + ' — Day ' + dayOfMonth + '/' + daysInMonth + '</b>',
    'Total spent: €' + totalSpent.toFixed(2) + ' / €' + totalBudget,
    'Projected month-end: €' + projected.toFixed(2),
    ''
  ];

  budgets.forEach(function(b) {
    var spend = totals[b.category] || 0;
    if (spend === 0) return;
    var pct = Math.round((spend / b.limit) * 100);
    var flag = pct >= 100 ? ' 🚨' : pct >= b.alertThreshold ? ' ⚠️' : ' ✅';
    lines.push(b.category + ': €' + spend.toFixed(0) + ' / €' + b.limit + flag);
  });

  return lines.join('\n');
}

function formatMonthYear(date) {
  var months = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  return months[date.getMonth()] + ' ' + date.getFullYear();
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

if (typeof module !== 'undefined') {
  module.exports = { checkBudget, formatBudgetSave, formatBudgetAlert, formatStatusMessage, sumByCategory, getDaysInMonth };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/BudgetService.test.js
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/BudgetService.js tests/BudgetService.test.js
git commit -m "feat: add BudgetService with pure budget-check and alert formatting"
```

---

## Task 11: ReportService

**Files:**
- Create: `src/ReportService.js`
- Create: `tests/ReportService.test.js`

Pure functions — builds weekly digest and monthly report text from expense arrays.

- [ ] **Step 1: Write the failing tests**

Create `tests/ReportService.test.js`:

```javascript
// tests/ReportService.test.js
const { buildWeeklyDigest, buildMonthlyReport } = require('../src/ReportService');

const budgets = [
  { category: 'Groceries', limit: 300, alertThreshold: 80 },
  { category: 'Dining out', limit: 150, alertThreshold: 80 },
  { category: 'Clothing', limit: 100, alertThreshold: 80 }
];

const expenses = [
  { category: 'Groceries', eurAmount: 142, person: 'Pablo' },
  { category: 'Dining out', eurAmount: 46, person: 'Ana' },
  { category: 'Clothing', eurAmount: 90, person: 'Ana' }
];

test('buildWeeklyDigest includes total amount', () => {
  const text = buildWeeklyDigest(expenses, budgets, 300);
  expect(text).toContain('278'); // 142+46+90
});

test('buildWeeklyDigest includes top categories', () => {
  const text = buildWeeklyDigest(expenses, budgets, 300);
  expect(text).toContain('Groceries');
  expect(text).toContain('Clothing');
});

test('buildMonthlyReport includes per-person split', () => {
  const text = buildMonthlyReport(expenses, budgets, 'May 2026', 500);
  expect(text).toContain('Pablo');
  expect(text).toContain('Ana');
});

test('buildMonthlyReport shows under-budget celebration when total < budget', () => {
  const text = buildMonthlyReport(expenses, budgets, 'May 2026', 600);
  expect(text).toContain('🎉');
});

test('buildMonthlyReport shows over-budget warning when total > budget', () => {
  const text = buildMonthlyReport(expenses, budgets, 'May 2026', 200);
  expect(text).toContain('over budget');
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/ReportService.test.js
```

Expected: FAIL — `buildWeeklyDigest is not a function`

- [ ] **Step 3: Create `src/ReportService.js`**

```javascript
// src/ReportService.js

function sumByCategory(expenses) {
  var totals = {};
  expenses.forEach(function(e) {
    totals[e.category] = (totals[e.category] || 0) + (e.eurAmount || 0);
  });
  return totals;
}

function sumByPerson(expenses) {
  var totals = {};
  expenses.forEach(function(e) {
    totals[e.person] = (totals[e.person] || 0) + (e.eurAmount || 0);
  });
  return totals;
}

function topCategories(totals, n) {
  return Object.keys(totals)
    .map(function(cat) { return { category: cat, amount: totals[cat] }; })
    .sort(function(a, b) { return b.amount - a.amount; })
    .slice(0, n);
}

function buildWeeklyDigest(expenses, budgets, monthBudgetTotal) {
  var total = expenses.reduce(function(s, e) { return s + (e.eurAmount || 0); }, 0);
  var totals = sumByCategory(expenses);
  var top3 = topCategories(totals, 3);

  var lines = [
    '📋 <b>Weekly Digest</b>',
    'Week total: €' + total.toFixed(2),
    ''
  ];

  lines.push('Top categories:');
  top3.forEach(function(item, i) {
    lines.push((i + 1) + '. ' + item.category + ': €' + item.amount.toFixed(0));
  });

  return lines.join('\n');
}

function buildMonthlyReport(expenses, budgets, monthLabel, totalBudget, sheetsUrl) {
  var total = expenses.reduce(function(s, e) { return s + (e.eurAmount || 0); }, 0);
  var personTotals = sumByPerson(expenses);
  var categoryTotals = sumByCategory(expenses);
  var top5 = topCategories(categoryTotals, 5);
  var saved = totalBudget - total;
  var budgetLine = saved >= 0
    ? 'You saved €' + saved.toFixed(2) + ' this month! 🎉'
    : 'You were €' + Math.abs(saved).toFixed(2) + ' over budget. 📈';

  var lines = [
    '📋 <b>' + monthLabel + ' — Final Report</b>',
    '',
    'Total: €' + total.toFixed(2) + ' / €' + totalBudget + ' budget',
    budgetLine,
    ''
  ];

  Object.keys(personTotals).forEach(function(person) {
    var pct = total > 0 ? Math.round((personTotals[person] / total) * 100) : 0;
    lines.push('👤 ' + person + ': €' + personTotals[person].toFixed(0) + ' (' + pct + '%)');
  });

  lines.push('');
  lines.push('Top categories:');
  top5.forEach(function(item, i) {
    lines.push((i + 1) + '. ' + item.category + ': €' + item.amount.toFixed(0));
  });

  if (sheetsUrl) {
    lines.push('');
    lines.push('📄 Full report → ' + sheetsUrl);
  }

  return lines.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = { buildWeeklyDigest, buildMonthlyReport, sumByCategory, sumByPerson };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/ReportService.test.js
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/ReportService.js tests/ReportService.test.js
git commit -m "feat: add ReportService for weekly digests and monthly reports"
```

---

## Task 12: Webhook Handler

**Files:**
- Create: `src/Webhook.js`
- Create: `tests/Webhook.test.js`

The `doPost` entry point and all conversation flows: text expense, photo expense, callback queries (confirm/edit/cancel), edit field flow, and `/status`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Webhook.test.js`:

```javascript
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
    expect.any(String), 123, expect.stringContaining('cancelled')
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
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx jest tests/Webhook.test.js
```

Expected: FAIL — `handleTextExpense is not defined`

- [ ] **Step 3: Create `src/Webhook.js`**

```javascript
// src/Webhook.js

// Entry point called by Telegram webhook
function doPost(e) {
  try {
    var update = JSON.parse(e.postData.contents);
    handleUpdate(update);
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
  }
  return ContentService.createTextOutput('OK');
}

function handleUpdate(update) {
  if (update.callback_query) {
    handleCallbackQuery(update.callback_query);
    return;
  }
  var message = update.message;
  if (!message) return;

  var chatId = message.chat.id;
  var state = getState(chatId);

  if (state && state.action === 'awaiting_edit_value') {
    handleEditValueReply(message, state);
    return;
  }

  var text = message.text || '';
  if (text === '/start') { handleStart(message); return; }
  if (text === '/status') { handleStatus(message); return; }

  if (message.photo) { handlePhotoExpense(message); return; }
  if (text) { handleTextExpense(message); return; }
}

function handleStart(message) {
  var config = getConfig();
  var token = config.telegramBotToken;
  sendMessage(token, message.chat.id,
    '👋 Welcome to your Expense Tracker!\n\n' +
    'Send me an expense like <b>"Mercadona 47.30"</b> or send a photo of a receipt.\n\n' +
    'Commands:\n/status — see this month\'s spending'
  );
}

function handleTextExpense(message) {
  var config = getConfig();
  var chatId = message.chat.id;
  var token = config.telegramBotToken;
  var categories = getCategories();
  var corrections = getCorrections(20);

  var expense = classifyExpense(message.text, categories, corrections, config.geminiApiKey);
  expense.eurAmount = expense.amount; // Phase 1: EUR only
  expense.person = getPersonName(message.from.id, config);

  if (isLowConfidence(expense.confidence)) {
    setState(chatId, { action: 'awaiting_confirmation', expense: expense });
    var confirmText = formatExpenseConfirmation(expense) +
      '\n\n⚠️ Low confidence (' + Math.round(expense.confidence * 100) + '%). Please confirm:';
    sendConfirmation(token, chatId, confirmText, expense);
    return;
  }

  setState(chatId, { action: 'awaiting_confirmation', expense: expense });
  sendConfirmation(token, chatId, formatExpenseConfirmation(expense), expense);
}

function handlePhotoExpense(message) {
  var config = getConfig();
  var chatId = message.chat.id;
  var token = config.telegramBotToken;

  sendMessage(token, chatId, '⏳ Reading receipt…');

  var photos = message.photo;
  var largestPhoto = photos[photos.length - 1];
  var filePath = getFilePath(token, largestPhoto.file_id);
  if (!filePath) {
    sendMessage(token, chatId, '❌ Could not download the photo. Please try again.');
    return;
  }

  var byteArray = downloadFile(token, filePath);
  var mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  var base64 = Utilities.base64Encode(byteArray);

  var categories = getCategories();
  var corrections = getCorrections(20);
  var expense = classifyReceipt(base64, mimeType, categories, corrections, config.geminiApiKey);
  expense.eurAmount = expense.amount;
  expense.person = getPersonName(message.from.id, config);

  // Generate a temporary ID for naming the Drive file
  var tempId = 'TEMP-' + Date.now();
  var receiptUrl = saveReceiptToDrive(byteArray, tempId, mimeType, config.driveFolderId);
  expense.receiptUrl = receiptUrl;

  setState(chatId, { action: 'awaiting_confirmation', expense: expense });
  sendConfirmation(token, chatId, formatExpenseConfirmation(expense), expense);
}

function handleCallbackQuery(callbackQuery) {
  var config = getConfig();
  var token = config.telegramBotToken;
  var chatId = callbackQuery.message.chat.id;
  var data = callbackQuery.data;

  answerCallbackQuery(token, callbackQuery.id);

  if (data === 'confirm') { handleConfirmCallback(callbackQuery, config); return; }
  if (data === 'cancel') { handleCancelCallback(callbackQuery, token); return; }
  if (data === 'edit') { handleEditCallback(callbackQuery, token); return; }
  if (data.indexOf('edit_') === 0) { handleEditFieldCallback(callbackQuery, token); return; }
}

function handleConfirmCallback(callbackQuery, config) {
  var token = config.telegramBotToken;
  var chatId = callbackQuery.message.chat.id;
  var state = getState(chatId);
  if (!state || state.action !== 'awaiting_confirmation') return;

  var expense = state.expense;
  var expenseId = appendExpense(expense);
  clearState(chatId);

  var now = new Date();
  var monthSpend = getCategoryMonthSpend(expense.category, now.getFullYear(), now.getMonth() + 1);
  var budgets = getBudgets();
  var budgetForCategory = null;
  for (var i = 0; i < budgets.length; i++) {
    if (budgets[i].category === expense.category) { budgetForCategory = budgets[i]; break; }
  }

  var savedLine = '✔️ Saved!';
  if (budgetForCategory) {
    var pct = Math.round((monthSpend / budgetForCategory.limit) * 100);
    savedLine += ' ' + formatBudgetSave(expense.category, monthSpend, budgetForCategory.limit, pct);
  }

  sendMessage(token, chatId, savedLine);

  var alert = checkBudget(expense.category, monthSpend, budgets);
  if (alert) {
    sendMessage(token, chatId, formatBudgetAlert(alert));
  }
}

function handleCancelCallback(callbackQuery, token) {
  var chatId = callbackQuery.message.chat.id;
  clearState(chatId);
  sendMessage(token, chatId, 'Expense cancelled.');
}

function handleEditCallback(callbackQuery, token) {
  var chatId = callbackQuery.message.chat.id;
  sendEditFieldMenu(token, chatId);
}

function handleEditFieldCallback(callbackQuery, token) {
  var chatId = callbackQuery.message.chat.id;
  var field = callbackQuery.data.replace('edit_', ''); // e.g. 'merchant', 'amount', 'category', 'date'
  var state = getState(chatId);
  if (!state) return;
  setState(chatId, { action: 'awaiting_edit_value', expense: state.expense, editField: field });
  sendMessage(token, chatId, 'Enter new value for <b>' + field + '</b>:');
}

function handleEditValueReply(message, state) {
  var config = getConfig();
  var token = config.telegramBotToken;
  var chatId = message.chat.id;
  var expense = state.expense;
  var field = state.editField;
  var value = message.text.trim();

  var originalValue = expense[field];

  if (field === 'amount') {
    expense.amount = parseFloat(value);
    expense.eurAmount = parseFloat(value);
  } else if (field === 'date') {
    expense.date = value;
  } else if (field === 'category') {
    // Log correction for reinforcement learning
    appendCorrection(expense.merchant, expense.category, value, expense.confidence);
    expense.category = value;
  } else {
    expense[field] = value;
  }

  setState(chatId, { action: 'awaiting_confirmation', expense: expense });
  sendConfirmation(token, chatId, formatExpenseConfirmation(expense), expense);
}

function handleStatus(message) {
  var config = getConfig();
  var token = config.telegramBotToken;
  var chatId = message.chat.id;
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth() + 1;
  var expenses = getMonthExpenses(year, month);
  var budgets = getBudgets();
  var daysInMonth = getDaysInMonth(year, month);
  var text = formatStatusMessage(expenses, budgets, now, daysInMonth);
  sendMessage(token, chatId, text);
}

if (typeof module !== 'undefined') {
  module.exports = {
    handleUpdate, handleTextExpense, handlePhotoExpense,
    handleCallbackQuery, handleStatus, handleConfirmCallback,
    handleCancelCallback
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npx jest tests/Webhook.test.js
```

Expected: PASS — 4 tests

- [ ] **Step 5: Run all tests to confirm nothing broken**

```bash
npx jest
```

Expected: All tests pass across all test files.

- [ ] **Step 6: Commit**

```bash
git add src/Webhook.js tests/Webhook.test.js
git commit -m "feat: add Webhook handler with all conversation flows"
```

---

## Task 13: Scheduled Triggers

**Files:**
- Create: `src/Triggers.js`

Installs time-based triggers for weekly digests (every Sunday 20:00) and monthly reports (1st of month 09:00). Run `installTriggers()` once from the Apps Script editor.

- [ ] **Step 1: Create `src/Triggers.js`**

```javascript
// src/Triggers.js

function installTriggers() {
  // Remove existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  // Weekly digest — every Sunday at 20:00
  ScriptApp.newTrigger('sendWeeklyDigest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(20)
    .nearMinute(0)
    .create();

  // Monthly report — every day, but the function checks if it's the right day
  ScriptApp.newTrigger('sendMonthlyReport')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .nearMinute(0)
    .create();

  Logger.log('Triggers installed successfully.');
}

function sendWeeklyDigest() {
  var config = getConfig();
  var token = config.telegramBotToken;
  var expenses = getWeekExpenses();
  var budgets = getBudgets();
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth() + 1;
  var monthExpenses = getMonthExpenses(year, month);
  var totalBudget = budgets.reduce(function(s, b) { return s + b.limit; }, 0);
  var monthSpend = monthExpenses.reduce(function(s, e) { return s + (e.eurAmount || 0); }, 0);
  var remaining = totalBudget - monthSpend;

  var text = buildWeeklyDigest(expenses, budgets, totalBudget);
  text += '\n\nRemaining this month: €' + remaining.toFixed(2);

  sendMessage(token, config.user1TelegramId, text);
  if (config.user2TelegramId && config.user2TelegramId !== config.user1TelegramId) {
    sendMessage(token, config.user2TelegramId, text);
  }
}

function sendMonthlyReport() {
  var config = getConfig();
  var now = new Date();
  if (now.getDate() !== config.reportDayOfMonth) return;

  var token = config.telegramBotToken;
  // Report on the previous month
  var reportMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  var reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  var expenses = getMonthExpenses(reportYear, reportMonth);
  var budgets = getBudgets();
  var totalBudget = budgets.reduce(function(s, b) { return s + b.limit; }, 0);

  var months = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var monthLabel = months[reportMonth - 1] + ' ' + reportYear;

  var text = buildMonthlyReport(expenses, budgets, monthLabel, totalBudget);

  sendMessage(token, config.user1TelegramId, text);
  if (config.user2TelegramId && config.user2TelegramId !== config.user1TelegramId) {
    sendMessage(token, config.user2TelegramId, text);
  }
}
```

- [ ] **Step 2: Push to Apps Script and install triggers**

```bash
npm run push
```

In the Apps Script editor: open `Triggers.gs`, select `installTriggers`, click **Run**. Confirm in **Triggers** panel (left sidebar → clock icon) that two triggers appear: `sendWeeklyDigest` and `sendMonthlyReport`.

- [ ] **Step 3: Commit**

```bash
git add src/Triggers.js
git commit -m "feat: add scheduled triggers for weekly digest and monthly report"
```

---

## Task 14: Deploy and Register Telegram Webhook

**Files:** none (deployment steps only)

- [ ] **Step 1: Fill in the Config sheet**

Open the connected Google Sheet. In the **Config** tab, fill in:
- `User1TelegramID` — your Telegram user ID (send `/start` to @userinfobot to get it)
- `User2TelegramID` — partner's Telegram user ID
- `GeminiAPIKey` — from [Google AI Studio](https://aistudio.google.com/app/apikey)
- `TelegramBotToken` — from @BotFather (`/newbot`)
- `DriveFolderID` — ID of the Google Drive folder to use (create one, copy ID from URL)

- [ ] **Step 2: Push all source files to Apps Script**

```bash
npm run push
```

Verify all `.js` files appear as `.gs` in the Apps Script editor.

- [ ] **Step 3: Deploy as Web App**

In the Apps Script editor:
1. Click **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Click **Deploy**
6. Copy the **Web app URL** (format: `https://script.google.com/macros/s/SCRIPT_ID/exec`)

- [ ] **Step 4: Register the webhook with Telegram**

Replace `YOUR_BOT_TOKEN` and `YOUR_WEBAPP_URL`:

```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_WEBAPP_URL"
```

Expected response:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

- [ ] **Step 5: Smoke test — text expense**

Open Telegram, find your bot, send:
```
Mercadona 47.30
```

Expected: Bot replies with parsed expense + ✅/✏️/❌ buttons. Tap ✅ and verify a row appears in the Expenses sheet.

- [ ] **Step 6: Smoke test — receipt photo**

Send a photo of any receipt. Expected: Bot replies `⏳ Reading receipt…` then shows parsed data. Tap ✅ and verify:
- Row in Expenses sheet with receipt URL
- Photo file in Google Drive under `Receipts/YYYY-MM/`

- [ ] **Step 7: Smoke test — /status**

Send `/status`. Expected: Bot replies with current month breakdown.

- [ ] **Step 8: Run installTriggers from Apps Script editor**

Open `Triggers.gs`, run `installTriggers()`. Verify in Triggers panel that weekly and monthly triggers are active.

- [ ] **Step 9: Final commit**

```bash
git add .
git commit -m "feat: complete Phase 1 — expense tracker bot deployed and webhooks registered"
```

---

## Running All Tests

```bash
npm test
```

Expected output:
```
PASS tests/Config.test.js
PASS tests/StateService.test.js
PASS tests/TelegramService.test.js
PASS tests/GeminiService.test.js
PASS tests/SheetsService.test.js
PASS tests/DriveService.test.js
PASS tests/BudgetService.test.js
PASS tests/ReportService.test.js
PASS tests/Webhook.test.js

Test Suites: 9 passed, 9 total
Tests:       ~35 passed
```
