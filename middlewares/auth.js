const mongoose = require('mongoose');
const User = require('../models/User'); // Import Mongoose User model
const { Types } = mongoose; // Import the Types module from Mongoose

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
  res.render("login");
}

async function apiAuth(req, res, next) {
  const apiKey = req.get("X-API-KEY");
  const userID = req.get("X-User-ID");

  try {
    const user = await User.findOne({ id: userID }); // Use "id" field for user lookup

    if (user) {
      if (user.apiKey === apiKey) {
        req.user = user;
        next();
      } else {
        res.status(403).send("Invalid API key.");
      }
    } else {
      res.status(403).send("Invalid User ID.");
    }
  } catch (error) {
    console.error("Error checking API authentication:", error);
    res.status(500).send("Internal Server Error");
  }
}


async function checkAdmin(req, res, next) {
  const userID = req.user._id; // Assuming req.user contains the user data

  try {
    if (!Types.ObjectId.isValid(userID)) {
      return res.status(400).send('Invalid User ID.');
    }

    const user = await User.findById(userID);

    if (user && user.isAdmin) {
      return next();
    } else {
      res
        .status(403)
        .send(
          `You are not an administrator. If you believe this is a mistake, please contact the server administrator.`
        );
    }
  } catch (error) {
    console.error("Error checking admin status:", error);
    res.status(500).send("Internal Server Error");
  }
}

module.exports = {
  hasRequestBody,
  checkAuth,
  apiAuth,
  checkAdmin
};
