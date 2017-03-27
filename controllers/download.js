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

// General modules
var c = require('../config/config');
var debug = require('debug')('loader');
var fs = require('fs');

var Compendium = require('../lib/model/compendium');
var Loader = require('../lib/loader').Loader;

var url = require('url');
var validator = require('validator');


exports.create = (req, res) => {
  req.params = {};
  // check user level
  if (!req.isAuthenticated()) {
    res.status(401).send('{"error":"user is not authenticated"}');
    return;
  }
  if (req.user.level < c.user.level.create_compendium) {
    res.status(401).send('{"error":"user level does not allow compendium creation"}');
    return;
  }

  // validate content_type
  if (req.body.content_type !== 'compendium_v1') {
    res.status(500).send('Provided content_type not yet implemented, only "compendium_v1" is supported.');
    debug('Provided content_type "%s" not implemented', req.body.content_type);
    return;
  }

  // validate share_url
  if(!validator.isURL(req.body.share_url)) {
    let tempZenodoID = getZenodoID(req.share_url);

    if (!tempZenodoID) { //throw an error if zenodo ID could not be extracted
      debug('Invalid share_url:', req.body.share_url);
      res.status(404).send('{"error":"public share URL is invalid"}');
      return;
    } else { // otherwise start zenodo loader with zenodoID
      req.params.zenodo_id = tempZenodoID;
      req.params.zenodoHost = 
      prepareZenodoLoad(req, res);
      return;
    }
  }

  // get top-level hostname from share_url
  let parsedURL = url.parse(req.body.share_url);
  let hostname = parsedURL.hostname.split('.');
  hostname = hostname[hostname.length - 2];
  req.hostname = hostname;

  //depending on the host, start zenodo loader or sciebo/owncloud loader
  switch(hostname) {
    case 'sciebo':
      prepareScieboLoad(req, res);
      break;
    case 'zenodo':
      // get zenodo record ID from Zenodo URL, e.g. https://sandbox.zenodo.org/record/59917
      let zenodoPaths = parsedURL.path.split('/');
      let zenodoID = zenodoPaths[zenodoPaths.length - 1];
      req.params.zenodoHost = parsedURL.host;
      req.params.zenodo_id = zenodoID;
      prepareZenodoLoad(req, res);
      break;
    case 'doi':
      // get zenodoID from DOI URL, e.g. https://doi.org/10.5281/zenodo.268443
      req.params.zenodo_id = parsedURL.path.split('zenodo.')[1];
      prepareZenodoLoad(req, res);
      break;
    default:
      debug('Public share host "%s" is not allowed.', hostname);
      res.status(403).send('{"error":"host is not allowed"}');
      debug('public share host is not allowed, supported is: %s', c.webdav.allowedHosts.toString());
      return;
  } 
};

function prepareScieboLoad(req, res) {
  this.req = req;
  this.res = res;

  if (!req.body.path) { // set default value for path ('/')
    req.body.path = '/';
  }

  // only allow sciebo shares, see https://www.sciebo.de/de/login/index.html
  let validURL = url.parse(req.body.share_url);
  let hostname = validURL.hostname.split('.');
  hostname = hostname[hostname.length - 2];

  if (c.webdav.allowedHosts.indexOf(hostname) === -1) { //if hostname is not in allowedHosts
    debug('Public share host "%s" is not allowed.', hostname);
    res.status(403).send('{"error":"public share host is not allowed"}');
    debug('public share host is not allowed, supported is: %s', c.webdav.allowedHosts.toString());
    return;
  }

  var loader = new Loader(req, res);
  loader.loadOwncloud((id, err) => {
    if (err) {
      debug('Error during public share load: %s', err.message);
    } else {
      debug('New compendium %s successfully loaded', id);
    }
  });
}

function prepareZenodoLoad(req, res) {
  this.req = req;
  this.res = res;

  //validate host (must be zenodo or sandbox.zenodo)
  switch (req.params.zenodoHost) {
    case 'sandbox.zenodo.org':
      req.params.base_url = c.zenodo.sandbox_url;
      break;
    case 'zenodo.org':
      req.params.base_url = c.zenodo.url;
      break;
    default:
      debug('Invalid hostname:', req.params.zenodoHost);
      res.status(403).send('{"error":"host is not allowed"}');
      return;
  }

  // validate zenodoID
  if (!validator.isNumeric(String(req.params.zenodo_id))){
    debug('Invalid zenodoID:', req.params.zenodo_id);
    res.status(404).send('{"error":"zenodo ID is not a number"}');
    return;
  }

  var loader = new Loader(req, res);
  loader.loadZenodo((id, err) => {
    if (err) {
      debug('Error during zenodo load: %s', err.message);
    } else {
      debug('New compendium %s successfully loaded', id);
    }
  });
}

function getZenodoID(str) {
  if (!isNaN(str)) {
    return str;
  }

  //regex for a DOI (e.g. "10.5281/zenodo.268443")
  let doiRegex = new RegExp(/^\d+\.\d+\/zenodo\.\d+$/);
  if (doiRegex.test(str)) { //return the zenodoID from the DOI
    return str.split('zenodo.')[1];
  } else {
    return false;
  }
}