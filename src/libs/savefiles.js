/**
 * Saves the given files in the given folder via the Cozy API.
 *
 * @module saveFiles
 */
const bluebird = require('bluebird')
const retry = require('bluebird-retry')
const mimetypes = require('mime-types')
const path = require('path')
const requestFactory = require('./request')
const omit = require('lodash/omit')
const get = require('lodash/get')
const log = require('./log')
const errors = require('./errors')
const stream = require('stream')
const fileType = require('file-type')
const DEFAULT_TIMEOUT = Date.now() + 4 * 60 * 1000 // 4 minutes by default since the stack allows 5 minutes
const DEFAULT_CONCURRENCY = 1
const DEFAULT_RETRY = 1 // do not retry by default
const fs = require('fs')
const mkdirp = require('./mkdirp')

/**
 * Saves the files given in the fileurl attribute of each entries
 *
 * You need the full permission on `io.cozy.files` in your manifest to use this function.
 *
 * - `files` is an array of objects with the following possible attributes :
 *
 *   + fileurl: The url of the file (can be a function returning the value). Ignored if `filestream`
 *   is given
 *   + filestream: the stream which will be directly passed to cozyClient.files.create (can also be
 *   function returning the stream)
 *   + requestOptions (object) : The options passed to request to fetch fileurl (can be a function returning the value)
 *   + filename : The file name of the item written on disk. This attribute is optional and as default value, the
 *     file name will be "smartly" guessed by the function. Use this attribute if the guess is not smart
 *   enough for you, or if you use `filestream` (can be a function returning the value).
 *   + `shouldReplaceName` (string) used to migrate filename. If saveFiles find a file linked to this entry and this
 *   file name matches `shouldReplaceName`, the file is renames to `filename` (can be a function returning the value)
 *   + `shouldReplaceFile` (function) use this function to state if the current entry should be forced
 *   to be redownloaded and replaced. Usefull if we know the file content can change and we always
 *   want the last version.
 *   + `fileAttributes` (object) ex: `{created_at: new Date()}` sets some additionnal file
 *   attributes passed to cozyClient.file.create
 *
 * - `fields` (string) is the argument given to the main function of your connector by the BaseKonnector.
 *      It especially contains a `folderPath` which is the string path configured by the user in
 *      collect/home
 *
 * - `options` (object) is optional. Possible options :
 *
 *   + `timeout` (timestamp) can be used if your connector needs to fetch a lot of files and if the
 *   stack does not give enough time to your connector to fetch it all. It could happen that the
 *   connector is stopped right in the middle of the download of the file and the file will be
 *   broken. With the `timeout` option, the `saveFiles` function will check if the timeout has
 *   passed right after downloading each file and then will be sure to be stopped cleanly if the
 *   timeout is not too long. And since it is really fast to check that a file has already been
 *   downloaded, on the next run of the connector, it will be able to download some more
 *   files, and so on. If you want the timeout to be in 10s, do `Date.now() + 10*1000`.
 *   You can try it in the previous code.
 *   + `contentType` (string or boolean) ex: 'application/pdf' used to force the contentType of documents when
 *   they are badly recognized by cozy. If "true" the content type will be recognized from the file
 *   name and forced the same way.
 *   + `concurrency` (number) default: `1` sets the maximum number of concurrent downloads
 *   + `validateFile` (function) default: do not validate if file is empty or has bad mime type
 *   + `validateFileContent` (boolean or function) default false. Also check the content of the file to
 *   recognize the mime type
 *   + `fileIdAttributes` (array of strings). Describes which attributes of files will be taken as primary key for
 *   files to check if they already exist, even if they are moved. If not given, the file path will
 *   used for deduplication as before.
 * @example
 * ```javascript
 * await saveFiles([{fileurl: 'https://...', filename: 'bill1.pdf'}], fields, {
 *    fileIdAttributes: ['fileurl']
 * })
 * ```
 *
 * @alias module:saveFiles
 */
const saveFiles = async (entries, fields, options = {}) => {
  if (!entries || entries.length === 0) {
    log('warn', 'No file to download')
  }
 /* if (!options.sourceAccount) {
    log('warn', 'There is no sourceAccount given to saveFiles')
  }

  if (!options.sourceAccountIdentifier) {
    log('warn', 'There is no sourceAccountIdentifier given to saveFIles')
  }*/
  if (typeof fields !== 'object') {
    log(
      'debug',
      'Deprecation warning, saveFiles 2nd argument should not be a string'
    )
    fields = {
      folderPath: fields
    }
  }
  const saveOptions = {
    folderPath: fields.DataDirectory ? fields.DataDirectory : fields.folderPath,
    fileIdAttributes: options.fileIdAttributes,
    timeout: options.timeout || DEFAULT_TIMEOUT,
    concurrency: options.concurrency || DEFAULT_CONCURRENCY,
    retry: options.retry || DEFAULT_RETRY,
    postProcess: options.postProcess,
    postProcessFile: options.postProcessFile,
    contentType: options.contentType,
    requestInstance: options.requestInstance,
    shouldReplaceFile: options.shouldReplaceFile,
    validateFile: options.validateFile || defaultValidateFile,
    sourceAccountOptions: {
      sourceAccount: options.sourceAccount,
      sourceAccountIdentifier: options.sourceAccountIdentifier
    }
  }

  if (options.validateFileContent) {
    if (options.validateFileContent === true) {
      saveOptions.validateFileContent = defaultValidateFileContent
    } else if (typeof options.validateFileContent === 'function') {
      saveOptions.validateFileContent = options.validateFileContent
    }
  }

  // Crée le répertoire
  await mkdirp(saveOptions.folderPath)
  const canBeSaved = entry =>
    entry.fileurl || entry.requestOptions || entry.filestream

  let filesArray = undefined
  let savedFiles = 0
  const savedEntries = []
  try {
    await bluebird.map(
      entries,
      async entry => {
        ;[
          'fileurl',
          'filename',
          'shouldReplaceName',
          'requestOptions'
          // 'filestream'
        ].forEach(key => {
          if (entry[key])
            entry[key] = getValOrFnResult(entry[key], entry, options)
        })
        if (entry.filestream && !entry.filename) {
          log(
            'warn',
            'Missing filename property for for filestream entry, entry is ignored'
          )
          return
        }
        if (entry.shouldReplaceName) {
          // At first encounter of a rename, we set the filenamesList
          if (filesArray === undefined) {
            log('debug', 'initialize files list for renamming')
            filesArray = await getFiles(fields.folderPath)
          }
          const fileFound = filesArray.find(
            f => f.name === entry.shouldReplaceName
          )
          if (fileFound) {
            await renameFile(fileFound, entry)
            return
          } else {
            delete entry.shouldReplaceName
            // And continue as normal
          }
        }

        if (canBeSaved(entry)) {
          entry = await saveEntry(entry, saveOptions)
          if (entry && entry._cozy_file_to_create) {
            savedFiles++
            delete entry._cozy_file_to_create
          }
        }
        savedEntries.push(entry)
      },
      { concurrency: saveOptions.concurrency }
    )
  } catch (err) {
    if (err.message !== 'TIMEOUT') {
      throw err
    } else {
      log(
        'warn',
        `saveFile timeout: still ${entries.length - savedEntries.length} / ${
          entries.length
        } to download`
      )
    }
  }

  log(
    'info',
    `saveFiles created ${savedFiles} files for ${
      savedEntries ? savedEntries.length : 'n'
    } entries`
  )
  return savedEntries
}

const saveEntry = async function(entry, options) {
  if (options.timeout && Date.now() > options.timeout) {
    const remainingTime = Math.floor((options.timeout - Date.now()) / 1000)
    log('info', `${remainingTime}s timeout finished for ${options.folderPath}`)
    throw new Error('TIMEOUT')
  }
  let file = path.join(options.folderPath, getFileName(entry))
  let shouldReplace = false
  if (file) {
    try {
      shouldReplace = await shouldReplaceFile(file, entry, options)
    } catch (err) {
      log('info', `Error in shouldReplace : ${err.message}`)
      shouldReplace = true
    }
  }

  let method = 'create'

  if (shouldReplace && file) {
    method = 'updateById'
    log('info', `Will replace ` + path.basename(file) +`...`)
  }

  try {
    if (!file || method === 'updateById') {
      log('debug', omit(entry, 'filestream'))
      logFileStream(entry.filestream)
      log(
        'debug',
        `File ` + path.basename(file) + `does not exist yet or is not valid`
      )
      entry._cozy_file_to_create = true
      file = await retry(createFile, {
        interval: 1000,
        throw_original: true,
        max_tries: options.retry,
        args: [entry, options, method, file ? file._id : undefined]
      }).catch(err => {
        if (err.message === 'BAD_DOWNLOADED_FILE') {
          log(
            'warn',
            `Could not download file after ${
              options.retry
            } tries removing the file`
          )
        } else {
          log('warn', 'unknown file download error: ' + err.message)
        }
      })
    }

    attachFileToEntry(entry, file)

    sanitizeEntry(entry)
    if (options.postProcess) {
      await options.postProcess(entry)
    }
  } catch (err) {
    if (getErrorStatus(err) === 413) {
      // the cozy quota is full
      throw new Error(errors.DISK_QUOTA_EXCEEDED)
    }
    log('warn', errors.SAVE_FILE_FAILED)
    log(
      'warn',
      err.message,
      `Error caught while trying to save the file ${
        entry.fileurl ? entry.fileurl : entry.filename
      }`
    )
  }
  return entry
}

async function getFileIfExists(entry, options) {
  const fileIdAttributes = options.fileIdAttributes
  if (!fileIdAttributes) {
    log(
      'warn',
      `saveFiles: no deduplication key is defined, file deduplication will be based on file path`
    )
  }

  const isReadyForFileMetadata =
    fileIdAttributes && slug && sourceAccountIdentifier
  if (isReadyForFileMetadata) {
    const file = await getFileFromMetaData(
      entry
    )
    if (!file) {
      // no file with correct metadata, maybe the corresponding file already exist in the default
      // path from a previous version of the connector
      return await getFileFromPath(entry, options)
    } else return file
  } else {
    return await getFileFromPath(entry, options)
  }
}

async function getFileFromMetaData(entry) {
  return null
}

async function getFileFromPath(entry, options) {
  try {
    
    sCheminComplet = path.join(options.folderPath,getFileName(entry))
    if (fs.existsSync(sCheminComplet)) 
        return sCheminComplet
    else
        return null
    const result = await cozy.files.statByPath(getFilePath({ entry, options }))
    return result
  } catch (err) {
    log('debug', err.message)
    return false
  }
}

async function createFile(entry, options, method, fileId) {
  
  let createFileOptions = {
    name: getFileName(entry),
    dir: options.folderPath
  }
  if (options.contentType) {
    if (options.contentType === true && entry.filename) {
      createFileOptions.contentType = mimetypes.contentType(entry.filename)
    } else {
      createFileOptions.contentType = options.contentType
    }
  }
  createFileOptions = {
    ...createFileOptions,
    ...entry.fileAttributes,
  }

  if (options.fileIdAttributes) {
    createFileOptions = {
      ...createFileOptions,
      ...{
        metadata: {
          fileIdAttributes: calculateFileKey(entry, options.fileIdAttributes)
        }
      }
    }
  }

  const toCreate =
    entry.filestream || downloadEntry(entry, { ...options, simple: false })
    
    finalPath = path.join(options.folderPath,entry.filename)
    if (toCreate.pipe) {
      let writeStream = fs.createWriteStream(finalPath)
      toCreate.pipe(writeStream)

      toCreate.on('end', () => {
        log('info', `File ${finalPath} created`)
        //resolve(fileDoc)
      })
      writeStream.on('error', err => {
        log('warn', `Error : ${err} while trying to write file`)
        
      })
    } else {
      // file is a string
      fs.writeFileSync(finalPath, toCreate)
      resolve(fileDoc)
    } 




  if (options.validateFile) {
    if ((await options.validateFile(fileDocument)) === false) {
      await removeFile(fileDocument)
      throw new Error('BAD_DOWNLOADED_FILE')
    }

    if (
      options.validateFileContent &&
      !(await options.validateFileContent(fileDocument))
    ) {
      await removeFile(fileDocument)
      throw new Error('BAD_DOWNLOADED_FILE')
    }
  }

  return fileDocument
}

function downloadEntry(entry, options) {
  let filePromise = getRequestInstance(entry, options)(
    getRequestOptions(entry, options)
  )

  if (options.contentType) {
    // the developper wants to foce the contentType of the document
    // we pipe the stream to remove headers with bad contentType from the request
    return filePromise.pipe(new stream.PassThrough())
  }

  // we have to do this since the result of filePromise is not a stream and cannot be taken by
  // cozy.files.create
  if (options.postProcessFile) {
    log(
      'warn',
      'Be carefull postProcessFile option is deprecated. You should use the filestream attribute in each entry instead'
    )
    return filePromise.then(data => options.postProcessFile(data))
  }
  filePromise.catch(err => {
    log('warn', `File download error ${err.message}`)
  })
  return filePromise
}

const shouldReplaceFile = async function(file, entry, options) {
  const isValid = !options.validateFile || (await options.validateFile(file))
  if (!isValid) {
    log(
      'warn',
      path.basename(file) + ` is invalid`
    )
    throw new Error('BAD_DOWNLOADED_FILE')
  }
  const defaultShouldReplaceFile = (file, entry) => {
    // replace all files with meta if there is file metadata to add
    const fileHasNoMetadata = !getAttribute(file, 'metadata')
    const fileHasNoId = !getAttribute(file, 'metadata.fileIdAttributes')
    const entryHasMetadata = !!get(entry, 'fileAttributes.metadata')
    const hasSourceAccountIdentifierOption = !!get(
      options,
      'sourceAccountOptions.sourceAccountIdentifier'
    )
    const fileHasSourceAccountIdentifier = !!getAttribute(
      file,
      'cozyMetadata.sourceAccountIdentifier'
    )
    const result =
      (fileHasNoMetadata && entryHasMetadata) ||
      (fileHasNoId && !!options.fileIdAttributes) ||
      (hasSourceAccountIdentifierOption && !fileHasSourceAccountIdentifier)
    return result
  }
  const shouldReplaceFileFn =
    entry.shouldReplaceFile ||
    options.shouldReplaceFile ||
    defaultShouldReplaceFile

  return shouldReplaceFileFn(file, entry)
}

const removeFile = async function(file) {
  await cozy.files.trashById(file._id)
  await cozy.files.destroyById(file._id)
}

module.exports = saveFiles
module.exports.getFileIfExists = getFileIfExists

function getFileName(entry) {
  let filename
  if (entry.filename) {
    filename = entry.filename
  } else if (entry.fileurl) {
    // try to get the file name from the url
    const parsed = require('url').parse(entry.fileurl)
    filename = path.basename(parsed.pathname)
  } else {
    log('error', 'Could not get a file name for the entry')
    return false
  }
  return sanitizeFileName(filename)
}

function sanitizeFileName(filename) {
  return filename.replace(/^\.+$/, '').replace(/[/?<>\\:*|":]/g, '')
}

function checkFileSize(filepath) {

  if (!fs.existsSync(filepath))
  {
    log('info',`Le fichier ${filepath} n\'existe pas`)
    return false
  }
  
  let stats = fs.statSync(filepath);
  let size = stats.size;
  let name = path.basename(filepath)
  
  if (size === 0 || size === '0') {
    log('warn', `${name} is empty`)
    log('warn', 'BAD_FILE_SIZE')
    return false
  }
  return true
}

function checkMimeWithPath(fileDocument) {
  return true
}

function logFileStream(fileStream) {
  if (!fileStream) return

  if (fileStream && fileStream.constructor && fileStream.constructor.name) {
    log(
      'info',
      `The fileStream attribute is an instance of ${
        fileStream.constructor.name
      }`
    )
  } else {
    log('info', `The fileStream attribute is a ${typeof fileStream}`)
  }
}

async function getFiles(folderPath) {
  const dir = await cozy.files.statByPath(folderPath)
  const files = await queryAll('io.cozy.files', { dir_id: dir._id })
  return files
}

async function renameFile(file, entry) {
  if (!entry.filename) {
    throw new Error('shouldReplaceName needs a filename')
  }
  log('debug', `Renaming ${file.name} to ${entry.filename}`)
  try {
    await cozy.files.updateAttributesById(file._id, { name: entry.filename })
  } catch (err) {
    if (JSON.parse(err.message).errors.shift().status === '409') {
      log('warn', `${entry.filename} already exists. Removing ${file.name}`)
      await cozy.files.trashById(file._id)
    }
  }
}

function getErrorStatus(err) {
  try {
    return Number(JSON.parse(err.message).errors[0].status)
  } catch (e) {
    return null
  }
}

function getValOrFnResult(val, ...args) {
  if (typeof val === 'function') {
    return val.apply(val, args)
  } else return val
}

function calculateFileKey(entry, fileIdAttributes) {
  return fileIdAttributes
    .sort()
    .map(key => get(entry, key))
    .join('####')
}

function defaultValidateFile(fileDocument) {
  return checkFileSize(fileDocument) && checkMimeWithPath(fileDocument)
}

async function defaultValidateFileContent(fileDocument) {
  const response = await cozy.files.downloadById(fileDocument._id)
  const mime = getAttribute(fileDocument, 'mime')
  const fileTypeFromContent = fileType(await response.buffer())
  if (!fileTypeFromContent) {
    log('warn', `Could not find mime type from file content`)
    return false
  }

  if (!defaultValidateFile(fileDocument) || mime !== fileTypeFromContent.mime) {
    log(
      'warn',
      `Wrong file type from content ${JSON.stringify(fileTypeFromContent)}`
    )
    return false
  }
  return true
}

function sanitizeEntry(entry) {
  delete entry.requestOptions
  delete entry.filestream
  delete entry.shouldReplaceFile
  return entry
}

function getRequestInstance(entry, options) {
  return options.requestInstance
    ? options.requestInstance
    : requestFactory({
        json: false,
        cheerio: false,
        userAgent: true,
        jar: true
      })
}

function getRequestOptions(entry, options) {
  const defaultRequestOptions = {
    uri: entry.fileurl,
    method: 'GET'
  }

  if (!options.requestInstance) {
    // if requestInstance is already set, we suppose that the connecteur want to handle the cookie
    // jar itself
    defaultRequestOptions.jar = true
  }

  return {
    ...defaultRequestOptions,
    ...entry.requestOptions
  }
}

function attachFileToEntry(entry, fileDocument) {
  entry.fileDocument = fileDocument
  return entry
}

function getFilePath({ file, entry, options }) {
  const folderPath = options.folderPath
  if (file) {
    return path.join(folderPath, getAttribute(file, 'name'))
  } else if (entry) {
    return path.join(folderPath, getFileName(entry))
  }
}

function getAttribute(obj, attribute) {
  return get(obj, `attributes.${attribute}`, get(obj, attribute))
}



/*const log = require('../libs/log')
const fs = require('fs')
const request = require('./request')
 
function saveFiles(documents, fields)
{
    // documents : tableau d'objets contenant la liste des documents à récupérer
    // Membres obligatoires : 
    // fileurl, filename.
    // fields : les paramètres du connecteur (login, mot de passe, répertoire des données, ...)
    // Parcours tous les éléments
    documents.forEach(pclElement => {

        // Calcule le nom de l'élément
        // soit c'est le filename s'il est précisé, soit c'est le nom du fichier
        if (pclElement.filename)
        {
            sNomFichier = pclElement.filename;
        }else{
            sNomFichier = pclElement.vendor + '_' + pclElement.title
            
        }
        var sCheminComplet = '';
        // Pour chaque élément, on vérifie si le fichier existe déjà, 
        // donc on construit le chemin complet
        sCheminComplet = fields.DataDirectory + sNomFichier;

        // Télécharge le fichier 
        TelechargeFichier(pclElement.fileurl, sCheminComplet);

//        docs.push({
//            title: sTitre,
//            fileurl: sFileURL,
//            date: sDate,
//            filename: sFileName
//          })


    });

}
async function TelechargeFichier(sFileURL, sCheminComplet)
{
    // Si le fichier existe, on le télécharge pas

    if (fs.existsSync(sCheminComplet)) 
    {
        log('Le fichier <' + sCheminComplet + '> existe déjà, on ne le télécharge pas' )
        return true;
    }
    
    // Télécharge le fichier
    request(sFileURL).pipe(fs.createWriteStream(sCheminComplet))

}


// On exporte les modules
module.exports = saveFiles

*/