/* eslint-env mocha */
const assert = require('chai').assert;
const request = require('request');

const host = 'http://localhost';
const cookie = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';

describe('API basics', function () {

    var compendium_id = '';
    describe('create new compendium based on public WebDAV', () => {
        it('bagit.txt: should respond with a compendium ID', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/c7hsPIHGvgWnD6U',
                path: '/sleeptainer',
                content_type: 'compendium_v1',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, host);

            request({
                uri: host + '/api/v1/public-share',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isObject(JSON.parse(body), 'returned JSON');
                assert.isDefined(JSON.parse(body).id, 'returned id');
                compendium_id = JSON.parse(body).id;
                done();
            });
        }).timeout(10000);

        it('zip file: should respond with a compendium ID', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/7EoWgjLSFVV89AO',
                path: '/sleeptainer',
                content_type: 'compendium_v1',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, host);

            request({
                uri: host + '/api/v1/public-share',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 200);
                assert.isObject(JSON.parse(body), 'returned JSON');
                assert.isDefined(JSON.parse(body).id, 'returned id');
                compendium_id = JSON.parse(body).id;
                done();
            });
        }).timeout(10000);

        it('single directory: should throw an error and notify that the directory contains no files', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/kg31BEkkwNgQWRi',
                path: '/sleeptainer',
                content_type: 'compendium_v1',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, host);

            request({
                uri: host + '/api/v1/public-share',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'directory contains no files');
                done();
            });
        }).timeout(10000);

        it('multiple directories / files: should throw an error (workspace not implemented) ', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/tY6I8NrDxTeXG85',
                path: '/sleeptainer',
                content_type: 'compendium_v1',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, host);

            request({
                uri: host + '/api/v1/public-share',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 403);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'workspace not implemented');
                done();
            });
        }).timeout(10000);

        it('invalid share URL: should respond with an error 404', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/7EoWgjLSFVV89AO not valid',
                path: '/sleeptainer',
                content_type: 'compendium_v1',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, host);

            request({
                uri: host + '/api/v1/public-share',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'invalid share URL');
                done();
            });
        }).timeout(10000);

        it('invalid token: should respond with an error 404', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/89k3ljf93kjfa',
                path: '/sleeptainer',
                content_type: 'compendium_v1',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, host);

            request({
                uri: host + '/api/v1/public-share',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'public share not found');
                done();
            });
        }).timeout(10000);

        it('invalid webdav path: should respond with an error 404', (done) => {
            let form = {
                share_url: 'https://uni-muenster.sciebo.de/index.php/s/7EoWgjLSFVV89AO',
                path: '/ekjsle5',
                content_type: 'compendium_v1',
            };

            let j = request.jar();
            let ck = request.cookie('connect.sid=' + cookie);
            j.setCookie(ck, host);

            request({
                uri: host + '/api/v1/public-share',
                method: 'POST',
                jar: j,
                form: form,
                timeout: requestTimeout
            }, (err, res, body) => {
                assert.ifError(err);
                assert.equal(res.statusCode, 404);
                assert.isUndefined(JSON.parse(body).id, 'returned no id');
                assert.propertyVal(JSON.parse(body), 'error', 'invalid webdav path');
                done();
            });
        }).timeout(10000);
    });  
});

