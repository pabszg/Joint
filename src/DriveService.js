// src/DriveService.js

function getOrCreateFolder(parent, name) {
  var iter = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(name);
}

function saveReceiptToDrive(byteArray, expenseId, mimeType, driveFolderId) {
  try {
    var now = new Date();
    var monthFolder = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var dateStr = now.toISOString().split('T')[0].replace(/-/g, '');

    var extMap = { 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
    var ext = extMap[mimeType] || 'jpg';
    var fileName = 'receipt_' + expenseId + '_' + dateStr + '.' + ext;

    var root = DriveApp.getFolderById(driveFolderId);
    var receiptsFolder = getOrCreateFolder(root, 'Receipts');
    var monthDir = getOrCreateFolder(receiptsFolder, monthFolder);

    var blob = Utilities.newBlob(byteArray, mimeType, fileName);
    var file = monthDir.createFile(blob);
    // ANYONE_WITH_LINK: intentional for personal bot — receipt URL is only shared with the couple
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return 'https://drive.google.com/file/d/' + file.getId() + '/view';
  } catch (e) {
    throw new Error('Failed to save receipt to Drive: ' + e.message);
  }
}

if (typeof module !== 'undefined') {
  module.exports = { saveReceiptToDrive, getOrCreateFolder };
}
