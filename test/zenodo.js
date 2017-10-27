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
const config = require('../config/config');

require("./setup")
const cookie = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';
const requestLoadingTimeout = 20000;


describe('Zenodo loader', function () {

    var compendium_id = '';

    describe('create new compendium based on a zenodo record', () => {
        it('zenodo record: should respond with a compendium ID', (done) => {
            let form = {
                share_url: 'https://sandbox.zenodo.org/record/69114',
                content_type: 'compendium'
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isObject(JSON.parse(body), 'returned JSON');
                assert.isDefined(JSON.parse(body).id, 'returned id');
                compendium_id = JSON.parse(body).id;
                done();
            });
        }).timeout(30000);

        it('zenodo record, additional "filename" parameter: should respond with a compendium ID', (done) => {
            let form = {
                share_url: 'https://sandbox.zenodo.org/record/69114',
                filename: 'metatainer.zip',
                content_type: 'compendium'
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isObject(JSON.parse(body), 'returned JSON');
                assert.isDefined(JSON.parse(body).id, 'returned id');
                compendium_id = JSON.parse(body).id;
                done();
            });
        }).timeout(20000);

        it('zenodo record, "doi" parameter: should respond with a compendium ID', (done) => {
            let form = {
                doi: '10.5072/zenodo.69114', // intenally taken apart and using sandbox
                content_type: 'compendium'
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isObject(JSON.parse(body), 'returned JSON');
                assert.isDefined(JSON.parse(body).id, 'returned id');
                compendium_id = JSON.parse(body).id;
                done();
            });
        }).timeout(20000);

        it('zenodo record, "doi.org" as "share_url": should respond with a compendium ID', (done) => {
            let form = {
                share_url: 'http://doi.org/10.5072/zenodo.69114', // page not found, internally using only id in sandbox.zenodo.org
                filename: 'metatainer.zip',
                content_type: 'compendium'
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isObject(JSON.parse(body), 'returned JSON');
                assert.isDefined(JSON.parse(body).id, 'returned id');
                compendium_id = JSON.parse(body).id;
                done();
            });
        }).timeout(20000);

        it('zenodo record, "zenodo_record_id" parameter: should respond with a compendium ID', (done) => {
            let form = {
                zenodo_record_id: '69114',
                content_type: 'compendium'
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isObject(JSON.parse(body), 'returned JSON');
                assert.isDefined(JSON.parse(body).id, 'returned id');
                compendium_id = JSON.parse(body).id;
                done();
            });
        }).timeout(20000);
    });

    describe('No new compendium based on invalid parameters', () => {
        it('invalid zenodo URL: should respond with an error 422', (done) => {
            let form = {
                share_url: 'htts?///sandbox.zenodo.org/record/69114',
                filename: 'metatainer.zip',
                content_type: 'compendium',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 422);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'public share URL is invalid');
                done();
            });
        }).timeout(10000);

        it('host not allowed (not a zenodo record): should respond with an error 403', (done) => {
            let form = {
                share_url: 'https://sandbox.ODONEZ.org/record/69114',
                filename: 'metatainer.zip',
                content_type: 'compendium',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 403);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'host is not allowed');
                done();
            });
        }).timeout(10000);

        it('invalid DOI: should respond with an error 422', (done) => {
            let form = {
                doi: 'invalid.doi/09983123',
                content_type: 'compendium',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 422);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'DOI is invalid');
                done();
            });
        }).timeout(10000);

        it('invalid zenodo_record_id (not a zenodo record): should respond with an error 422', (done) => {
            let form = {
                zenodo_record_id: 'eigthhundredseventytwo',
                content_type: 'compendium',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 422);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'zenodo_record_id is invalid');
                done();
            });
        }).timeout(10000);

        it('invalid zenodoID in share_url: should respond with an error 422', (done) => {
            let form = {
                share_url: 'https://sandbox.zenodo.org/record/asdfasdf',
                content_type: 'compendium',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 422);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'zenodo ID is not a number');
                done();
            });
        }).timeout(10000);

        it('filename not found: should respond with an error 500', (done) => {
            let form = {
                share_url: 'https://sandbox.zenodo.org/record/69114',
                filename: 'not_existing_file.xyz',
                content_type: 'compendium',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 500);
                done();
            });
        }).timeout(10000);

        it('filename not found: should respond with a useful but not talkative error message', (done) => {
            let form = {
                share_url: 'https://sandbox.zenodo.org/record/69114',
                filename: 'not_existing_file.xyz',
                content_type: 'compendium',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                let response = JSON.parse(body);
                assert.isUndefined(response.id, 'returned no id');
                console.log(response);
                assert.include(response.error, 'download failed:');
                assert.include(response.error, 'sandbox.zenodo.org/record/69114/files/not_existing_file.xyz');
                assert.notInclude(JSON.stringify(response.error), config.fs.base);
                done();
            });
        }).timeout(10000);
    });
});

