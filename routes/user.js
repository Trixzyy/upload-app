const express = require('express');
const passport = require('passport');
const fs = require('fs');
const router = express.Router();

function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.cookie('redirectTo', req.originalUrl); // Store the originalUrl in cookie redirectTo
  res.send(`
    Hi there! <br></br>
    Please <a href='/login'>login</a>`);
}

router.get('/', checkAuth, function (req, res) {
  res.send(`Hello ${req.user.username}!<br></br><a href='/logout'>logout</a>`);
});

router.get(
  '/login',
  passport.authenticate('discord', {
    scope: ['identify', 'email'],
  }),
  function (req, res) {}
);

router.get(
  '/callback',
  passport.authenticate('discord', { failureRedirect: '/' }),
  function (req, res) {
    const redirectTo = req.cookies.redirectTo || '/'; // Get the redirectTo url from the cookies
    res.clearCookie('redirectTo'); // Delete the redirectTo cookie
    res.redirect(redirectTo);
  }
);

router.get('/logout', function (req, res) {
  req.session.destroy();
  req.logout(function (err) {
    if (err) {
      console.log(`Logout error: ${err}`);
    }
    res.redirect('/');
  });
});

router.get('/info', checkAuth, function (req, res) {
  res.json(req.user);
});

module.exports = function (app) {
  app.use('/', router);
};