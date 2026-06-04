// src/Webhook.js

var DEDUP_PROPERTY_KEY = 'last_update_id';

function doGet() {
  return ContentService.createTextOutput('Expense Tracker bot is running.');
}

// Drops Telegram retry duplicates — returns true if this update_id was already handled.
function isDuplicate(updateId) {
  var props = PropertiesService.getScriptProperties();
  var last = parseInt(props.getProperty(DEDUP_PROPERTY_KEY) || '0', 10);
  // <= rejects any update at or below the highest processed ID. Telegram guarantees
  // strictly-increasing update_ids, so anything at or below last is a retry.
  if (updateId <= last) return true;
  props.setProperty(DEDUP_PROPERTY_KEY, String(updateId));
  return false;
}

// Entry point called by Telegram webhook
function doPost(e) {
  var chatId = null;
  var token = null;
  try {
    var update = JSON.parse(e.postData.contents);

    // Serialize the dedup check with a lock so two concurrent executions
    // (Telegram retries if the bot is slow) can't both pass the check.
    // The lock covers only the atomic read-check-write in isDuplicate —
    // it is released before any slow Gemini / Sheets calls.
    if (update.update_id) {
      var lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        if (isDuplicate(update.update_id)) {
          return ContentService.createTextOutput('OK');
        }
      } finally {
        lock.releaseLock();
      }
    }

    // Capture chatId + token early so we can report errors to the user
    try {
      var cfg = getConfig();
      token = cfg.telegramBotToken;
      if (update.message) chatId = update.message.chat.id;
      else if (update.callback_query) chatId = update.callback_query.message.chat.id;
    } catch (cfgErr) {
      Logger.log('Config error: ' + cfgErr.message);
    }
    handleUpdate(update);
  } catch (err) {
    Logger.log('doPost error: ' + err.message);
    if (chatId && token) {
      try { sendMessage(token, chatId, '❌ Error interno: ' + err.message); } catch (e) {}
    }
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
  var text = message.text || '';

  // Commands always take priority over conversation state
  if (text === '/start') { handleStart(message); return; }
  if (text === '/status') { handleStatus(message); return; }

  var state = getState(chatId);
  if (state && state.action === 'awaiting_edit_value') {
    handleEditValueReply(message, state);
    return;
  }

  if (message.photo) { handlePhotoExpense(message); return; }
  if (text) { handleTextExpense(message); return; }
}

function handleStart(message) {
  var config = getConfig();
  var token = config.telegramBotToken;
  sendMessage(token, message.chat.id,
    '👋 ¡Bienvenido/a a tu Registro de Gastos!\n\n' +
    'Envíame un gasto como <b>"Mercadona 47.30"</b> o envía una foto de un recibo.\n\n' +
    'Comandos:\n/status — ver el gasto de este mes'
  );
}

function handleTextExpense(message) {
  var config = getConfig();
  var chatId = message.chat.id;
  var token = config.telegramBotToken;

  sendMessage(token, chatId, '⏳ Procesando…');

  var categories = getCategories();
  var corrections = getCorrections(20);

  var expense;
  try {
    expense = classifyExpense(message.text, categories, corrections, config.geminiApiKey);
  } catch (geminiErr) {
    Logger.log('Gemini error: ' + geminiErr.message);
    sendMessage(token, chatId, '❌ No se pudo clasificar el gasto: ' + geminiErr.message);
    return;
  }
  expense.eurAmount = expense.amount; // Phase 1: EUR only
  expense.person = getPersonName(message.from.id, config);
  expense.hasItems = expense.has_items || false;
  expense.hasItemsData = expense.items || [];
  expense.currency = expense.currency || 'EUR';

  if (isLowConfidence(expense.confidence)) {
    setState(chatId, { action: 'awaiting_confirmation', expense: expense });
    var confirmText = formatExpenseConfirmation(expense) +
      '\n\n⚠️ Confianza baja (' + Math.round(expense.confidence * 100) + '%). Por favor confirma:';
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

  sendMessage(token, chatId, '⏳ Leyendo recibo…');

  var photos = message.photo;
  var largestPhoto = photos[photos.length - 1];
  var filePath = getFilePath(token, largestPhoto.file_id);
  if (!filePath) {
    sendMessage(token, chatId, '❌ No se pudo descargar la foto. Por favor inténtalo de nuevo.');
    return;
  }

  var byteArray = downloadFile(token, filePath);
  var mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  var base64 = Utilities.base64Encode(byteArray);

  var categories = getCategories();
  var corrections = getCorrections(20);
  var expense;
  try {
    expense = classifyReceipt(base64, mimeType, categories, corrections, config.geminiApiKey);
  } catch (geminiErr) {
    Logger.log('Gemini receipt error: ' + geminiErr.message);
    sendMessage(token, chatId, '❌ No se pudo leer el recibo: ' + geminiErr.message);
    return;
  }
  expense.eurAmount = expense.amount;
  expense.person = getPersonName(message.from.id, config);
  expense.hasItems = expense.has_items || false;
  expense.hasItemsData = expense.items || [];
  expense.currency = expense.currency || 'EUR';

  // Try to save receipt to Drive; proceed without it if Drive is unavailable
  expense.receiptUrl = '';
  try {
    var tempId = 'TEMP-' + Date.now();
    expense.receiptUrl = saveReceiptToDrive(byteArray, tempId, mimeType, config.driveFolderId);
  } catch (driveErr) {
    Logger.log('Drive save failed: ' + driveErr.message);
    sendMessage(token, chatId, '⚠️ No se pudo guardar la imagen del recibo en Drive (continuando sin ella).');
  }

  setState(chatId, { action: 'awaiting_confirmation', expense: expense });
  sendConfirmation(token, chatId, formatExpenseConfirmation(expense), expense);
}

function handleCallbackQuery(callbackQuery) {
  var config = getConfig();
  var token = config.telegramBotToken;
  var chatId = callbackQuery.message.chat.id;
  var data = callbackQuery.data;

  if (!data) {
    answerCallbackQuery(token, callbackQuery.id);
    return;
  }

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
  var expenseId;
  try {
    expenseId = appendExpense(expense);
  } catch (saveErr) {
    Logger.log('appendExpense failed: ' + saveErr.message);
    sendMessage(token, chatId, '❌ Error al guardar el gasto. Por favor inténtalo de nuevo.');
    return; // state kept so user can retry
  }
  clearState(chatId); // only clear after successful save

  var now = new Date();
  var monthSpend = getCategoryMonthSpend(expense.category, now.getFullYear(), now.getMonth() + 1);
  var budgets = getBudgets();
  var budgetForCategory = null;
  for (var i = 0; i < budgets.length; i++) {
    if (budgets[i].category === expense.category) { budgetForCategory = budgets[i]; break; }
  }

  var savedLine = '✔️ ¡Guardado!';
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
  sendMessage(token, chatId, 'Gasto cancelado.');
}

function handleEditCallback(callbackQuery, token) {
  var chatId = callbackQuery.message.chat.id;
  sendEditFieldMenu(token, chatId);
}

function handleEditFieldCallback(callbackQuery, token) {
  var chatId = callbackQuery.message.chat.id;
  var field = callbackQuery.data.replace('edit_', '');
  var state = getState(chatId);
  if (!state || state.action !== 'awaiting_confirmation') return;
  setState(chatId, { action: 'awaiting_edit_value', expense: state.expense, editField: field });
  sendMessage(token, chatId, 'Introduce el nuevo valor para <b>' + field + '</b>:');
}

function handleEditValueReply(message, state) {
  var config = getConfig();
  var token = config.telegramBotToken;
  var chatId = message.chat.id;
  var expense = state.expense;
  var field = state.editField;
  var value = message.text.trim();

  if (field === 'amount') {
    var parsed = parseFloat(value);
    if (isNaN(parsed) || parsed <= 0) {
      sendMessage(config.telegramBotToken, chatId, '❌ Importe no válido. Por favor introduce un número (p.ej. 47.30):');
      return; // keep state so user can retry
    }
    expense.amount = parsed;
    expense.eurAmount = parsed;
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
    handleCancelCallback, isDuplicate, DEDUP_PROPERTY_KEY
  };
  // Assign to global so tests can call functions directly (mirrors Apps Script global scope)
  Object.keys(_exports).forEach(function(key) { global[key] = _exports[key]; });
  module.exports = _exports;
}
