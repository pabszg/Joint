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
