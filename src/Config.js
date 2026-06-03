// src/Config.js

function getConfig() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Config');
  if (!sheet) throw new Error('Config sheet not found. Run setupSpreadsheet() first.');
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
