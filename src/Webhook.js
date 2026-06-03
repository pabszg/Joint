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
  var field = callbackQuery.data.replace('edit_', '');
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
  var _exports = {
    handleUpdate, handleTextExpense, handlePhotoExpense,
    handleCallbackQuery, handleStatus, handleConfirmCallback,
    handleCancelCallback
  };
  // Assign to global so tests can call functions directly (mirrors Apps Script global scope)
  Object.keys(_exports).forEach(function(key) { global[key] = _exports[key]; });
  module.exports = _exports;
}
