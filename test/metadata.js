/*
 * (C) Copyright 2017 o2r project
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

/* eslint-env mocha */
const assert = require('chai').assert;
const request = require('request');
const fs = require('fs');
const config = require('../config/config');

require("./setup")
const cookie_o2r = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';
const createCompendiumPostRequest = require('./util').createCompendiumPostRequest;
const requestLoadingTimeout = 5000;


describe('Metadata brokering during upload of ERC ', function () {
    describe('POST /api/v1/compendium response with ERC containing metadata', () => {
        let j = request.jar();
        let ck = request.cookie('connect.sid=' + cookie_o2r);
        j.setCookie(ck, global.test_host);
        let get = {
            method: 'GET',
            jar: j,
            uri: null
        };

        before(function (done) {
            let req = createCompendiumPostRequest('./test/erc/with_metadata', cookie_o2r);
            this.timeout(20000);
            req.timeout = 20000;

            request(req, (err, res, body) => {
                assert.ifError(err);
                let compendium_id = JSON.parse(body).id;
                get.uri = global.test_host_read + '/api/v1/compendium/' + compendium_id;
                done();
            });
        });

        it('should contain brokered metadata to Zenodo in correct structure', (done) => {
            request(get, (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.property(response, 'metadata');
                assert.property(response.metadata, 'zenodo');
                assert.property(response.metadata.zenodo, 'metadata');
                assert.property(response.metadata.zenodo.metadata, 'upload_type');
                assert.property(response.metadata.zenodo.metadata, 'title');
                assert.property(response.metadata.zenodo.metadata, 'description');
                assert.property(response.metadata.zenodo.metadata, 'access_right');
                assert.property(response.metadata.zenodo.metadata, 'license');
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should contain brokered metadata to Zenodo with correct values', (done) => {
            request(get, (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.propertyVal(response.metadata.zenodo.metadata, 'upload_type', 'publication');
                assert.propertyVal(response.metadata.zenodo.metadata, 'title', 'This is the title: it contains a colon');
                done();
            });
        }).timeout(requestLoadingTimeout);
    });
});
