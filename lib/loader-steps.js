/*
 * (C) Copyright 2016 o2r project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const config = require('../config/config');
const debug = require('debug')('loader');
const exec = require('child_process').exec;
const errorMessageHelper = require('../lib/error-message');
const clone = require('clone');
const nodemailer = require('nodemailer');

const Compendium = require('../lib/model/compendium');
const Stream = require('stream');
const path = require('path');
const fs = require('fs');
const url = require('url');
const createClient = require('webdav');



if (config.bagtainer.scan.enable) {
    debug('Using clamscan with configuration %s', JSON.stringify(clam.settings));
}

// create reusable transporter object using the default SMTP transport
var emailTransporter = null;
var clam = null;
if (config.bagtainer.scan.enable) {
    clam = require('clamscan')(config.bagtainer.scan.settings);
    debug('Virus scanning enabled: %s', JSON.stringify(config.bagtainer.scan.settings));
} else {
    debug('Virus scanning _disabled_');
}
if (config.bagtainer.scan.email.enable
    && config.bagtainer.scan.email.transport
    && config.bagtainer.scan.email.sender
    && config.bagtainer.scan.email.receivers) {

    emailTransporter = nodemailer.createTransport(config.bagtainer.scan.email.transport);
    debug('Sending emails on critical errors to %s', config.bagtainer.scan.email.receivers);
} else {
    debug('Email notification for virus detection _not_ active: %s', JSON.stringify(config.bagtainer.scan.email));
}

/*
    //currently not used & not working
    //recursively sync webdav files
function saveWebdav(passon) {

    return getContents(passon).then(function(passon) {
        return Promise.all(passon.contents.map(function (e) {
            if(e.type === 'file') {
                return saveFile(e);
            } else if (e.type === 'directory') {
                passon.remotePath = e.basename;
                return saveWebdav(passon);
            }
        }))
    })
    .catch(function(err) {
        debug(err);
    });
}
    
function saveFile(passon) {
    //currently not used
    return new Promise((fulfill, reject) => {
        passon.client
        .getFileContents(passon.filename)
        .then(function (file) {
            fs.writeFile(path.join(passon.localPath, passon.remotePath, passon.basename), file);
        });
    });
}
*/

function publicShareLoad(passon) {
        debug('Loading file list from sciebo');

        // Extract owncloud share token from share URL
        let token = url.parse(passon.shareURL).path.split('/')[3];

        passon.client = createClient(
            config.webdav.url,
            token,
            ''
        );

        /*  1. if bagit.txt -> download compendium as zip and continue
            2. if single zip file -> unzip
            3. if single directory -> change to directory and go to 1.
            4. if multiple files -> workspace
            5. if multiple directories -> workspace
        */

        //todo: instead return one promise based on the if conditions!
        return getContents(passon)
        .then(analyzeContents)
        .then(checkContents)
        .then(checkAndCopyCompendium)
        .then(checkAndLoadZip)
        .then(checkAndLoadDirectory)
        //.then(loadWorkspace) (msg -> not implemented)
        .catch(function (err) {
            reject(err);
            console.error(err);
        });
}

function getContents(passon) {
    return new Promise((fulfill, reject) => {
        passon.client
        .getDirectoryContents(passon.webdav_path)
        .then(function(contents) {
            passon.contents = contents;
            debug('Sucessfully loaded file list of %s', passon.shareURL);
            fulfill(passon);
        })
        .catch(function (err) {
            debug(err);
            reject(err);
        });
    })
}

function analyzeContents(passon) {
    return new Promise((fulfill, reject) => {

        let contents = passon.contents;

        let result = {
            bagitCount: 0,
            zipCount: 0,
            directoryCount: 0,
            length: 0
        };

        for (i = 0; i < contents.length; i++) {
            if (contents[i].basename === 'bagit.txt') {
                result.bagitCount++;
            }
            if (contents[i].mime === 'application/zip') {
                result.zipCount++;
                result.zipName = contents[i].basename;
            }
            if (contents[i].type === 'directory') {
                result.directoryCount++;
            }
        }
        result.length = contents.length;
        passon.result = result;
        debug('Content analysis: Found %s bagit.txt, %s zip files, %s directories', result.bagitCount, result.zipCount, result.directoryCount);
        fulfill(passon);
    });
}

function checkContents(passon) {
    return new Promise((fulfill, reject) => {
        if (passon.result.length === 0) {
            debug('Public share is empty');
            reject('Public share is empty');
        } else {
            fulfill(passon);
        }
    }); 
}

function checkAndCopyCompendium(passon) {
    return new Promise((fulfill, reject) => {
        if (passon.result.bagitCount === 0) {
            fulfill(passon);
        } else {
            //wget zip and continue with unzip

            let downloadURL = passon.shareURL + '/download?path=' + encodeURIComponent(passon.webdav_path);
            var zipPath = path.join(config.fs.incoming, passon.id);
            var cmd = 'wget -q -O ' + zipPath + ' ' + downloadURL;

            debug('Downloading: "%s"', cmd);
            exec(cmd, (error, stdout, stderr) => {
                if (error || stderr) {
                    debug(error, stderr, stdout);
                    let errors = error.message.split(':');
                    let message = errorMessageHelper(errors[errors.length - 1]);
                    passon.res.status(500).send(JSON.stringify({ error: 'download failed: ' + message }));
                    reject(error);
                } else {
                    debug('Download of public share %s complete!', passon.id);
                    passon.zipPath = zipPath;
                    fulfill(passon);
                }
            });
        }
    });
}

function checkAndLoadZip(passon) {
    //Check if a single zip file exists -> load and unzip it
    return new Promise((fulfill, reject) => {
        if (passon.result.zipCount === 1 && passon.result.bagitCount === 0) {
            return passon.client
                .getFileContents(path.join(passon.webdav_path, passon.result.zipName))
                .then(function (zipData) {
                    fs.writeFile(path.join(config.fs.incoming, passon.id), zipData, function(err) {
                        if(err) {
                            reject(err);
                        } else {
                            passon.zipPath = path.join(config.fs.incoming, passon.id);
                            debug('Sucessfully loaded zip file for compendium %s', passon.id);
                            fulfill(passon);
                        }
                    });
                })
        } else {
            fulfill(passon);
        }
    });
}

function checkAndLoadDirectory(passon) {
    //Check if a single directory exists -> throw error
    return new Promise((fulfill, reject) => {
        if (passon.result.directoryCount === 1 && passon.result.bagitCount === 0 && passon.result.zipCount !== 1) {
            // call publicShareLoad on directory path?
            reject('Only a single directory found. Use the path parameter to point to the compendium directory');
        } else {
            fulfill(passon);
        }
    });
}

function unzip(passon) {
    return new Promise((fulfill, reject) => {
        debug('Unzipping %s', passon.id);

        var outputPath = path.join(config.fs.compendium, passon.id);
        var tempPath = passon.zipPath + '_tmp';
        var cmd = '';

        if (passon.result.zipName) { //standard zip file contains all files directly and will be extracted to outputPath 
            cmd = 'unzip -uq ' + passon.zipPath + ' -d ' + outputPath;
        } else { //owncloud zip files have an additional parent directory and will be extracted to a temporary directory first
            cmd = 'unzip -uq ' + passon.zipPath + ' -d ' + tempPath;
            cmd += ' && mkdir ' + outputPath + ' && mv ' + tempPath + '/*/* ' + outputPath;
        }

        if (config.fs.delete_inc) { // should incoming files be deleted after extraction?
            //cmd += ' && rm ' + passon.zipPath + ' && rm -r ' + tempPath;
        } 

        debug('Unzipping command "%s"', cmd);
        exec(cmd, (error, stdout, stderr) => {
            if (error || stderr) {
                debug(error, stderr, stdout);
                let errors = error.message.split(':');
                let message = errorMessageHelper(errors[errors.length - 1]);
                passon.res.status(500).send(JSON.stringify({ error: 'extraction failed: ' + message }));
                reject(error);
            } else {
                passon.bagpath = outputPath;
                debug('Unzip of %s complete! Stored in %s', passon.id, passon.bagpath);
                fulfill(passon);
            }
        });
    });
}

function scan(passon) {
    return new Promise((fulfill, reject) => {
        if (!config.bagtainer.scan.enable) {
            fulfill(passon);
        } else if (!clam) {
            fulfill(passon);
        } else {
            debug('Scanning %s for viruses at path %s', passon.id, passon.bagpath);
            clam.scan_dir(passon.bagpath, (error, good, bad) => {
                if (error) {
                    debug(error);
                    reject(error);
                } else {
                    debug('Virus scan completed and had %s good and >> %s << bad files', good.length, bad.length);
                    if (bad.length > 0) {
                        debug('Virus found, deleting directory  %s', passon.bagpath);

                        let badfiles = bad.join('\n\t');
                        debug('Found bad files in:\n\t%s', badfiles);

                        exec('rm -r ' + passon.bagpath, (error, stdout, stderr) => {
                            if (error || stderr) {
                                debug(error, stderr, stdout);
                                debug('Error deleting compendium with virus. File deleted by virus checker? %s)',
                                    clam.settings.remove_infected);
                            } else {
                                debug('Deleted directory %s', passon.bagpath);
                            }

                            if (emailTransporter) {
                                let mail = {
                                    from: config.bagtainer.scan.email.sender, // sender address 
                                    to: config.bagtainer.scan.email.receivers,
                                    subject: '[o2r platform] a virus was detected during upload',
                                    text: 'A virus was detected in a compendium uploaded by user ' + passon.user +
                                    ' in these files:\n\n' + JSON.stringify(bad)
                                };

                                emailTransporter.sendMail(mail, function (error, info) {
                                    if (error) {
                                        debug('Problem sending notification email: %s', error.message);
                                    }
                                    debug('Email sent: %s\n%s', info.response, JSON.stringify(mail));
                                });
                            }

                            let msg = 'Virus scan found infected file(s) in directory'
                            let err = new Error(msg);
                            err.status = 422;
                            err.msg = msg;
                            reject(err);
                        });
                    } else {
                        debug('No viruses found in %s', passon.id);
                        fulfill(passon);
                    }
                }
            });
        }
    });
}

function extractMetadata(passon) {
    return new Promise((fulfill, reject) => {
        debug('Extracting metadata from %s', passon.id);

        // create stream for logging
        let logStream = Stream.Writable();
        logStream.compendium_id = passon.id;
        logStream._write = function (chunk, enc, next) {
            debug('[o2r-meta-extract] [%s] %s', passon.id, chunk);
            next();
        }

        let mountpoint = path.join('/', passon.id, config.bagtainer.payloadDirectory);
        let create_options = clone(config.bagtainer.metaextract.create_options);
        create_options.HostConfig = {};
        create_options.HostConfig.Binds = [
            path.join(passon.bagpath, config.bagtainer.payloadDirectory) + ':'
            + mountpoint + ':rw'
        ];
        let cmd = ['-i', mountpoint,
            '-o', path.join(mountpoint, config.bagtainer.metaextract.outputDir)];

        debug('[%s] Running container with command "%s" and options: %s',
            passon.id, cmd, JSON.stringify(create_options));
        passon.docker.run(config.bagtainer.metaextract.image,
            cmd,
            logStream,
            create_options,
            {},
            (err, data, container) => {
                if (err) {
                    debug('[o2r-meta-extract] [%s] Problem during container run: %s',
                        this.compendium_id, err.message);
                    reject(err);
                    return;
                }
                debug('[%s] Container exit code: %s | container id: %s', passon.id, data.StatusCode, container.id);
                passon.metaextract_container_id = container.id;

                if (data.StatusCode === 0) {
                    // put the raw metadata files into passon
                    let metadataDirectory = path.join(passon.bagpath,
                        config.bagtainer.payloadDirectory,
                        config.bagtainer.metaextract.outputDir);
                    fs.readdir(metadataDirectory, (err, files) => {
                        passon.rawMetadata = [];

                        if (err) {
                            debug('Error reading metadata directory [fail the upload? %s]:\n\t%s',
                                config.bagtainer.metaextract.failOnNoRawMetadata, err);
                            if (config.bagtainer.metaextract.failOnNoRawMetadata) {
                                reject(err);
                            } else {
                                debug('Continueing with empty raw metadata...');
                                fulfill(passon);
                            }
                        } else {
                            files
                                .filter((file) => {
                                    return path.extname(file) === '.json';
                                })
                                .forEach(file => {
                                    passon.rawMetadata.push(path.join(metadataDirectory, file));
                                });
                            debug('Extration created %s raw metadata files: %s',
                                passon.rawMetadata.length, JSON.stringify(passon.rawMetadata));
                            fulfill(passon);
                        }
                    });
                } else {
                    debug('[%s] ERROR: metadata extraction container exited with %s', data.StatusCode);
                    reject(passon);
                }
            });
    });
}

function loadMetadata(passon) {
    return new Promise((fulfill, reject) => {
        debug('Loading metadata for %s using %s', passon.id, JSON.stringify(passon.rawMetadata));

        if (passon.rawMetadata.length > 1) {
            debug('WARNING: More than one raw metadata file given, using only the first one.');
        }

        if (passon.rawMetadata.length < 1) {
            debug('WARNING: No raw metadata file given, no metadata for %s', passon.id);
            fulfill(passon);
        } else {
            fs.readFile(passon.rawMetadata[0], (err, data) => {
                if (err) {
                    debug('Error reading metadata file: %s', err);
                    reject(err);
                } else {
                    passon.metadata = JSON.parse(data);
                    fulfill(passon);
                }
            });
        }
    });
}

function save(passon) {
    return new Promise((fulfill, reject) => {
        debug('Saving %s', passon.id);
        var compendium = new Compendium({
            id: passon.id,
            user: passon.user,
            metadata: passon.metadata
        });

        compendium.save(err => {
            if (err) {
                debug('ERROR saving new compendium %s', passon.id);
                passon.res.status(500).send(JSON.stringify({ error: 'internal error' }));
                reject(err);
            } else {
                debug('Saved new compendium %s', passon.id);
                fulfill(passon);
            }
        });
    });
}

function cleanup(passon) {
    return new Promise((fulfill, reject) => {
        debug('Cleaning up after upload of %s', passon.id);

        if (passon.metaextract_container_id) {
            debug('Deleting metadata extraction container %s', passon.metaextract_container_id);

            var container = passon.docker.getContainer(passon.metaextract_container_id);
            container.remove(function (err, data) {
                if (err) {
                    debug('[%s] Error removing container %s', passon.id, passon.metaextract_container_id);
                    reject(passon);
                } else {
                    debug('[%s] Removed container %s %s', passon.id, passon.metaextract_container_id, data);
                    fulfill(passon);
                }
            });
        } else {
            fulfill(passon);
        }
    });
}

module.exports = {
    unzip: unzip,
    scan: scan,
    extractMetadata: extractMetadata,
    loadMetadata: loadMetadata,
    save: save,
    cleanup: cleanup,
    publicShareLoad: publicShareLoad
};
