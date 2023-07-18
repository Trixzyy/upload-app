const passport = require('passport');
const Strategy = require('passport-discord').Strategy;
const fs = require('fs');
const { clientID, clientSecret, redirectURL } = require('../config.json');

const uuidv4 = require('uuid').v4;

module.exports = function(app) {
    app.use(passport.initialize());
    app.use(passport.session());
  
    passport.serializeUser((user, done) => {
      done(null, user);
    });
  
    passport.deserializeUser((obj, done) => {
      done(null, obj);
    });
  
    passport.use(
      new Strategy(
        {
          clientID: clientID,
          clientSecret: clientSecret,
          callbackURL: `${redirectURL}/callback`,
          scope: ['identify', 'email'],
        },
        (accessToken, refreshToken, profile, done) => {
          process.nextTick(() => {
            const dir = "./users";
            const userFile = `${dir}/${profile.id}.json`;
    
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir);
            }
    
            let apiKey;
            if (!fs.existsSync(userFile)) {
              apiKey = uuidv4();
              fs.writeFileSync(
                userFile,
                JSON.stringify({
                  id: profile.id,
                  username: profile.username,
                  avatar: profile.avatar,
                  email: profile.email,
                  locale: profile.locale,
                  isAdmin: false,
                  apiKey: apiKey,
                  uploadLimit: 5e+8, // 500MB in bytes
                  storageLimit: 1e+10, // 10GB in bytes
                  files: [],
                }),
                { flag: "w" },
                (err) => {
                  if (err) throw err;
                }
              );
            } else {
              apiKey = JSON.parse(fs.readFileSync(userFile, "utf8")).apiKey;
            }
    
            done(null, Object.assign(profile, { apiKey: apiKey }));
          });
        }
      )
    )};