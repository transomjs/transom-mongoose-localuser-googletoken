'use strict';
const { Strategy } = require('passport-google-token');
const debug = require('debug')('transom:google');

module.exports = function GoogleStrategy(server, options) {
  options.auth = options.auth || {};
  options.groups = options.groups || [];
  
  function createStrategy() {
    debug(`Creating GoogleStrategy`);
    const mongoose = server.registry.get('mongoose');
    const AclUser = mongoose.model('TransomAclUser');
    return new Strategy(
      {
        clientID: options.auth.clientid,
        clientSecret: options.auth.secret,
        // enableProof: true, // sends a hash of the client & secret
        profileFields: ['id', 'emails', 'name', 'displayName'],
        passReqToCallback: true
      },
      function(req, accessToken, refreshToken, profile, callback) {
        let googleEmail;
        // Get the User's google (first) email address
        if (profile.emails && profile.emails.length > 0) {
          googleEmail = profile.emails[0].value.toLowerCase();
        } else {
          googleEmail = profile.id + '@google'; // Only used as a fallback.
        }

        new Promise((resolve, reject) => {
          profile.name = profile.name || {};
          profile.displayName = profile.displayName || profile.name.givenName + ' ' + profile.name.familyName;

          // User is already logged in, we have to link accounts!
          // Only link accounts, if the User is already logged in!
          if (req.locals.user) {
            resolve(req.locals.user); // pull the user out of the session
          } else {
            AclUser.findOne({
              'social.google.id': profile.id
            })
              .then(user => {
                if (user && user.active !== true) {
                  return reject('User account is inactive.');
                }
                if (!user) {
                  // We have a new User!
                  user = new AclUser();
                  user._id = mongoose.Types.ObjectId();
                  user.display_name = profile.displayName;
                  user.email = googleEmail;
                  user.username = googleEmail;
                  user.active = options.active === false ? false : true; // default true
                  user.verified_date = new Date();
                  user.groups = options.groups || []; // default no acl groups
                }
                resolve(user);
              })
              .catch(err => {
                reject(err);
              });
          }
        })
          .then(user => {
            return new Promise((resolve, reject) => {
              user.social = user.social || {};
              user.social.google = user.social.google || {};
              user.social.google.id = profile.id;
              user.social.google.picture = profile._json.picture;
              user.social.google.token = accessToken;
              user.social.google.name = profile.displayName;
              user.social.google.email = googleEmail;

              // Save this for after the finalize;
              user.__wasNew = user.isNew;

              // Save the record.
              user.finalizeLogin(
                {
                  req,
                  bearer: false
                },
                (err, user, message) => {
                  if (err) {
                    return reject(err);
                  }
                  if (!user && message) {
                    if (message.code === 11000) {
                      return reject('That email address is already registered.');
                    } else {
                      return reject(message || 'Error saving User record.');
                    }
                  }
                  // Success!
                  resolve(user);
                }
              );
            });
          })
          .then(user => {
            if (options.newUserCallback && user.__wasNew){
              return options.newUserCallback(server, user);
            } else {
              return Promise.resolve(user);
            }
          })
          .then(user => {
            callback(null, user);
          })
          .catch(err => {
            console.log('Error in Google login:', err);
            callback(err);
          });
      }
    );
  }

  const result = {
    createStrategy
  };

  return result;
};
