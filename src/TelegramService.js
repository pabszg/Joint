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
