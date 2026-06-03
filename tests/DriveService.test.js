// tests/DriveService.test.js
const { getOrCreateFolder } = require('../src/DriveService');

test('getOrCreateFolder returns existing folder if found', () => {
  const mockFolder = { name: 'existing' };
  const mockParent = {
    getFoldersByName: jest.fn().mockReturnValue({ hasNext: () => true, next: () => mockFolder }),
    createFolder: jest.fn()
  };
  const result = getOrCreateFolder(mockParent, 'Receipts');
  expect(result).toBe(mockFolder);
  expect(mockParent.createFolder).not.toHaveBeenCalled();
});

test('getOrCreateFolder creates folder when not found', () => {
  const newFolder = { name: 'new' };
  const mockParent = {
    getFoldersByName: jest.fn().mockReturnValue({ hasNext: () => false }),
    createFolder: jest.fn().mockReturnValue(newFolder)
  };
  const result = getOrCreateFolder(mockParent, 'Receipts');
  expect(mockParent.createFolder).toHaveBeenCalledWith('Receipts');
  expect(result).toBe(newFolder);
});
