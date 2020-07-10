'use strict';
const debug = require('debug')('transom:google');
const jwt = require('jsonwebtoken');
const GoogleStrategy = require('./lib/GoogleStrategy');

function TransomLocalUserGoogleToken() {
    this.initialize = function (server, options) {
        options = options || {};
        const strategyName = options.strategy || 'google';
        debug(`Initializing TransomLocalUserGoogleToken strategy: ${strategyName}`);

        const uriPrefix = server.registry.get('transom-config.definition.uri.prefix');
        const googleDefn = server.registry.get('transom-config.definition.google', {});
        const googleOptions = Object.assign({}, { baseApiUri: 'http://localhost' }, options, googleDefn);
        const strategy = new GoogleStrategy(server, googleOptions).createStrategy();

        const passport = server.registry.get('passport');
        passport.use(strategyName, strategy);

        const sendCookie = googleOptions.cookie === false ? false : true;

        // JWT settings
        const localuserJwt = server.registry.get('transom-config.definition.localuser.jwt', {});
        const jwtAlgorithm = localuserJwt.algorithm || 'HS256';
        const jwtExpireSeconds = localuserJwt.expireSeconds || 600;
        const jwtSecret = localuserJwt.secret;
        if (!jwtSecret) {
            throw new Error('TransomLocalUserGoogleToken requires a transom-config.definition.localuser.jwt.secret!');
        }

        function assignDefaults(expireDate) {
            return Object.assign(
                {},
                {
                    path: '/',
                    domain: googleOptions.baseApiUri.replace('://', ':').split(':')[1] || 'localhost',
                    expires: expireDate,
                    secure: false,
                    sameSite: 'None',
                    httpOnly: true,
                    token: 'access_token',
                },
                googleOptions.cookie
            );
        }

        function toCookieOptions(cookieOpts) {
            return {
                path: cookieOpts.path,
                domain: cookieOpts.domain,
                expires: cookieOpts.expires,
                secure: cookieOpts.secure,
                sameSite: cookieOpts.sameSite,
                httpOnly: cookieOpts.httpOnly,
            };
        }

        function createDefaultPayload(server, user) {
            return Promise.resolve({
                _id: user._id,
                username: user.username,
                display_name: user.display_name,
                email: user.email,
            });
        }

        function disconnectSocketUser(user) {
            const msgClient = server.registry.get('transomMessageClient');
            if (msgClient) {
                const io = msgClient.io;
                Object.keys(io.sockets.sockets)
                    .filter(function (key) {
                        return io.sockets.sockets[key].transomUser._id.toString() === user._id.toString();
                    })
                    .map(function (socketKey) {
                        // msgClient.emitToUsers(user, "what channel?", "bye!");;
                        if (io.sockets.sockets[socketKey]) {
                            debug(`Disconnecting socket user.`);
                            io.sockets.sockets[socketKey].disconnect();
                        }
                    });
            }
        }

        server.post(
            `${uriPrefix}/user/${strategyName}`,
            passport.authenticate(strategyName, { session: false }),
            function (req, res) {
                if (req.user) {
                    const makePayload = localuserJwt.createPayload || createDefaultPayload;
                    makePayload(server, req.user).then((payload) => {
                        const token = jwt.sign(payload, jwtSecret, {
                            algorithm: jwtAlgorithm,
                            expiresIn: jwtExpireSeconds,
                        });
                        if (sendCookie) {
                            const expireDate = new Date(new Date().getTime() + jwtExpireSeconds * 1000);
                            const cookieOpts = assignDefaults(expireDate);
                            debug(
                                `Setting ${cookieOpts.domain} API ${cookieOpts.token} in the cookie for ${jwtExpireSeconds} seconds.`
                            );
                            res.setCookie(cookieOpts.token, token, toCookieOptions(cookieOpts));
                        }
                        res.send({
                            token,
                        });
                    });
                } else {
                    res.send(401);
                }
            }
        );

        server.post(
            `${uriPrefix}/user/${strategyName}/logout`,
            function (req, res, next) {
                const middleware = server.registry.get('localUserMiddleware');
                const isLoggedIn = middleware.isLoggedInMiddleware();
                return isLoggedIn(req, res, next);
            },
            function (req, res) {
                if (req.locals && req.locals.user) {
                    disconnectSocketUser(req.locals.user);
                }
                if (sendCookie) {
                    const expireDate = new Date(1);
                    const cookieOpts = assignDefaults(expireDate);
                    debug(`Clearing ${cookieOpts.domain} API ${cookieOpts.token} cookie.`);
                    res.clearCookie(cookieOpts.token, toCookieOptions(cookieOpts));
                }
                res.send(204);
                // next();
            }
        );
    };
}
module.exports = new TransomLocalUserGoogleToken();
