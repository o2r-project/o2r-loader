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

/* eslint-env mocha */
const assert = require('chai').assert;
const request = require('request');
const fs = require('fs');
const config = require('../config/config');

require("./setup");
const cookie_o2r = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';
const requestLoadingTimeout = 15000;
const createCompendiumPostRequest = require('./util').createCompendiumPostRequest;


describe('Direct upload of ERC', function () {
    describe('POST /api/v1/compendium response with executable ERC', () => {
        it('should respond with HTTP 200 OK', (done) => {
            let req = createCompendiumPostRequest('./test/erc/executable', cookie_o2r);

            request(req, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should respond with HTTP 200 OK when using upload type "compendium" explicitly', (done) => {
            let req = createCompendiumPostRequest('./test/erc/executable', cookie_o2r, 'compendium');

            request(req, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should respond with valid JSON', (done) => {
            let req = createCompendiumPostRequest('./test/erc/executable', cookie_o2r);

            request(req, (err, res, body) => {
                assert.ifError(err);
                assert.isObject(JSON.parse(body), 'returned JSON');
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should give a response including the id field', (done) => {
            let req = createCompendiumPostRequest('./test/erc/executable', cookie_o2r);

            request(req, (err, res, body) => {
                assert.ifError(err);
                assert.isDefined(JSON.parse(body).id, 'returned id');
                assert.property(JSON.parse(body), 'id');
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should contain the correct values for properties compendium and bag', (done) => {
            let req = createCompendiumPostRequest('./test/erc/executable', cookie_o2r);

            request(req, (err, res, body) => {
                assert.ifError(err);

                let j = request.jar();
                let ck = request.cookie('connect.sid=' + cookie_o2r);
                j.setCookie(ck, global.test_host);
                let get = {
                    method: 'GET',
                    jar: j,
                    uri: global.test_host_read + '/api/v1/compendium/' + JSON.parse(body).id
                };

                request(get, (err, res, body) => {
                    assert.ifError(err);
                    let response = JSON.parse(body);
                    assert.property(response, 'bag');
                    assert.propertyVal(response, 'bag', true);
                    assert.property(response, 'compendium');
                    assert.propertyVal(response, 'compendium', true);
                    done();
                });
            });
        }).timeout(requestLoadingTimeout);

        it('should contain brokered metadata for o2r metadata section (if asking as the uploading user)', (done) => {
            let req = createCompendiumPostRequest('./test/erc/executable', cookie_o2r);

            request(req, (err, res, body) => {
                assert.ifError(err);

                let j = request.jar();
                let ck = request.cookie('connect.sid=' + cookie_o2r);
                j.setCookie(ck, global.test_host);
                let get = {
                    method: 'GET',
                    jar: j,
                    uri: global.test_host_read + '/api/v1/compendium/' + JSON.parse(body).id
                };

                request(get, (err, res, body) => {
                    assert.ifError(err);
                    let response = JSON.parse(body);
                    assert.property(response, 'metadata');
                    assert.property(response.metadata, 'o2r');
                    assert.property(response.metadata.o2r, 'ercIdentifier');
                    //assert.propertyVal(response.metadata.o2r, 'ercIdentifier', 'KIbebWnPlx');
                    //assert.propertyVal(response.metadata.o2r, 'title', 'This is the title: it contains a colon');
                    done();
                });
            });
        }).timeout(requestLoadingTimeout);
    });

    describe('POST /api/v1/compendium with invalid bag', () => {
        it('should fail the upload because bag is invalid', (done) => {
            let req = createCompendiumPostRequest('./test/erc/invalid_bag', cookie_o2r);

            request(req, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 400);
                assert.include(body, 'bag ist invalid');
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should not tell about internal server configuration in the error message', (done) => {
            let req = createCompendiumPostRequest('./test/erc/invalid_bag', cookie_o2r);

            request(req, (err, res, body) => {
                assert.ifError(err);
                assert.notInclude(body, config.fs.base);
                done();
            });
        }).timeout(requestLoadingTimeout);
    });

    describe('POST /api/v1/compendium with invalid id in bag', () => {
        it('should fail the upload because bag ID is invalid (contains invalid chars)', (done) => {
            let req = createCompendiumPostRequest('./test/erc/invalid_id', cookie_o2r);

            request(req, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 400);
                assert.include(body, 'Invalid id found in compendium detection file');
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should not tell about internal server configuration in the error message', (done) => {
            let req = createCompendiumPostRequest('./test/erc/invalid_id', cookie_o2r);

            request(req, (err, res, body) => {
                assert.ifError(err);
                assert.notInclude(body, config.fs.base);
                done();
            });
        }).timeout(requestLoadingTimeout);
    });

    describe('POST /api/v1/compendium with two compendia with the same ID', () => {
        it('should respond with HTTP 200 OK for the first compendium', (done) => {
            let req = createCompendiumPostRequest('./test/erc/executable', cookie_o2r);

            request(req, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                done();
            });
        }).timeout(requestLoadingTimeout);

        it('should fail the second upload because bag ID is already used', (done) => {
            let req = createCompendiumPostRequest('./test/erc/invalid_id', cookie_o2r);

            request(req, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 400);
                assert.include(body, 'ID already exists');
                done();
            });
        }).timeout(requestLoadingTimeout);
    });

    describe.skip('POST /api/v1/compendium with virus', () => {
        it('upload compendium should fail and return an error message about infected files', (done) => {
            let req = createCompendiumPostRequest('./test/erc/virustainer', cookie);
            request(req, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 422);
                assert.include(body, 'infected file(s)');
                done();
            });
        });
    });

});
