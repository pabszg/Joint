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
  var result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (e) {
    Logger.log('Telegram API parse error [' + method + ']: ' + response.getContentText().substring(0, 200));
    return { ok: false };
  }
  if (!result.ok) {
    Logger.log('Telegram API error [' + method + ']: ' + JSON.stringify(result));
  }
  return result;
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
      { text: '✅ Confirmar', callback_data: 'confirm' },
      { text: '✏️ Editar', callback_data: 'edit' },
      { text: '❌ Cancelar', callback_data: 'cancel' }
    ]]
  };
  return telegramPost(token, 'sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: keyboard
  });
}

function sendEditFieldMenu(token, chatId) {
  var keyboard = {
    inline_keyboard: [[
      { text: 'Comercio', callback_data: 'edit_merchant' },
      { text: 'Importe', callback_data: 'edit_amount' }
    ], [
      { text: 'Categoría', callback_data: 'edit_category' },
      { text: 'Fecha', callback_data: 'edit_date' }
    ]]
  };
  return telegramPost(token, 'sendMessage', {
    chat_id: chatId,
    text: '¿Qué campo quieres editar?',
    reply_markup: keyboard
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
    '🧾 <b>Gasto detectado:</b>',
    'Comercio: ' + (expense.merchant || '(desconocido)'),
    'Importe: ' + formatAmount(expense.amount, expense.currency),
    'Categoría: ' + getCategoryEmoji(expense.category) + ' ' + expense.category,
    'Fecha: ' + expense.date,
    expense.receiptUrl ? 'Recibo guardado en Drive ✓' : ''
  ].filter(Boolean).join('\n');
}

function formatAmount(amount, currency) {
  var symbol = currency === 'EUR' ? '€' : currency;
  var value = parseFloat(amount);
  return symbol + (isNaN(value) ? '0.00' : value.toFixed(2));
}

function getCategoryEmoji(category) {
  var emojis = {
    'Alquiler': '🏠', 'Supermercado': '🛒', 'Restaurantes': '🍽️', 'Delivery': '🛵',
    'Transporte': '🚗', 'Salud': '💊', 'Ropa': '👗', 'Entretenimiento': '🎬',
    'Suscripciones': '📱', 'Hogar y Limpieza': '🧹', 'Viajes': '✈️',
    'Formación': '📚', 'Ahorros': '💰', 'Otros': '🔧', 'Comisiones y Banco': '🏦'
  };
  return emojis[category] || '📌';
}

if (typeof module !== 'undefined') {
  module.exports = {
    telegramPost, sendMessage, sendConfirmation, sendEditFieldMenu,
    answerCallbackQuery, getFilePath, downloadFile,
    formatExpenseConfirmation, formatAmount, getCategoryEmoji
  };
}
