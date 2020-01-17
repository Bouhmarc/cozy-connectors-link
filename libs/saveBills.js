saveFiles = require('./savefiles')

// SaveBills rebondit directement sur la sauvegarde des documents
function saveBills(documents, fields) {
  return saveFiles(documents, fields)
}

module.exports = saveBills