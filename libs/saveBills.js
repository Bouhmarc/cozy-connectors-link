saveFiles = require('./savefiles')

// SaveBills rebondit directement sur la sauvegarde des documents
function saveBills(documents, fields, inputOptions = {}) {
  return saveFiles(documents, fields, inputOptions)
}

module.exports = saveBills