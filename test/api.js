/* eslint-env mocha */
const assert = require('chai').assert;
const request = require('request');

const host = 'http://localhost';
const cookie = 's:C0LIrsxGtHOGHld8Nv2jedjL4evGgEHo.GMsWD5Vveq0vBt7/4rGeoH5Xx7Dd2pgZR9DvhKCyDTY';

describe('API basics', function () {
    describe('create new compendium based on public WebDAV', function () {
        var compendium_id = null;

        it('should respond with a compendium ID', (done) => {
            // ...
        });
        it('should list all the files that are in the WebDAV in the compendium file listing', (done) => {
            // ...
        });
    });
});