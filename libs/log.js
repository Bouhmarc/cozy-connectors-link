const Secret = require('./Secret')


function log(sNiveau, sMessage){
    console.log(getColor(sNiveau),sMessage + '( ' + __filename +')');
   
    if (sNiveau == 'critical'){
        var e = new Error()
        console.log(getColor(sNiveau), e.stack)
    }
}

function getColor(sNiveau){
    var Reset = "\x1b[0m"
    var Bright = "\x1b[1m"
    var Dim = "\x1b[2m"
    var Underscore = "\x1b[4m"
    var Blink = "\x1b[5m"
    var Reverse = "\x1b[7m"
    var Hidden = "\x1b[8m"

    var FgBlack = "\x1b[30m"
    var FgRed = "\x1b[31m"
    var FgGreen = "\x1b[32m"
    var FgYellow = "\x1b[33m"
    var FgBlue = "\x1b[34m"
    var FgMagenta = "\x1b[35m"
    var FgCyan = "\x1b[36m"
    var FgWhite = "\x1b[37m"

    var BgBlack = "\x1b[40m"
    var BgRed = "\x1b[41m"
    var BgGreen = "\x1b[42m"
    var BgYellow = "\x1b[43m"
    var BgBlue = "\x1b[44m"
    var BgMagenta = "\x1b[45m"
    var BgCyan = "\x1b[46m"
    var BgWhite = "\x1b[47m"

    switch (sNiveau){
        case 'info':
        {
            return FgBlack + "%s" + Reset   
        }
        case 'warning':
        case 'Warning':
        case 'warn':
        {
            return FgYellow + "%s" + Reset
        }
        case 'critical':
        {
            return FgRed + "%s" + Reset
        }  
        case 'debug':
        {
            return FgBlue + "%s" + Reset
        }
        default:
            {
                return Reset + "("+sNiveau + ") %s" + Reset
            }
    }



}
module.exports = log

log.Secret = Secret