/**
 * @module mkdirp
 */

const shell = require('shelljs')
const fs = require('fs')

/**
 * Creates a directory and its missing ancestors as needed.
 *
 * Options :
 *
 * - `...pathComponents`:  one or many path components to be joined
 *
 * ```javascript
 * await mkdirp('/foo') // Creates /foo
 * await mkdirp('/foo') // Does nothing as /foo already exists
 * await mkdirp('/bar/baz') // Creates /bar, then /bar/baz
 * await mkdirp('/foo/bar/baz') // Creates /foo/bar, then /foo/bar/baz, not /foo
 * await mkdirp('/') // Does nothing
 * await mkdirp('/qux', 'qux2/qux3', 'qux4') // Creates /qux, then /qux/qux2,
 *                                           // then /qux/qux2/qux3 and
 *                                           // finally /qux/qux2/qux3/qux4
 * ```
 *
 * The function will automatically add a leading slash when missing:
 *
 * ```javascript
 * await mkdirp('foo', 'bar') // Creates /foo, then /foo/bar
 * ```
 *
 * @alias module:mkdirp
 */

async function mkdirp(path) {
  // Vérifie le répertoire de destination
  if (path && fs.existsSync(path) == false) {
    // Crée le répertoire
    // la création récursive est dispo uniquement a partir de la version 10 de node
    //fs.mkdirSync(saveOptions.folderPath, { recursive: true })
    shell.mkdir('-p', path)
  }
}

module.exports = mkdirp
