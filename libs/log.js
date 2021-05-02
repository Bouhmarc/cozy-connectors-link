const Secret = require('./Secret')


function log(sNiveau, sMessage){
    console.log(sNiveau + ' : ' + sMessage + '( ' + __filename +')');
}

module.exports = log

log.Secret = Secret