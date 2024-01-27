"use strict";
// const expect = require('chai').expect;
const sinon = require('sinon');
const GoogleStrategy = require('../lib/GoogleTokenStrategy');

describe('GoogleStrategy', function () {
    let expect;

    before(function () {
        return import('chai').then(function (chai) {
            expect = chai.expect;
        });
    });

    afterEach(function () {
        // restore original functionality
    });
    
    it('can call createStrategy', function () {
        // const dummyServer = {};
        // const dummyOptions = {};
    });


});