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


describe('Metadata brokering during upload of ERC ', function () {
    describe('POST /api/v1/compendium response with ERC containing metadata', () => {
        let compendium_id = '';
        before(function (done) {
            let req = createCompendiumPostRequest('./test/erc/with_metadata', cookie_o2r);
            this.timeout(10000);

            request(req, (err, res, body) => {
                assert.ifError(err);
                compendium_id = JSON.parse(body).id;
                done();
            });
        });

        it('should contain brokered metadata to o2r', (done) => {
            request(global.test_host_read + '/api/v1/compendium/' + compendium_id, (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.property(response, 'metadata');
                assert.property(response.metadata, 'o2r');
                assert.property(response.metadata.o2r, 'ercIdentifier');
                assert.property(response.metadata.o2r, 'paperSource');
                assert.propertyVal(response.metadata.o2r, 'title', 'This is the title: it contains a colon');
                done();
            });
        });

        it('should contain brokered metadata to zenodo in correct structure', (done) => {
            request(global.test_host_read + '/api/v1/compendium/' + compendium_id, (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.property(response, 'metadata');
                assert.property(response.metadata, 'zenodo');
                assert.property(response.metadata.zenodo, 'metadata');
                assert.property(response.metadata.zenodo.metadata, 'upload_type');
                assert.property(response.metadata.zenodo.metadata, 'title');
                assert.property(response.metadata.zenodo.metadata, 'description');
                done();
            });
        });

        it('should contain brokered metadata to zenodo with correct values', (done) => {
            request(global.test_host_read + '/api/v1/compendium/' + compendium_id, (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.propertyVal(response.metadata.zenodo.metadata, 'upload_type', 'publication');
                assert.propertyVal(response.metadata.zenodo.metadata, 'title', 'This is the title: it contains a colon');
                done();
            });
        });
    });
});
