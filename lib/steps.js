/*
 * (C) Copyright 2017 o2r project.
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
const objectPath = require('object-path');
const recursiveReaddir = require('recursive-readdir');
const detectCharacterEncoding = require('detect-character-encoding');
const util = require('util');


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
function checkZenodoContents(passon) {
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
                    onopentag: function (name, attribs) {
                        if (name === 'link' && attribs.rel === 'alternate' && attribs.type === 'application/zip') {
                            //save links to files in zenodoLinks
                            zenodoLinks.push(attribs.href);
                        }
                    }
                }, { decodeEntities: true });
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
                debug('Parsing zenodo contents completed, found zip file %s', passon.zenodoLink);
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
function checkZenodoContentsViaAPI(passon) {
    return new Promise((fulfill, reject) => {
        debug('Checking files in Zenodo deposit');

        let requestURL = passon.baseURL + 'api/deposit/depositions/' + passon.zenodoID;

        if (!config.zenodo.token) {
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
 */
function zenodoLoad(passon) {
    return new Promise((fulfill, reject) => {
        debug('Loading files from Zenodo using link "%s"', passon.zenodoLink);
        var zipPath = path.join(config.fs.incoming, passon.id);
        var cmd = 'wget -q -O ' + zipPath + ' ' + passon.zenodoLink;
        passon.result = {};
        passon.result.zipName = passon.zenodoLink;

        debug('Downloading using command "%s"', cmd);
        exec(cmd, (error, stdout, stderr) => {
            if (error || stderr) {
                debug(error, stderr, stdout);
                let errors = error.message.split(':');
                let message = errorMessageHelper(errors[errors.length - 1]);
                error.msg = JSON.stringify({ error: 'download failed: ' + message });
                error.status = 500;
                reject(error);
            } else {
                passon.archive = zipPath;
                debug('Download of zenodo record %s complete, saved at "%s"', passon.id, passon.archive);
                fulfill(passon);
            }
        });
    });
}

function getContents(passon) {
    return new Promise((fulfill, reject) => {
        passon.client
            .getDirectoryContents(passon.webdav_path)
            .then(function (contents) {
                passon.contents = contents;
                debug('Sucessfully loaded file list of %s', passon.shareURL);
                fulfill(passon);
            })
            .catch(function (error) {
                debug(error);
                error.status = 404;
                error.msg = 'could not read webdav contents';
                reject(error);
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

        for (let i = 0; i < contents.length; i++) {
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
            let zipPath = path.join(config.fs.incoming, passon.id);
            let cmd = 'wget -q -O ' + zipPath + ' ' + downloadURL;

            debug('Downloading: "%s"', cmd);
            exec(cmd, (error, stdout, stderr) => {
                if (error || stderr) {
                    debug(error, stderr, stdout);
                    let errors = error.message.split(':');
                    let message = errorMessageHelper(errors[errors.length - 1]);
                    error.msg = JSON.stringify({ error: 'download failed: ' + message });
                    error.status = 500;
                    reject(error);
                } else {
                    debug('Download of public share %s complete!', passon.id);
                    passon.archive = zipPath;
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
                    fs.writeFile(path.join(config.fs.incoming, passon.id), zipData, function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            passon.archive = path.join(config.fs.incoming, passon.id);
                            debug('Sucessfully loaded zip file for compendium %s', passon.id);
                            fulfill(passon);
                        }
                    });
                })
                .catch(function (error) {
                    debug(error);
                    error.status = 404;
                    error.msg = 'could not download zip file';
                    reject(error);
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
            let error = new Error();
            error.msg = 'Single directory found. Use the "path" parameter to point to the compendium directory.';
            error.status = 404;
            reject(error);
        } else {
            fulfill(passon);
        }
    });
}

function loadWorkspace(passon) {
    //workspace not supported, implement here
    return new Promise((fulfill, reject) => {
        if (passon.result.directoryCount !== 1 && passon.result.bagitCount === 0 && passon.result.zipCount !== 1) {
            let error = new Error();
            error.msg = 'workspace creation not implemented';
            error.status = 403;
            reject(error);
        } else {
            fulfill(passon);
        }
    });
}

function unzipUpload(passon) {
    return new Promise((fulfill, reject) => {
        debug('[%s] Create unzip command from upload', passon.id);

        let outputPath = path.join(config.fs.compendium, passon.id);
        switch (passon.req.file.mimetype) {
            case 'application/zip':
            case 'application/x-zip':
            case 'application/x-zip-compressed':
            case 'multipart/x-zip':
                cmd = 'unzip -uq ' + passon.req.file.path + ' -d ' + outputPath;
                passon.archive = passon.req.file.path;
                break;
            default:
                let message = 'Got unsupported mimetype: " ' + passon.req.file.mimetype +
                    '" in uploaded file:\n' + JSON.stringify(passon.req.file);
                let error = new Error(message);
                error.msg = JSON.stringify({ error: 'extraction failed: ' + message });
                error.status = 500;
                debug(message);
                reject(error);
        }

        exec(cmd, (error, stdout, stderr) => {
            if (error || stderr) {
                debug(error, stderr, stdout);
                let errors = error.message.split(':');
                let message = errorMessageHelper(errors[errors.length - 1]);
                error.msg = JSON.stringify({ error: 'extraction failed: ' + message });
                error.status = 500;
                reject(error);
            } else {
                passon.compendium_path = outputPath;
                debug('[%s] Unzip finished! Files stored in %s', passon.id, passon.compendium_path);
                fulfill(passon);
            }
        });
    });
}

function unzipLoad(passon) {
    return new Promise((fulfill, reject) => {
        debug('[%s] Create unzip command from share', passon.id);

        let outputPath = path.join(config.fs.compendium, passon.id);
        let tempPath = passon.archive + '_tmp';
        let cmd = '';

        if (passon.result.zipName && passon.result.bagitCount === 0) { //standard zip file contains all files directly and will be extracted to outputPath 
            cmd = 'unzip -uq ' + passon.archive + ' -d ' + outputPath;
        } else { //owncloud zip files have an additional parent directory and will be extracted to a temporary directory first
            cmd = 'unzip -uq ' + passon.archive + ' -d ' + tempPath;
            cmd += ' && mkdir ' + outputPath + ' && mv ' + tempPath + '/*/* ' + outputPath;
        }

        exec(cmd, (error, stdout, stderr) => {
            if (error || stderr) {
                debug(error, stderr, stdout);
                let errors = error.message.split(':');
                let message = errorMessageHelper(errors[errors.length - 1]);
                error.msg = JSON.stringify({ error: 'extraction failed: ' + message });
                error.status = 500;
                reject(error);
            } else {
                passon.compendium_path = outputPath;
                debug('[%s] Unzip finished! Files stored in %s', passon.id, passon.compendium_path);
                fulfill(passon);
            }
        });
    });
}

function stripSingleBasedir(passon) {
    return new Promise((fulfill, reject) => {
        debug('[%s] Starting basedir stripping...', passon.id);

        fs.readdir(passon.compendium_path, (err, files) => {
            if (err) {
                let errors = err.message.split(':');
                let message = errorMessageHelper(errors[errors.length - 1]);
                error.msg = JSON.stringify({ error: 'extraction failed: ' + message });
                error.status = 500;
                reject(err);
                return;
            }

            if (files.length === 1 && fs.statSync(path.join(passon.compendium_path, files[0])).isDirectory()) {
                let stripDir = path.join(passon.compendium_path, files[0]);
                debug('[%s] Stripping single basedir "%s" in %s', passon.id, stripDir, passon.compendium_path);

                //fse.move(stripDir, passon.compendium_path);
                //fs.unlink(stripDir);

                let cmd = 'mv ' + stripDir + '/* ' + passon.compendium_path + ' && rm -r ' + stripDir;
                exec(cmd, (error, stdout, stderr) => {
                    if (error || stderr) {
                        debug(error, stderr, stdout);
                        let errors = error.message.split(':');
                        let message = errorMessageHelper(errors[errors.length - 1]);
                        error.msg = JSON.stringify({ error: 'stripping base dir failed: ' + message });
                        error.status = 500;
                        reject(error);
                    } else {
                        debug('[%s] Stripping finished: %s', passon.id, stdout);
                        fulfill(passon);
                    }
                });
            } else {
                debug('[%s] Found %s files in compendium directory and not a single directory, nothing to strip', passon.id, files.length);
                fulfill(passon);
            }
        });
    });
}

function detectBag(passon) {
    return new Promise((fulfill) => {
        debug('[%s] Detecting bag', passon.id);

        let detectionFile = path.join(passon.compendium_path, config.bagtainer.bagit.detectionFileName);

        try {
            fs.accessSync(detectionFile);

            debug('[%s] Found %s - it\'s a bag!', passon.id, detectionFile);
            passon.isBag = true;
        } catch (err) {
            debug('[%s] Could not find bag detection file, NOT a bag: %s', passon.id, err);
            passon.isBag = false;
        }

        fulfill(passon);
    });
}

function detectCompendium(passon) {
    return new Promise((fulfill, reject) => {
        debug('[%s] Detecting compendium', passon.id);


        let detectionFile = path.join(passon.compendium_path, config.bagtainer.detectionFileName);

        try {
            fs.accessSync(detectionFile);

            debug('[%s] Found %s - it\'s a compendium! Content is provided as %s', passon.id, detectionFile, passon.content);
            passon.isCompendium = true;
            fulfill(passon);
        } catch (error) {
            if (passon.content === 'compendium') {
                debug('[%s] Could not find compendium detection file but content is %s: %s', passon.id, passon.content, error);

                error.msg = JSON.stringify({ error: 'content_type is ' + passon.content + ' but no compendium provided.' });
                error.status = 400;
                reject(error);
            } else {
                debug('[%s] Could not find compendium detection file but content is "%s". All good.', passon.id, passon.content);
                fulfill(passon);
            }
        }
    });
}

function getTextFiles(passon) {
    return new Promise((fulfill, reject) => {
        debug('[%s] Getting text files', passon.id);
        //regular expression for text file types (.txt .r .rmd .text .json .yml .yaml ..)
        let textFileRegex = new RegExp(config.encoding.textFileRegex, 'i');
        passon.textFiles = [];

        //ignore text files
        function ignoreFunc(file, stats) {
            return !stats.isDirectory() && !textFileRegex.test(path.extname(file));
        }

        //recursively iterate through path and collect file names
        recursiveReaddir(passon.compendium_path, [ignoreFunc], function (err, files) {
            if (err) {
                debug('[%s] Error reading text files: %s', passon.id, err.message);
                reject(err);
            }
            debug('[%s] Found %s text files.', passon.id, files.length);
            passon.textFiles = files;
            fulfill(passon);
        });
    });
}

function checkEncoding(passon) {
    return new Promise((fulfill, reject) => {
        debug('[%s] Checking file encoding', passon.id);
        let invalidFiles = [];

        for (let i = 0; i < passon.textFiles.length; i++) {
            let element = passon.textFiles[i];
            const fileBuffer = fs.readFileSync(element);
            const charsetMatch = detectCharacterEncoding(fileBuffer);
            debug('File %s has encoding %s with confidence %s', element, charsetMatch.encoding, charsetMatch.confidence);

            // If encoding type is not supported
            if (config.encoding.supportedEncodings.indexOf(charsetMatch.encoding) === -1) {
                // rewrite file path:
                let splitPath = element.split('/compendium/');
                let shortFilePath = splitPath[splitPath.length - 1];
                invalidFiles.push({ file: shortFilePath, encoding: charsetMatch.encoding });
            }
        }

        if (invalidFiles.length !== 0) {
            debug('Unsupported encoding found in file(s) %s!', JSON.stringify(invalidFiles));
            let err = new Error('unsupported encoding');
            err.status = 422;
            err.msg = {};
            err.msg.message = 'Files with unsupported encoding detected. Only UTF-8 is supported.';
            err.msg.files = invalidFiles;
            reject(err);
        } else {
            debug('[%s] All text files passed encoding check.', passon.id);
            fulfill(passon);
        }

    });
}

function extractMetadata(passon) {
    return new Promise((fulfill, reject) => {
        debug('[%s] Extracting metadata', passon.id);

        // handle bag vs. workspace case
        let metaextract_input_dir = passon.compendium_path;
        if (passon.isBag) {
            metaextract_input_dir = path.join(metaextract_input_dir, config.bagtainer.payloadDirectory);
        }
        let metaextract_output_dir = path.join(metaextract_input_dir, config.meta.extract.outputDir);

        // create metadata extraction command
        let cmd = [
            config.meta.cliPath,
            '-debug',
            config.meta.extract.module,
            '--inputdir', metaextract_input_dir,
            '--outputdir', metaextract_output_dir,
            '--metafiles', // save all raw files
            '--ercid', passon.id, // pass the erc id
            '--basedir', config.fs.compendium // 
            //'--stayoffline' // disable calls to ORCID API
        ].join(' ');

        debug('[%s] Running metadata extraction with command "%s"', passon.id, cmd);
        exec(cmd, (error, stdout, stderr) => {
            if (error || stderr) {
                debug('[%s] Problem during metadata extraction:\n\t%s\n\t%s',
                    passon.id, error.message, stderr.message);
                debug(error, stderr, stdout);
                let errors = error.message.split(':');
                let message = errorMessageHelper(errors[errors.length - 1]);
                error.msg = JSON.stringify({ error: 'metadata extraction failed: ' + message });
                reject(error);
            } else {
                debug('[%s] Completed metadata extraction:\n\n%s\n', passon.id, stdout);

                // check if metadata was found, if so put the metadata directory into passon
                fs.readdir(metaextract_output_dir, (err, files) => {
                    if (err) {
                        debug('[%s] Error reading metadata directory %s [fail the upload? %s]:\n\t%s', passon.id,
                            metaextract_output_dir,
                            config.meta.extract.failOnNoMetadata, err);
                        if (config.meta.extract.failOnNoMetadata) {
                            reject(err);
                        } else {
                            debug('[%s] Continuing with empty metadata (A) ...', passon.id);
                            fulfill(passon);
                        }
                    } else if (files.length < 1) {
                        debug('[%s] Metadata extraction directory %s is empty [fail the upload? %s]:\n\t%s', passon.id,
                            metaextract_output_dir,
                            config.meta.extract.failOnNoMetadata, err);
                        if (config.meta.extract.failOnNoMetadata) {
                            reject(new Error('No files in the metadata directory'));
                        } else {
                            debug('[%s] Continuing with empty metadata (B) ...', passon.id);
                            fulfill(passon);
                        }
                    } else {
                        debug('[%s] Finished metadata extraction and created %s metadata files in %s: %s', passon.id,
                            files.length, metaextract_output_dir, JSON.stringify(files));
                        passon.metadata_dir = metaextract_output_dir;
                        passon.metadata_file = path.join(passon.metadata_dir, config.meta.extract.bestCandidateFile);
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
            debug('[%s] Loading metadata from %s', passon.id, passon.metadata_file);

            fs.readFile(passon.metadata_file, (err, data) => {
                if (err) {
                    debug('[%s] Error reading metadata file: %s [fail? %s]', passon.id, err.message,
                        config.meta.extract.failOnNoMetadata);
                    if (config.meta.extract.failOnNoMetadata) {
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
            if (config.meta.extract.failOnNoMetadata) {
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
        if (!config.meta.broker.enable) {
            debug('Brokering disabled via config');
            fulfill(passon);
            return;
        }

        debug('[%s] Brokering metadata', passon.id);

        if (passon.metadata) {
            if (passon.metadata.raw) {
                // 1. brokering: from raw to o2r (save to "main" element, i.e. metadata.o2r)
                passon.metadata[config.meta.extract.targetElement] = passon.metadata.raw;

                // 2. brokering: from raw to zenodo
                let current_mapping = 'zenodo';
                let mapping_file = path.join(config.meta.broker.mappings.dir, config.meta.broker.mappings[current_mapping].file);
                let cmd = [
                    config.meta.cliPath,
                    '-debug',
                    config.meta.broker.module,
                    '--inputfile', passon.metadata_file,
                    '--map', mapping_file,
                    '--outputdir', passon.metadata_dir
                ].join(' ');

                debug('[%s] Running metadata brokering with command "%s"', passon.id, cmd);
                exec(cmd, (error, stdout, stderr) => {
                    if (error || stderr) {
                        debug('[%s] Problem during metadata brokering:\n\t%s\n\t%s',
                            passon.id, error.message, stderr.message);
                        debug(error, stderr, stdout);
                        let errors = error.message.split(':');
                        let message = errorMessageHelper(errors[errors.length - 1]);
                        error.msg = JSON.stringify({ error: 'metadata brokering failed: ' + message });
                        reject(error);
                    } else {
                        debug('[%s] Completed metadata brokering:\n\n%s\n', passon.id, stdout);

                        // check if metadata was brokered
                        fs.readdir(passon.metadata_dir, (err, files) => {
                            if (err) {
                                debug('[%s] Error reading brokered metadata directory %s:\n\t%s', passon.id,
                                    passon.metadata_dir, err);
                                reject(err);
                            } else {
                                debug('[%s] Completed metadata brokering and now have %s metadata files: %s', passon.id,
                                    files.length, JSON.stringify(files));

                                // get filename from mapping definition
                                fs.readFile(mapping_file, (err, data) => {
                                    if (err) {
                                        debug('[%s] Error reading mapping file: %s', passon.id, err.message);
                                        reject(err);
                                    } else {
                                        let mapping = JSON.parse(data);
                                        let mapping_output_file = path.join(passon.metadata_dir, mapping.Settings.outputfile);
                                        debug('[%s] Loading brokering output from file %s', passon.id, mapping_output_file);

                                        // read mapped metadata to passon for saving to DB
                                        fs.readFile(mapping_output_file, (err, data) => {
                                            if (err) {
                                                debug('[%s] Error reading brokering output file: %s', passon.id, err.message);
                                                reject(err);
                                            } else {
                                                let mapping_output = JSON.parse(data);
                                                // read mapped metadata to passon for saving to DB
                                                objectPath.set(passon.metadata,
                                                    config.meta.broker.mappings[current_mapping].targetElement,
                                                    mapping_output);
                                                debug('[%s] Finished metadata brokering!', passon.id);
                                                fulfill(passon);
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            } else {
                debug('[%s] No _raw_ metadata provided that could be brokered!', passon.id);
            }
        } else {
            debug('[%s] No metadata provided that could be brokered!', passon.id);
        }
    });
}

function save(passon) {
    return new Promise((fulfill, reject) => {
        debug('[%s] Saving...', passon.id);
        var compendium = new Compendium({
            id: passon.id,
            user: passon.user,
            metadata: passon.metadata,
            candidate: true
        });

        compendium.save(error => {
            if (error) {
                debug('[%s] ERROR saving new compendium', passon.id);
                error.msg = JSON.stringify({ error: 'internal error' });
                error.status = 500;
                reject(error);
            } else {
                debug('[%s] Saved new compendium', passon.id);
                fulfill(passon);
            }
        });
    });
}

function cleanup(passon) {
    return new Promise((fulfill, reject) => {
        debug('[%s] Cleaning up after upload', passon.id);

        if (!config.fs.keepIncomingArchive) {
            if (passon.archive) {
                fs.unlink(passon.archive, err => {
                    if (err)
                        debug('[%s] Error deleting archive file: %s', err);
                    else
                        debug('[%s] Deleted archive file %s', passon.id, passon.archive);
                });
            }
        }

        fulfill(passon);
    });
}

module.exports = {
    unzipUpload: unzipUpload,
    unzipLoad: unzipLoad,
    stripSingleBasedir: stripSingleBasedir,
    detectBag: detectBag,
    detectCompendium: detectCompendium,
    getTextFiles: getTextFiles,
    checkEncoding: checkEncoding,
    extractMetadata: extractMetadata,
    loadMetadata: loadMetadata,
    brokerMetadata: brokerMetadata,
    save: save,
    cleanup: cleanup,
    publicShareLoad: publicShareLoad,
    zenodoLoad: zenodoLoad,
    checkZenodoContents: checkZenodoContents
};
