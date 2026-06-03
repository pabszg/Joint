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
