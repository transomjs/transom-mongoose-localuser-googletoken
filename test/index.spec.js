"use strict";
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('TransomLocalUserGoogleToken', function () {
    let expect;
    let TransomLocalUserGoogleToken;
    let mockServer;
    let mockPassport;
    let mockRegistry;
    let mockResponse;
    let mockRequest;
    let sandbox;
    let mockGoogleStrategy;
    let mockJwt;

    before(function () {
        return import('chai').then(function (chai) {
            expect = chai.expect;
        });
    });

    beforeEach(function () {
        sandbox = sinon.createSandbox();
        
        // Mock JWT
        mockJwt = {
            sign: sandbox.stub().returns('mock-jwt-token')
        };
        
        mockPassport = {
            use: sandbox.stub(),
            authenticate: sandbox.stub().returns((req, res, next) => {
                req.user = {
                    _id: 'user123',
                    username: 'testuser',
                    display_name: 'Test User',
                    email: 'test@example.com'
                };
                next();
            })
        };

        mockRegistry = {
            get: sandbox.stub().callsFake((key, defaultValue) => {
                switch (key) {
                    case 'transom-config.definition.uri.prefix':
                        return '/api';
                    case 'transom-config.definition.google':
                        return {};
                    case 'passport':
                        return mockPassport;
                    case 'transom-config.definition.localuser.jwt':
                        return {
                            algorithm: 'HS256',
                            expireSeconds: 600,
                            secret: 'test-secret'
                        };
                    case 'localUserMiddleware':
                        return {
                            isLoggedInMiddleware: () => (req, res, next) => {
                                req.locals = { user: { _id: 'user123' } };
                                next();
                            }
                        };
                    case 'transomMessageClient':
                        return {
                            disconnectUsers: sandbox.stub()
                        };
                    default:
                        return defaultValue;
                }
            })
        };

        mockResponse = {
            send: sandbox.stub(),
            setCookie: sandbox.stub(),
            clearCookie: sandbox.stub()
        };

        mockRequest = {
            user: null,
            locals: {}
        };

        mockServer = {
            registry: mockRegistry,
            post: sandbox.stub(),
            get: sandbox.stub()
        };

        // Mock the GoogleTokenStrategy
        mockGoogleStrategy = {
            createStrategy: sandbox.stub().returns({
                name: 'google',
                authenticate: sandbox.stub()
            })
        };

        // Use proxyquire to mock dependencies
        TransomLocalUserGoogleToken = proxyquire('../index.js', {
            'jsonwebtoken': mockJwt,
            './lib/GoogleTokenStrategy': sandbox.stub().returns(mockGoogleStrategy)
        });
    });

    afterEach(function () {
        sandbox.restore();
    });

    describe('initialize', function () {
        it('should throw error when JWT secret is missing', function () {
            mockRegistry.get.withArgs('transom-config.definition.localuser.jwt', {}).returns({});
            
            expect(function () {
                TransomLocalUserGoogleToken.initialize(mockServer, {});
            }).to.throw('TransomLocalUserGoogleToken requires a transom-config.definition.localuser.jwt.secret!');
        });

        it('should initialize with default options', function () {
            TransomLocalUserGoogleToken.initialize(mockServer, {});
            
            expect(mockPassport.use.calledOnce).to.be.true;
            expect(mockPassport.use.calledWith('google')).to.be.true;
            expect(mockServer.post.calledTwice).to.be.true;
            expect(mockServer.post.firstCall.args[0]).to.equal('/api/user/google');
            expect(mockServer.post.secondCall.args[0]).to.equal('/api/user/google/logout');
        });

        it('should initialize with custom strategy name', function () {
            TransomLocalUserGoogleToken.initialize(mockServer, { strategy: 'custom-google' });
            
            expect(mockPassport.use.calledWith('custom-google')).to.be.true;
            expect(mockServer.post.firstCall.args[0]).to.equal('/api/user/custom-google');
            expect(mockServer.post.secondCall.args[0]).to.equal('/api/user/custom-google/logout');
        });
    });

    describe('authentication endpoint', function () {
        let authHandler;

        beforeEach(function () {
            TransomLocalUserGoogleToken.initialize(mockServer, {});
            authHandler = mockServer.post.firstCall.args[2]; // Get the auth handler function
        });

        it('should return token on successful authentication', function (done) {
            const mockReq = {
                user: {
                    _id: 'user123',
                    username: 'testuser',
                    display_name: 'Test User',
                    email: 'test@example.com'
                }
            };

            const mockRes = {
                send: sandbox.stub(),
                setCookie: sandbox.stub()
            };

            authHandler(mockReq, mockRes);

            setTimeout(() => {
                expect(mockRes.send.calledOnce).to.be.true;
                expect(mockRes.send.calledWith({ token: 'mock-jwt-token' })).to.be.true;
                expect(mockRes.setCookie.calledOnce).to.be.true;
                expect(mockJwt.sign.calledOnce).to.be.true;
                done();
            }, 10);
        });

        it('should return 401 when user is not authenticated', function () {
            const mockReq = { user: null };
            const mockRes = { send: sandbox.stub() };

            authHandler(mockReq, mockRes);

            expect(mockRes.send.calledWith(401)).to.be.true;
        });
    });

    describe('logout endpoint', function () {
        let logoutHandler;

        beforeEach(function () {
            TransomLocalUserGoogleToken.initialize(mockServer, {});
            logoutHandler = mockServer.post.secondCall.args[2]; // Get the logout handler function
        });

        it('should clear cookie and send 204 on logout', function () {
            const mockReq = {
                locals: {
                    user: { _id: 'user123' }
                }
            };

            const mockRes = {
                send: sandbox.stub(),
                clearCookie: sandbox.stub()
            };

            logoutHandler(mockReq, mockRes);

            expect(mockRes.clearCookie.calledOnce).to.be.true;
            expect(mockRes.send.calledWith(204)).to.be.true;
        });
    });
});