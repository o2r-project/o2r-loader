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
const cookie_plain = 's:yleQfdYnkh-sbj9Ez--_TWHVhXeXNEgq.qRmINNdkRuJ+iHGg5woRa9ydziuJ+DzFG9GnAZRvaaM';
const requestLoadingTimeout = 20000;


describe('Sciebo loader', function () {

    var compendium_id = '';

    describe('create new compendium based on public WebDAV', () => {
        it('public share with bagit.txt: should respond with a compendium ID', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/c7hsPIHGvgWnD6U',
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

        it('public share with zip file: should respond with a compendium ID', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/9R3P3xDe9K4ClmG',
                path: '/',
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

        it('public share with single directory: should throw an error and notify that the directory contains no files', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/pnKnjIjas9bZgbB',
                path: '/',
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
                assert.equal(res.statusCode, 404);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'Single directory found. Use the "path" parameter to point to the compendium directory.');
                done();
            });
        }).timeout(10000);

        it('public share with multiple directories / files: should throw an error (workspace not implemented) ', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/tY6I8NrDxTeXG85',
                path: '/',
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
                assert.propertyVal(JSON.parse(body), 'error', 'workspace creation not implemented');
                done();
            });
        }).timeout(10000);
    });

    describe('No new compendium with invalid requests', () => {
        it('invalid share URL: should respond with an error 422', (done) => {
            let form = {
                share_url: 'htts:/uni-muenster.sciebo.de/index.php/s/7EoWgjLSFV',
                path: '/',
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

        it('invalid host (not a sciebo public share): should respond with an error 403', (done) => {
            let form = {
                share_url: 'https://myowncloud.wxyz/index.php/s/G8vxQ1h50V4HpuA',
                path: '/',
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

        it('invalid token: should respond with an error 404', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/89k3ljf93kjfa',
                path: '/',
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
                assert.equal(res.statusCode, 404);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'could not read webdav contents');
                done();
            });
        }).timeout(10000);

        it('invalid webdav path: should respond with an error 404', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/G8vxQ1h50V4HpuA',
                path: '/ekjsle5',
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
                assert.equal(res.statusCode, 404);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'could not read webdav contents');
                done();
            });
        }).timeout(10000);

        it('insufficient user level: should respond with an error 401', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/G8vxQ1h50V4HpuA',
                path: '/ekjsle5',
                content_type: 'compendium',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie_plain);
            j.setCookie(ck, global.test_host);

            request({
                uri: global.test_host + '/api/v1/compendium',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestLoadingTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 401);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'user level does not allow compendium creation');
                done();
            });
        }).timeout(10000);
    });  
});

