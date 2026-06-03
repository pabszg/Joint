// src/Config.js

function getConfig() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Config');
  if (!sheet) throw new Error('Config sheet not found. Run setupSpreadsheet() first.');
  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    var value = data[i][1];
    if (key) config[key] = (typeof value === 'string') ? value.trim() : value;
  }
  return {
    user1Name: config['User1Name'] || 'User1',
    user1TelegramId: String(config['User1TelegramID'] || '').trim(),
    user2Name: config['User2Name'] || 'User2',
    user2TelegramId: String(config['User2TelegramID'] || '').trim(),
    baseCurrency: config['BaseCurrency'] || 'EUR',
    geminiApiKey: (config['GeminiAPIKey'] || '').trim(),
    telegramBotToken: (config['TelegramBotToken'] || '').trim(),
    driveFolderId: (config['DriveFolderID'] || '').trim(),
    reportDayOfMonth: parseInt(config['ReportDayOfMonth'] || '1', 10) || 1,
    defaultAlertThreshold: parseInt(config['DefaultAlertThreshold'] || '80', 10) || 80
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
