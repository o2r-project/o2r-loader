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
  // check user level
  if (!req.isAuthenticated()) {
    res.status(401).send('{"error":"user is not authenticated"}');
    return;
  }
  if (req.user.level < c.user.level.create_compendium) {
    res.status(401).send('{"error":"user level does not allow compendium creation"}');
    return;
  }

  // check for ZENODO url -> start zenodo loader
  if(req.body.zenodo_url !== null){
    //start zenodo loader

    // validate zenodo_url
    if(!validator.isURL(req.body.zenodo_url)) {
      debug('Invalid zenodo_url:', req.body.zenodo_url);
      res.status(404).send('{"error":"zenodo URL is invalid"}');
      return;
    }

    if (!req.body.filename) { // validate filename parameter exists
      debug('Filename missing');
      res.status(404).send('{"error":"filename is missing"}');
      return;
    }

    // get zenodo record ID from Zenodo URL
    // e.g. https://sandbox.zenodo.org/record/59917
    // todo: accept DOI, zenodo record id as well -> parser
    let parsedURL = url.parse(req.body.zenodo_url);
    let zenodoPaths = parsedURL.path.split('/');
    let zenodoID = zenodoPaths[zenodoPaths.length - 1];
    req.body.zenodo_id = zenodoID;

    //validate host (must be zenodo or sandbox.zenodo)
    switch (parsedURL.host) {
      case 'sandbox.zenodo.org':
        req.body.base_url = c.zenodo.sandbox_url;
        break;
      case 'zenodo.org':
        req.body.base_url = c.zenodo.url;
        break;
      default:
        debug('Invalid hostname:', parsedURL.host);
        res.status(403).send('{"error":"host is not allowed"}');
        return;
    }

    // validate zenodoID
    if (!validator.isNumeric(String(zenodoID))){
      debug('Invalid zenodoID:', zenodoID);
      res.status(404).send('{"error":"zenodo ID is not a number"}');
      return;
    }

    // validate content_type
    if (req.body.content_type === 'compendium_v1') {
      debug('Creating new %s for user %s)',
        req.body.content_type, req.user.id);

      var loader = new Loader(req, res);
      loader.loadZenodo((id, err) => {
        if (err) {
          debug('Error during public share load: %s', err.message);
        } else {
          debug('New compendium %s successfully loaded', id);
        }
      });
    } else {
      res.status(500).send('Provided content_type not yet implemented, only "compendium_v1" is supported.');
      debug('Provided content_type "%s" not implemented', req.body.content_type);
    } 
    return;
  }

  // validate share_url
  if(!validator.isURL(req.body.share_url)) {
    debug('Invalid share_url:', req.body.share_url);
    res.status(404).send('{"error":"public share URL is invalid"}');
    return;
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

  if (!req.body.path) { // set default value for path ('/')
    req.body.path = '/';
  }

  // validate content_type
  if (req.body.content_type === 'compendium_v1') {
    debug('Creating new %s for user %s)',
      req.body.content_type, req.user.id);

    var loader = new Loader(req, res);
    loader.load((id, err) => {
      if (err) {
        debug('Error during public share load: %s', err.message);
      } else {
        debug('New compendium %s successfully loaded', id);
      }
    });
  } else {
    res.status(500).send('Provided content_type not yet implemented, only "compendium_v1" is supported.');
    debug('Provided content_type "%s" not implemented', req.body.content_type);
  } 
};