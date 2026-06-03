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
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // wait up to 10 seconds
  try {
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
  } catch (e) {
    throw new Error('Failed to save expense: ' + e.message);
  } finally {
    lock.releaseLock();
  }
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
    if (data[i][2] === true) { // Active column
      results.push(data[i][0]);
    }
  }
  return results;
}

function getCorrections(limit) {
  var sheet = getSheet('Corrections');
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  var effectiveLimit = (limit === 0) ? 0 : (limit || 20);
  if (effectiveLimit === 0) return [];
  var startRow = Math.max(2, lastRow - effectiveLimit + 1);
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
  sheet.appendRow([new Date(), merchant, geminiGuess, userCorrection, confidence]);
}

if (typeof module !== 'undefined') {
  module.exports = {
    appendExpense, getMonthExpenses, getWeekExpenses,
    getCategoryMonthSpend, getBudgets, getCategories,
    getCorrections, appendCorrection, generateExpenseId
  };
}
