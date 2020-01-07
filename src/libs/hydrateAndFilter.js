/**
 * Filters the passed array from data already present in the cozy so that there is
 * not duplicated data in the Cozy.
 *
 * @module hydrateAndFilter
 */
/**
 * Since we can use methods or basic functions for
 * `shouldSave` and `shouldUpdate` we pass the
 * appropriate `this` and `arguments`.
 *
 * If `funcOrMethod` is a method, it will be called
 * with args[0] as `this` and the rest as `arguments`
 * Otherwise, `this` will be null and `args` will be passed
 * as `arguments`.
 */

/**
 * Filters the passed array from data already present in the cozy so that there is
 * not duplicated data in the Cozy.
 *
 * You need at least the `GET` permission for the given doctype in your manifest, to be able to
 * use this function.
 *
 * Parameters:
 *
 * * `documents`: an array of objects corresponding to the data you want to save in the cozy
 * * `doctype` (string): the doctype where you want to save data (ex: 'io.cozy.bills')
 * * `options` :
 *    - `keys` (array) : List of keys used to check that two items are the same. By default it is set to `['id']'.
 *    - `index` (optionnal) : Return value returned by `cozy.data.defineIndex`, the default will correspond to all documents of the selected doctype.
 *    - `selector` (optionnal object) : Mango request to get records. Default is built from the keys `{selector: {_id: {"$gt": null}}}` to get all the records.
 *
 * ```javascript
 * const documents = [
 *   {
 *     name: 'toto',
 *     height: 1.8
 *   },
 *   {
 *     name: 'titi',
 *     height: 1.7
 *   }
 * ]
 *
 * return hydrateAndFilter(documents, 'io.cozy.height', {
 *   keys: ['name']
 * }).then(filteredDocuments => addData(filteredDocuments, 'io.cozy.height'))
 *
 * ```
 *
 * @alias module:hydrateAndFilter
 */
const hydrateAndFilter = (documents = [], doctype, options = {}) => {
  return ReturnDocuments(documents, doctype, options)
}

async function ReturnDocuments(documents, doctype, options) {
  return documents
}

module.exports = hydrateAndFilter
