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
const nodemailer = require('nodemailer');

const Compendium = require('../lib/model/compendium');
const path = require('path');
const fs = require('fs');
const url = require('url');
const createClient = require('webdav');
const https = require('https');
const htmlparser = require('htmlparser2');

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

function publicShareLoad(passon) {
    debug('Loading file list from sciebo');

    // Extract owncloud share token from share URL
    let token = url.parse(passon.shareURL).path.split('/')[3];

    //build webdav url for the client from share URL (replace "/index.php/s/<share_token>" with "public.php/webdav")
    let webdavURL = passon.shareURL.replace(new RegExp(/index.php\/s\/[a-zA-Z0-9]+/), config.webdav.urlString);

    passon.client = createClient(
        webdavURL,
        token,
        ''
    );

    /*  1. bagit.txt             -> download compendium as zip and continue
        2. single zip file       -> download zip and continue
        3. single directory      -> error (no compendium found)
        4. multiple files        -> workspace (not implemented)
        5. multiple directories  -> workspace (not implemented)
    */

    return getContents(passon)
    .then(analyzeContents)
    .then(checkContents)
    .then(checkAndCopyCompendium)
    .then(checkAndLoadZip)
    .then(checkAndLoadDirectory)
    .then(loadWorkspace)
    .catch(function (err) {
        debug('Error loading public share: %s', err);
        throw err;
    });
}

/**
 * Loads filename(s) from the zenodo record by parsing the HTML document
 * @param {string} passon.zenodoID - The zenodo record id.
 * @param {string} passon.baseURL - The zenodo URL without a path (https://zenodo.org or https://sandbox.zenodo.org).
 */
function checkZenodoContents(passon){
    return new Promise((fulfill, reject) => {
        if (typeof passon.filename !== 'undefined') {
            debug('Filename for record %s already specified. Continuing with download.', passon.zenodoID);
            passon.zenodoLink = passon.baseURL + path.join('record/', passon.zenodoID, '/files/', passon.filename);
            fulfill(passon);
            return;
        }

        let requestURL = passon.baseURL + 'record/' + passon.zenodoID;

        https.get(requestURL, (res) => {
            debug('Fetched zenodo contents, statusCode:', res.statusCode);
            if (res.statusCode !== 200) {
                debug('Error: No Zenodo record found at %s!', requestURL);
                let err = new Error('Zenodo record not found!');
                err.status = 404;
                reject(err);
                return;      
            }

            res.on('data', (d) => {
                debug('Loading zenodo html document...');

                let zenodoLinks = [];
                //parse the html document and extract links such as "<link rel="alternate" type="application/zip" href="https://sandbox.zenodo.org/record/69114/files/metatainer.zip">"
                var parser = new htmlparser.Parser({
                onopentag: function(name, attribs){
                    if(name === 'link' && attribs.rel === 'alternate' && attribs.type === 'application/zip'){
                        //save links to files in zenodoLinks
                        zenodoLinks.push(attribs.href);
                    }
                }
                }, {decodeEntities: true});
                parser.write(d.toString());
                parser.end();

                if (zenodoLinks.length === 0) { //If the parser did not find any zip files in the HTML document
                    debug('No files found in zenodo deposit.');
                    let err = new Error('No files found in zenodo deposit.');
                    err.status = 404;
                    reject(err);                    
                }

                // Handle only the first zip file (for now)
                passon.zenodoLink = zenodoLinks[0];
                debug('Parsing zenodo contents completed');
                fulfill(passon);
            });

        }).on('error', (e) => {
            debug('Loading file list failed, error: %s', e);
            e.status = 404;
            e.message = 'Loading file list failed';
            reject(e); 
        });
    });
}

/**
 * Currently not in use!
 * Loads metadata (filenames, ...) from a zenodo deposit using the zenodo developer API.
 * Currently not used because the zenodo developer API only allows access to your personal files
 * @param {string} passon.zenodoID - The zenodo record id.
 * @param {string} passon.baseURL - The zenodo URL without a path (https://zenodo.org or https://sandbox.zenodo.org).
 * @param {string} config.zenodo.token - The user's zenodo dev access_token
 */
function checkZenodoContentsViaAPI(passon){
    return new Promise((fulfill, reject) => {
        debug('Checking files in Zenodo deposit');

        let requestURL = passon.baseURL + 'api/deposit/depositions/' + passon.zenodoID;

        if (!config.zenodo.token){
            debug('ZENODO_TOKEN not set');
            let err = new Error('ZENODO_TOKEN not set');
            err.status = 404;
            reject(err);
            return;
        } else {
            requestURL += '?access_token=' + config.zenodo.token;
        }
        debug('Getting data on zenodo record %s with request %s', passon.zenodoID, requestURL);

        https.get(requestURL, (res) => {
            debug('Fetched zenodo contents, statusCode:', res.statusCode);

            res.on('data', (d) => {
                // check files length
                let data = JSON.parse(d);
                if (data.files.length === 0) {
                    debug('No files found in zenodo deposit.');
                    let err = new Error('No files found in zenodo deposit.');
                    err.status = 404;
                    reject(err);                    
                }
                passon.zenodoFiles = [];
                passon.zenodoFiles = data.files;
                passon.filename = data.files[0].filename;
                //passon.zenodoLink = data.files[0].links.download;
                //process.stdout.write(data);
                debug('Reading zenodo record completed');
                fulfill(passon);
            });

        }).on('error', (e) => {
            debug('Loading file list failed, error: %s', e);
            e.status = 404;
            e.message = 'Loading file list failed';
            reject(e); 
        });

    });
}


/**
 * Loads a single file from zenodo.org or sandbox.zenodo.org
 * @param {string} passon.zenodoLink - The download link of the first zip file in the zenodo record.
 * @param {string} passon.zenodoID - The zenodo record id.
 * @param {string} passon.baseURL - The zenodo URL without a path (https://zenodo.org or https://sandbox.zenodo.org).
 */
function zenodoLoad(passon) {
    return new Promise((fulfill, reject) => {
        debug('Loading files from Zenodo');
        var zipPath = path.join(config.fs.incoming, passon.id);
        var cmd = 'wget -q -O ' + zipPath + ' ' + passon.zenodoLink;
        passon.result = {};
        passon.result.zipName = passon.zenodoLink;

        debug('Downloading: "%s"', cmd);
        exec(cmd, (error, stdout, stderr) => {
            if (error || stderr) {
                debug(error, stderr, stdout);
                let errors = error.message.split(':');
                let message = errorMessageHelper(errors[errors.length - 1]);
                error.message = JSON.stringify({ error: 'download failed: ' + message });
                error.status = 500;
                reject(error);
            } else {
                debug('Download of zenodo record %s complete!', passon.id);
                passon.zipPath = zipPath;
                fulfill(passon);
            }
        });
    });
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

        for (var i = 0; i < contents.length; i++) {
            if (contents[i].basename === 'bagit.txt') {
                result.bagitCount++;
            }
            if (contents[i].mime === 'application/zip') {
                result.zipCount++;
                result.zipName = contents[i].basename;
                if (result.zipName === 'webdav') { // return an error message if a zip file is submitted directly
                    debug('Direct file submission is not supported.');
                    let err = new Error('Direct file submission is not supported. Please submit a shared folder containing the file.');
                    err.status = 404;
                    reject(err);
                }
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
            let err = new Error('public share is empty');
            err.status = 404;
            reject(err);
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
                    error.message = JSON.stringify({ error: 'download failed: ' + message });
                    error.status = 500;
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
                .catch(function (err) {
                    debug(err);
                    err.status = 404;
                    err.message = 'could not download zip file';
                    reject(err);
                });
        } else {
            fulfill(passon);
        }
    });
}

function checkAndLoadDirectory(passon) {
    //Check if a single directory exists -> throw error
    return new Promise((fulfill, reject) => {
        if (passon.result.directoryCount === 1 && passon.result.bagitCount === 0 && passon.result.zipCount !== 1) {
            let err = new Error('Single directory found. Use the "path" parameter to point to the compendium directory.');
            err.status = 404;
            reject(err);
        } else {
            fulfill(passon);
        }
    });
}

function loadWorkspace(passon) {
    //workspace not supported, implement here
    return new Promise((fulfill, reject) => {
        if (passon.result.directoryCount !== 1 && passon.result.bagitCount === 0 && passon.result.zipCount !== 1) {
            let err = new Error('workspace creation not implemented');
            err.status = 403;
            reject(err);
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
            cmd += ' && rm ' + passon.zipPath;
            if (!passon.result.zipName) {
                cmd += ' && rm -r ' + tempPath;
            }
        }

        debug('Unzipping command "%s"', cmd);
        exec(cmd, (error, stdout, stderr) => {
            if (error || stderr) {
                debug(error, stderr, stdout);
                let errors = error.message.split(':');
                let message = errorMessageHelper(errors[errors.length - 1]);
                error.message = JSON.stringify({ error: 'extraction failed: ' + message });
                error.status = 500;
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

                            let err = new Error('Virus scan found infected file(s) in directory');
                            err.status = 422;
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

        let metaextract_input_dir = path.join(passon.bagpath, config.bagtainer.payloadDirectory);
        let metaextract_output_dir = path.join(metaextract_input_dir, config.bagtainer.metaextract.outputDir);

        let cmd = [
            config.bagtainer.metaextract.cliPath,
            '-debug',
            config.bagtainer.metaextract.module,
            '--inputdir', metaextract_input_dir,
            '--outputdir', metaextract_output_dir,
            '--metafiles', // save all raw files
            '--ercid', passon.id // pass the erc id
            //'-xo' // disable calls to ORCID API
        ].join(' ');

        debug('[%s] Running metadata extraction with command "%s"', passon.id, cmd);
        exec(cmd, (error, stdout, stderr) => {
            if (error || stderr) {
                debug('[%s] Problem during metadata extraction:\n\t%s\n\t%s',
                    passon.id, error.message, stderr.message);
                debug(error, stderr, stdout);
                let errors = error.message.split(':');
                let message = errorMessageHelper(errors[errors.length - 1]);
                error.message = JSON.stringify({ error: 'metadata extraction failed: ' + message });
                reject(error);
            } else {
                debug('[%s] Completed metadata extraction:\n\n%s\n', passon.id, stdout);

                // check if metadata was found, if so put the metadata directory into passon
                fs.readdir(metaextract_output_dir, (err, files) => {
                    if (err) {
                        debug('[%s] Error reading metadata directory %s [fail the upload? %s]:\n\t%s', passon.id,
                            metaextract_output_dir,
                            config.bagtainer.metaextract.failOnNoMetadata, err);
                        if (config.bagtainer.metaextract.failOnNoMetadata) {
                            reject(err);
                        } else {
                            debug('[%s] Continuing with empty metadata (A) ...', passon.id);
                            fulfill(passon);
                        }
                    } else if (files.length < 1) {
                        debug('[%s] Metadata extraction directory %s is empty [fail the upload? %s]:\n\t%s', passon.id,
                            metaextract_output_dir,
                            config.bagtainer.metaextract.failOnNoMetadata, err);
                        if (config.bagtainer.metaextract.failOnNoMetadata) {
                            reject(new Error('No files in the metadata directory'));
                        } else {
                            debug('[%s] Continuing with empty metadata (B) ...', passon.id);
                            fulfill(passon);
                        }
                    } else {
                        debug('[%s] Finished metadata extration and created %s metadata files: %s', passon.id,
                            files.length, JSON.stringify(files));
                        passon.metadata_dir = metaextract_output_dir;
                        fulfill(passon);
                    }
                });
            }
        });
    });
}

function loadMetadata(passon) {
    return new Promise((fulfill, reject) => {
        if (passon.metadata_dir) {
            let mainMetadataFile = path.join(passon.metadata_dir, config.bagtainer.metaextract.bestCandidateFile);
            debug('[%s] Loading metadata from %s', passon.id, mainMetadataFile);

            fs.readFile(mainMetadataFile, (err, data) => {
                if (err) {
                    debug('[%s] Error reading metadata file: %s [fail? %s]', passon.id, err.message,
                        config.bagtainer.metaextract.failOnNoMetadata);
                    if (config.bagtainer.metaextract.failOnNoMetadata) {
                        reject(new Error('no metadata found in the metadata extraction directory'));
                    } else {
                        debug('[%s] Continuing with empty metadata (C) ...', passon.id);
                        fulfill(passon);
                    }
                } else {
                    passon.metadata = {};
                    passon.metadata.raw = JSON.parse(data);
                    passon.metadata.raw.source = passon.shareURL;
                    debug('[%s] Finished metadata loading!', passon.id);
                    fulfill(passon);
                }
            });
        } else {
            debug('[%s] Cannot load metadata, metadata_dir is not available in passon', passon.id);
            if (config.bagtainer.metaextract.failOnNoMetadata) {
                reject(new Error('no metadata directory provided by previous steps'));
            } else {
                debug('[%s] Continuing with empty metadata (D) ...', passon.id);
                fulfill(passon);
            }
        }
    });
}

function brokerMetadata(passon) {
    return new Promise((fulfill, reject) => {
        debug('[%s] Brokering metadata', passon.id);

        if (passon.metadata) {
            if (passon.metadata.raw) {
                passon.metadata[config.bagtainer.metaextract.targetElement] = passon.metadata.raw;

                // add some placeholders to show brokering happened
                passon.metadata.zenodo = { title: passon.metadata.o2r.title };
                passon.metadata.cris = { title: passon.metadata.o2r.title };
                passon.metadata.orcid = { title: passon.metadata.o2r.title };
                passon.metadata.datacite = { title: passon.metadata.o2r.title };
            } else {
                debug('[%s] No _raw_ metadata provided that could be brokered!', passon.id);
            }
        } else {
            debug('[%s] No metadata provided that could be brokered!', passon.id);
        }

        debug('[%s] Finished brokering!', passon.id);
        fulfill(passon);
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
                err.message = JSON.stringify({ error: 'internal error' });
                err.status = 500;
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
    brokerMetadata: brokerMetadata,
    save: save,
    cleanup: cleanup,
    publicShareLoad: publicShareLoad,
    zenodoLoad: zenodoLoad,
    checkZenodoContents: checkZenodoContents
};
