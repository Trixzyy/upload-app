const passport = require("passport");
const Strategy = require("passport-discord").Strategy;
const { EmbedBuilder, WebhookClient } = require('discord.js');
const mongoose = require("mongoose");
const uuidv4 = require("uuid").v4;

//load config
const {
  clientID,
  clientSecret,
  redirectURL,
  webhookId,
  webhookToken,
} = require("../config.json");

// Define a User model using Mongoose
const User = require("../models/User");

const webhookClient = new WebhookClient({ id: webhookId, token: webhookToken });

const sendRegistrationNotification = (user) => {
  const avatarURL = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}`;

const embed = new EmbedBuilder()
  .setTitle(`${user.username} has registered!`)
  .setColor('#556dff')
  .addFields(
    { name: 'Username', value: user.username},
    { name: 'User ID', value: user.id},
  )
  .setThumbnail(avatarURL)
  .setTimestamp()
  .setFooter({ text: 'BetterUpload', iconURL: 'https://cdn.discordapp.com/icons/1133071234196844605/133a2e378881257317bdc9d5f5c0b05c.webp' });


  webhookClient.send({
    embeds: [embed],
  });
};


module.exports = function (app) {
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
        scope: ["identify", "email"],
      },
      (accessToken, refreshToken, profile, done) => {
        process.nextTick(async () => {
          try {
            const existingUser = await User.findOne({ id: profile.id });

            if (!existingUser) {
              apiKey = uuidv4();

              const newUser = new User({
                id: profile.id,
                username: profile.username,
                avatar: profile.avatar,
                email: profile.email,
                registrationDate: new Date(),
                locale: profile.locale,
                isAdmin: false,
                apiKey: apiKey,
                uploadLimit: 5e8, // 500MB in bytes
                storageLimit: 1e10, // 10GB in bytes
                files: [],
              });

              await newUser.save();
              
              // Send registration notification to Discord
              sendRegistrationNotification(newUser);

              done(null, newUser);
            } else {
              // User exists, retrieve it from the database
              done(null, existingUser);
            }
          } catch (error) {
            done(error);
          }
        });
      }
    )
  );
};
