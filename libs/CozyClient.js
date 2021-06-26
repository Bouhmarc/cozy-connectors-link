class File {
    create ()
    { 
        return true 
    }

    createDirectory ()
    { 
        return true 
    }

    createDirectoryByPath ()
    { 
        return true 
    }
    updateById ()
    { 
        return true 
    }
    updateAttributesById ()
    { 
        return true 
    }
    updateAttributesByPath (path, oOptions)
    { 

        return {
            attributes:{
                path:path
            }
        }
    }
    /*
    trashById ()
    { 
        return true 
    }
    statById ()
    { 
        return true 
    }
    statByPath ()
    { 
        return true 
    }
    downloadById ()
    { 
        return true 
    }
    downloadByPath ()
    { 
        return true 
    }
    getDownloadLinkById ()
    { 
        return true 
    }
    getDownloadLink: files.getDownloadLinkByPath, // DEPRECATED, should be removed very soon
    getDownloadLinkByPath: files.getDownloadLinkByPath,
    getArchiveLink: function(...args) {
        warn(
        'getArchiveLink is deprecated, use cozy.files.getArchiveLinkByPaths instead.'
        )
        return files.getArchiveLinkByPaths(...args)
    },
    getArchiveLinkByPaths: files.getArchiveLinkByPaths,
    getArchiveLinkByIds: files.getArchiveLinkByIds,
    getFilePath: files.getFilePath,
    getCollectionShareLink: files.getCollectionShareLink,
    query: mango.queryFiles,
    listTrash: files.listTrash,
    clearTrash: files.clearTrash,
    restoreById: files.restoreById,
    destroyById: files.destroyById
*/
}

class CozyData {
    updateAttributes (sAPI, nID, oAccount) {
        return {
            ...oAccount, 
            _id:nID
        }
    }
}

class Client {
    constructor () {
        this.files = new File()
        this.data = new CozyData()
    }



}

module.exports = new Client();