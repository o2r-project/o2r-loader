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

require("./setup")
const cookie_o2r = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';
const requestLoadingTimeout = 30000;
const createCompendiumPostRequest = require('./util').createCompendiumPostRequest;


describe('Direct upload of minimal workspace (script) without basedir', function () {
    describe('POST /api/v1/compendium to create a new compendium', () => {
        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-script', cookie_o2r);

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 200);
                    assert.isObject(JSON.parse(body), 'returned JSON');
                    done();
                });
            });
        }).timeout(10000);

        it('should give a response including the id field', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-script', cookie_o2r);

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    let response = JSON.parse(body);
                    assert.isDefined(response.id, 'returned id');
                    assert.property(response, 'id');
                    done();
                });
            });
        }).timeout(10000);

        it('should give give 401 with valid JSON and error message for unauthenticated user', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-script', cookie_o2r);
                this.timeout(10000);

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    let compendium_id = JSON.parse(body).id;

                    request(global.test_host_read + '/api/v1/compendium/' + compendium_id, (err, res, body) => {
                        assert.ifError(err);
                        assert.equal(res.statusCode, 401);
                        let response = JSON.parse(body);
                        assert.property(response, 'error');
                        done();
                    });
                });
            });
        }).timeout(10000);

        it('should give compendium metadata with a candidate field set to true for the uploading user', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-script', cookie_o2r);
                this.timeout(10000);

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    let compendium_id = JSON.parse(body).id;

                    let j = request.jar();
                    let ck = request.cookie('connect.sid=' + cookie_o2r);
                    j.setCookie(ck, global.test_host);
                    let get = {
                        uri: global.test_host_read + '/api/v1/compendium/' + compendium_id,
                        method: 'GET',
                        jar: j,
                        timeout: 10000
                    };

                    request(get, (err, res, body) => {
                        assert.ifError(err);
                        let response = JSON.parse(body);
                        assert.isDefined(response.candidate, 'returned candidate field');
                        assert.propertyVal(response, 'candidate', true);
                        done();
                    });
                });
            });
        }).timeout(10000);
    });
});


describe('Direct upload of minimal workspace (script) _with_ basedir', function () {
    describe('POST /api/v1/compendium to create a new compendium', () => {
        it('should respond with HTTP 200 OK and valid JSON', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-script-basedir', cookie_o2r, 'workspace');

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 200);
                    assert.isObject(JSON.parse(body), 'returned JSON');
                    done();
                });
            });
        }).timeout(10000);

        it('should give a response including the id field', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-script-basedir', cookie_o2r, 'workspace');

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    let response = JSON.parse(body);
                    assert.isDefined(response.id, 'returned id');
                    assert.property(response, 'id');
                    done();
                });
            });
        }).timeout(10000);

        it('should give compendium metadata with a candidate field set to true for the uploading user', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-script-basedir', cookie_o2r, 'workspace');
                this.timeout(10000);

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    let compendium_id = JSON.parse(body).id;

                    let j = request.jar();
                    let ck = request.cookie('connect.sid=' + cookie_o2r);
                    j.setCookie(ck, global.test_host);
                    let get = {
                        uri: global.test_host_read + '/api/v1/compendium/' + compendium_id,
                        method: 'GET',
                        jar: j,
                        timeout: 10000
                    };

                    request(get, (err, res, body) => {
                        assert.ifError(err);
                        let response = JSON.parse(body);
                        assert.isDefined(response.candidate, 'returned candidate field');
                        assert.propertyVal(response, 'candidate', true);
                        done();
                    });
                });
            });
        }).timeout(10000);

        it('should not contain the stripped dir in the files metadata but still hav subdir', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-script-basedir', cookie_o2r, 'workspace');
                this.timeout(10000);

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    let compendium_id = JSON.parse(body).id;

                    let j = request.jar();
                    let ck = request.cookie('connect.sid=' + cookie_o2r);
                    j.setCookie(ck, global.test_host);
                    let get = {
                        uri: global.test_host_read + '/api/v1/compendium/' + compendium_id,
                        method: 'GET',
                        jar: j,
                        timeout: 10000
                    };

                    request(get, (err, res, body) => {
                        assert.ifError(err);
                        assert.notInclude(body, 'shouldberemoved');
                        assert.include(JSON.stringify(body), 'data/datadirshouldstillbethere/text.csv');
                        done();
                    });
                });
            });
        }).timeout(10000);
    });
});

describe('Direct upload of minimal workspace (rmd)', function () {
    describe('POST /api/v1/compendium to create a new compendium', () => {
        let compendium_id = '';

        let j = request.jar();
        let ck = request.cookie('connect.sid=' + cookie_o2r);
        j.setCookie(ck, global.test_host);
        let get = {
            method: 'GET',
            jar: j,
            timeout: 10000
        };

        it('should respond with HTTP 200 OK and valid JSON, including the ID field', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-rmd', cookie_o2r, 'workspace');

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 200);
                    let response = JSON.parse(body);
                    assert.isObject(response, 'returned JSON');
                    assert.property(response, 'id');

                    compendium_id = response.id;
                    get.uri = global.test_host_read + '/api/v1/compendium/' + compendium_id;

                    done();
                });
            });
        }).timeout(10000);

        it('should have the extracted metadata from the header in the compendium metadata (if accesses as the uploading user)', (done) => {
            request(get, (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);

                assert.propertyVal(response, 'candidate', true);
                assert.propertyVal(response.metadata.o2r, 'title', 'Capacity of container ships in seaborne trade from 1980 to 2016 (in million dwt)*');
                assert.propertyVal(response.metadata.o2r, 'description', 'Capacity of container ships in seaborne trade of the world container ship fleet.\n');
                assert.equal(response.metadata.o2r.author.length, 1);
                assert.propertyVal(response.metadata.o2r.author[0], 'orcid', '0000-0001-9575-6780');

                done();
            });
        });

        it.skip('should have detected the correct main and display file', (done) => {
            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie_o2r);
            j.setCookie(ck, global.test_host);
            let get = {
                uri: global.test_host_read + '/api/v1/compendium/' + compendium_id,
                method: 'GET',
                jar: j,
                timeout: 10000
            };

            request(get, (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.isDefined(response.candidate, 'returned candidate field');
                assert.propertyVal(response, 'candidate', true);

                assert.propertyVal(response.metadata.o2r, 'mainfile', 'main.Rmd');
                assert.propertyVal(response.metadata.o2r, 'viewfile', 'display.html');

                done();
            });
        });

        it('should respond with HTTP 400 with valid JSON and error message when using no content_type', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-rmd', cookie_o2r);
                delete req.formData.content_type;
                console.log(req);

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 400);
                    let response = JSON.parse(body);
                    assert.isObject(response, 'returned JSON');
                    assert.property(response, 'error');
                    done();
                });
            });
        }).timeout(10000);

        it('should respond with HTTP 400 with valid JSON and error message when using empty string as content type', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-rmd', cookie_o2r, '');
                delete req.formData.content_type;
                console.log(req);

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 400);
                    let response = JSON.parse(body);
                    assert.isObject(response, 'returned JSON');
                    assert.property(response, 'error');
                    done();
                });
            });
        }).timeout(10000);

        it('should respond with HTTP 400 with valid JSON and error message (including the used string) when using some random string as content type', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let teststring = 'testnonexist';
                let req = createCompendiumPostRequest('./test/workspace/minimal-rmd', cookie_o2r, teststring);
                delete req.formData.content_type;
                console.log(req);

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 400);
                    let response = JSON.parse(body);
                    assert.isObject(response, 'returned JSON');
                    assert.property(response, 'error');
                    assert.include(JSON.stringify(response), teststring);
                    done();
                });
            });
        }).timeout(10000);

        it('should respond with HTTP 400 with valid JSON and error message when using content_type "compendium"', (done) => {
            request(global.test_host + '/api/v1/compendium', (err, res, body) => {
                let req = createCompendiumPostRequest('./test/workspace/minimal-rmd', cookie_o2r);

                request(req, (err, res, body) => {
                    assert.ifError(err);
                    assert.equal(res.statusCode, 400);
                    let response = JSON.parse(body);
                    assert.isObject(response, 'returned JSON');
                    assert.property(response, 'error');
                    done();
                });
            });
        }).timeout(10000);
    });
});