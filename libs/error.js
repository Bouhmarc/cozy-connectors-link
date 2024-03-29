const log = require('./log')

const handleUncaughtException = err => {
  log('critical', err.message, 'uncaught exception')
  process.exit(1)
}

const handleUnhandledRejection = err => {
  log('critical', err.message, 'unhandled exception')
  process.exit(1)
}

const handleSigterm = () => {
  log('critical', 'The konnector got a SIGTERM')
  process.exit(128 + 15)
}

const handleSigint = () => {
  log('critical', 'The konnector got a SIGINT')
  process.exit(128 + 2)
}

let attached = false

/**
 * Attach event handlers to catch uncaught exceptions/rejections and signals.
 * Log them as critical and exit the process accordingly.
 * If the cleanup function has not been called, calling again the function
 * is a no-op.
 *
 * @param  {Process} prcs - Process object, default to current process
 * @returns {Function} When called, removes the signal handlers
 */
const attachProcessEventHandlers = (prcs = process) => {
  if (attached) {
    return
  }
  attached = true
  prcs.on('uncaughtException', handleUncaughtException)
  prcs.on('unhandledRejection', handleUnhandledRejection)
  prcs.on('SIGTERM', handleSigterm)
  prcs.on('SIGINT', handleSigint)

  return () => {
    attached = false
    prcs.removeEventListener('uncaughtException', handleUncaughtException)
    prcs.removeEventListener('unhandledRejection', handleUnhandledRejection)
    prcs.removeEventListener('SIGTERM', handleSigterm)
    prcs.removeEventListener('SIGINT', handleSigint)
  }
}

module.exports = {
  attachProcessEventHandlers
}