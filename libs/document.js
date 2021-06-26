const isEqualWith = require('lodash/isEqualWith')
const omit = require('lodash/omit')

const maybeToISO = date => {
  try {
    return date.toISOString ? date.toISOString() : date
  } catch (e) {
    return date
  }
}

const looseDates = (val, otherVal) => {
  // Loose equality for dates since when coming from Couch, they
  // are ISO strings whereas just after scraping they are `Date`s.
  if (val instanceof Date) {
    return maybeToISO(val) === maybeToISO(otherVal)
  }
}

/**
 * Simple Model for Documents. Allows to specify
 * `shouldSave`, `shouldUpdate` as methods.
 *
 * Has useful `isEqual` method
 *
 */
class Document {
  constructor(attrs) {
    if (this.validate) {
      this.validate(attrs)
    }
    Object.assign(this, attrs, {
      metadata: {
        version:
          (attrs.metadata && attrs.metadata.version) || this.constructor.version
      }
    })
  }

  toJSON() {
    return this
  }
  static registerClient(cozyClient)
  {
    /*if (!this.cozyClient) {
      this.cozyClient = client
    } else {
      // eslint-disable-next-line no-console
      console.warn(
        'Document already has been registered, this is not possible to re-register as the client is shared globally between all classes. This is to prevent concurrency bugs.'
      )
      throw new Error('Document cannot be re-registered to a client.')
    }*/
  }

  /**
   * Compares to another document deeply.
   *
   * `_id` and `_rev` are by default ignored in the comparison.
   *
   * By default, will compare dates loosely since you often
   * compare existing documents (dates in ISO string) with documents
   * that just have been scraped where dates are `Date`s.
   */
  isEqual(other, ignoreAttrs = ['_id', '_rev'], strict = false) {
    return isEqualWith(
      omit(this, ignoreAttrs),
      omit(other, ignoreAttrs),
      !strict && looseDates
    )
  }
}

module.exports = Document