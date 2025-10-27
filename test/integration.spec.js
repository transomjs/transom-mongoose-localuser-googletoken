"use strict";
const sinon = require('sinon');

describe('Integration Tests', function () {
    let expect;
    let sandbox;

    before(function () {
        return import('chai').then(function (chai) {
            expect = chai.expect;
        });
    });

    beforeEach(function () {
        sandbox = sinon.createSandbox();
    });

    afterEach(function () {
        sandbox.restore();
    });

    describe('Module loading', function () {
        it('should load main module without errors', function () {
            expect(function () {
                require('../index.js');
            }).to.not.throw();
        });

        it('should load GoogleTokenStrategy without errors', function () {
            expect(function () {
                require('../lib/GoogleTokenStrategy');
            }).to.not.throw();
        });

        it('should export initialize function', function () {
            const module = require('../index.js');
            expect(module.initialize).to.be.a('function');
        });
    });

    describe('GoogleTokenStrategy factory', function () {
        it('should return object with createStrategy method', function () {
            const GoogleStrategy = require('../lib/GoogleTokenStrategy');
            const mockServer = {
                registry: {
                    get: sandbox.stub().returns({
                        model: sandbox.stub().returns({})
                    })
                }
            };
            const strategy = GoogleStrategy(mockServer, {});
            
            expect(strategy).to.be.an('object');
            expect(strategy.createStrategy).to.be.a('function');
        });
    });

    describe('Configuration validation', function () {
        it('should handle empty options object', function () {
            const GoogleStrategy = require('../lib/GoogleTokenStrategy');
            const mockServer = {
                registry: {
                    get: sandbox.stub().returns({
                        model: sandbox.stub().returns({})
                    })
                }
            };
            
            expect(function () {
                GoogleStrategy(mockServer, {});
            }).to.not.throw();
        });

        it('should set default values for auth and groups', function () {
            const GoogleStrategy = require('../lib/GoogleTokenStrategy');
            const mockServer = {
                registry: {
                    get: sandbox.stub().returns({
                        model: sandbox.stub().returns({})
                    })
                }
            };
            const options = {};
            
            GoogleStrategy(mockServer, options);
            
            expect(options.auth).to.deep.equal({});
            expect(options.groups).to.deep.equal([]);
        });
    });
});