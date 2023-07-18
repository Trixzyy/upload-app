const fs = require('fs');

const hasRequestBody = function (req, res, next) {
  const contentLength = req.headers['content-length'];
  if (!contentLength || contentLength === '0') {
    return res.status(400).send('No body provided.');
  }
  next();
};

function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.cookie("redirectTo", req.originalUrl); // Store the originalUrl in cookie redirectTo
  res.send(`
    Hi there! <br></br>
    Please <a href="/login">login</a>`);
}

function apiAuth(req, res, next) {
  const apiKey = req.get("X-API-KEY");
  const userID = req.get("X-User-ID");
  const userFile = `./users/${userID}.json`;

  if (fs.existsSync(userFile)) {
    const user = JSON.parse(fs.readFileSync(userFile, "utf8"));
    if (user.apiKey === apiKey) {
      req.user = user;
      next();
    } else {
      res.status(403).send("Invalid API key.");
    }
  } else {
    res.status(403).send("Invalid User ID.");
  }
}

function checkAdmin(req, res, next) {
  const userFile = `./users/${req.user.id}.json`;
  if (fs.existsSync(userFile)) {
    const user = JSON.parse(fs.readFileSync(userFile, "utf8"));
    if (user.isAdmin) {
      return next();
    } else {
      res
        .status(403)
        .send(
          `You are not an administator. If you believe this is a mistake, please contact the server administrator.`
        );
    }
  } else {
    res
      .status(403)
      .send(
        `You are not an administator. If you believe this is a mistake, please contact the server administrator.`
      );
  }
}

module.exports = {
  hasRequestBody,
  checkAuth,
  apiAuth,
  checkAdmin
};