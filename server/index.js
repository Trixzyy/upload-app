const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const mongoose = require('mongoose');

// Load config
const { secretCookieString, redirectURL, mongoURI } = require("../config.json");


// Connect to MongoDB
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

const app = express();

app.use(
  session({
    secret: secretCookieString,
    cookie: {
      maxAge: 60000 * 60 * 24,
    },
    saveUninitialized: false,
    resave: false,
    name: "discord.oauth2",
  })
);

app.use(cors());
app.use(cookieParser());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load Passport methods and middleware
require('../passportAuth/passport')(app);

// Load routes
['user', 'admin', 'upload'].forEach(file => require(`../routes/${file}`)(app));

app.use("/uploads", express.static(path.join(__dirname, "..", "public/uploads")));

app.locals.formatStorageLimit = function (limit) {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let index = 0;
    while (limit >= 1024 && index < units.length - 1) {
      limit /= 1024;
      index++;
    }
    if (index === 2 && limit >= 1000) {
      limit /= 1024;
      index++;
    }
    return `${limit.toFixed(2)} ${units[index]}`;
  };

app.listen(3000, function (err) {
  if (err) return console.error(err);
  console.log(`Listening at ${redirectURL}`);
});