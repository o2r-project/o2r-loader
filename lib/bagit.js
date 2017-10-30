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
const debug = require('debug')('loader:bagit');
const Bag = require('bagit');
const config = require('../config/config');
const cleanMessage = require('../lib/error-message');

/*
 *  Load the associated bag, check if it's valid.
 * 
 *  The provided object must have the fields id and path. If the latter is missing or if "passon.isBag = false", then no validation is attempted.
 */
function validateBag(passon) {
    return new Promise((fulfill, reject) => {
        if(!passon.isBag) {
            debug('[%s] NOT validating bag, was NOT marked as a bag', passon.id);
            passon.bagValid = null;
            fulfill(passon);
            return;
        }
        if(!passon.compendium_path) {
            debug('[%s] NOT validating bag, compendium path is not provided.', passon.id);
            passon.bagValid = null;
            fulfill(passon);
            return;
        }

        debug('[%s] Validate bag', passon.id);

        let bag = new Bag(passon.compendium_path);
        bag
            .validate(config.bagit.validation.fast)
            .then((res) => {
                debug('[%s] bag is valid: %s', passon.id, JSON.stringify(res));
                passon.bagValid = true;
                fulfill(passon);
            }).catch((err) => {
                debug('[%s] bag is _IN_valid [fail? %s]: %s', passon.id, config.bagit.validation.failUpload, err);
                
                let msg = cleanMessage(err.message);
                passon.bagValid = false;
                passon.bagError = msg;
                if (config.bagit.validation.failUpload) {
                    err.status = 400;
                    err.msg = 'bag ist invalid: ' + msg;
                    reject(err);
                } else {
                    fulfill(passon);
                }
            });
    });
}

module.exports.validateBag = validateBag;