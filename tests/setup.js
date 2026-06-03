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

global.PropertiesService = {
  getUserProperties: jest.fn(() => {
    const store = {};
    return {
      getProperty: jest.fn((key) => store[key] || null),
      setProperty: jest.fn((key, value) => { store[key] = value; }),
      deleteProperty: jest.fn((key) => { delete store[key]; })
    };
  }),
  getScriptProperties: jest.fn(() => {
    const store = {};
    return {
      getProperty: jest.fn((key) => store[key] || null),
      setProperty: jest.fn((key, value) => { store[key] = value; }),
      deleteProperty: jest.fn((key) => { delete store[key]; })
    };
  })
};

global.UrlFetchApp = {
  fetch: jest.fn().mockReturnValue({
    getContentText: jest.fn().mockReturnValue('{}'),
    getContent: jest.fn().mockReturnValue([])
  })
};

const mockMonthFolder = {
  createFile: jest.fn().mockReturnValue({
    getId: jest.fn().mockReturnValue('file-id'),
    setSharing: jest.fn().mockReturnThis()
  }),
  getFoldersByName: jest.fn().mockReturnValue({ hasNext: jest.fn().mockReturnValue(false) })
};

const mockReceiptsFolder = {
  createFolder: jest.fn().mockReturnValue(mockMonthFolder),
  getFoldersByName: jest.fn().mockReturnValue({ hasNext: jest.fn().mockReturnValue(false) })
};

global.DriveApp = {
  getFolderById: jest.fn().mockReturnValue({
    createFolder: jest.fn().mockReturnValue(mockReceiptsFolder),
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

const mockLock = {
  waitLock: jest.fn(),
  releaseLock: jest.fn(),
  hasLock: jest.fn().mockReturnValue(true)
};

global.LockService = {
  getScriptLock: jest.fn().mockReturnValue(mockLock),
  getUserLock: jest.fn().mockReturnValue(mockLock),
  getDocumentLock: jest.fn().mockReturnValue(mockLock)
};

beforeEach(() => {
  jest.clearAllMocks();
});
