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

var c = require('../config/config');
const debug = require('debug')('loader');
const Docker = require('dockerode');
const steps = require('../lib/loader-steps');
const randomstring = require('randomstring');

/**
 * Create Loader to handle given request and response
 * @constructor
 * @param {object} request - The load request
 * @param {object} response - The response; returns the id of the compendium if successful or an error otherwise
 */
function Loader(req, res) {
    this.req = req;
    this.res = res;

    this.load = (done) => {
        debug('Handling public share load of %s for user %s', this.req.body.share_url, this.req.user.orcid);

        let passon = {
            id: randomstring.generate(c.id_length),
            shareURL: encodeURI(this.req.body.share_url),
            webdav_path: this.req.body.path,
            user: this.req.user.orcid,
            req: this.req,
            res: this.res,
            docker: new Docker() // setup Docker client with default options
        };

        debug('[%s] Docker client set up: %s', passon.id, JSON.stringify(passon.docker));
        
        return steps.publicShareLoad(passon)
            .then(steps.unzip)
            .then(steps.extractMetadata)
            .then(steps.loadMetadata)
            .then(steps.brokerMetadata)
            .then(steps.save)
            .then(steps.cleanup)
            .then(this.respond)
            .then((passon) => {
                debug('[%s] completed load', passon.id);
                done(passon.id, null);
            })
            .catch(err => {
                debug('Rejection or unhandled failure during execute: \n\t%s',
                JSON.stringify(err));
                let status = 500;
                if (err.status) {
                    status = err.status;
                }
                let msg = 'Internal error';
                if (err.message) {
                    msg = err.message;
                }
                done(null, err);
                res.status(status).send(JSON.stringify({ error: msg }));
            });
    };

    this.loadZenodo = (done) => {
        debug('Handling zenodo load of %s for user %s', this.req.body.zenodoURL, this.req.user.orcid);

        let passon = {
            id: randomstring.generate(c.id_length),
            zenodoURL: encodeURI(this.req.body.share_url),
            zenodoID: this.req.body.zenodo_id,
            baseURL: this.req.body.base_url,
            filename: this.req.body.filename,
            user: this.req.user.orcid,
            req: this.req,
            res: this.res,
            docker: new Docker() // setup Docker client with default options
        };

        debug('[%s] Docker client set up: %s', passon.id, JSON.stringify(passon.docker));
        
        return steps.checkZenodoContents(passon)
            .then(steps.zenodoLoad)
            .then(steps.unzip)
            .then(steps.extractMetadata)
            .then(steps.loadMetadata)
            .then(steps.brokerMetadata)
            .then(steps.save)
            .then(steps.cleanup)
            .then(this.respond)
            .then((passon) => {
                debug('[%s] completed zenodo load', passon.id);
                done(passon.id, null);
            })
            .catch(err => {
                debug('Rejection or unhandled failure during execute: \n\t%s',
                JSON.stringify(err));
                let status = 500;
                if (err.status) {
                    status = err.status;
                }
                let msg = 'Internal error';
                if (err.message) {
                    msg = err.message;
                }
                done(null, err);
                res.status(status).send(JSON.stringify({ error: msg }));
            });
    };

    this.respond = (passon) => {
        return new Promise((fulfill) => {
            passon.res.status(200).send({ id: passon.id });
            debug('New compendium %s', passon.id);
            fulfill(passon);
        });
    };
}

module.exports.Loader = Loader;
