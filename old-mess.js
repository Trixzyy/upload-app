const {
  redirectURL,
  clientID,
  clientSecret,
  secretCookieString,
} = require("./config.json");

const express = require("express");
const passport = require("passport");
const session = require("express-session");
const Strategy = require("passport-discord").Strategy;
const sanitizeHtml = require("sanitize-html");
const fs = require("fs");
const path = require("path");
const app = express();
const uuidv4 = require("uuid").v4;
const multer = require("multer");
const cookieParser = require("cookie-parser");

const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Maximum number of requests per windowMs
    message: 'Too many requests. Please try again later.',
  });

app.use('/upload', limiter);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/uploads");
  },
  filename: function (req, file, cb) {
    const originalname = file.originalname;
    const extension = originalname.lastIndexOf(".");
    const name = originalname.substring(0, extension);
    const fileExt = originalname.substring(extension + 1);
    const filename = `${uuidv4()}_${name}.${fileExt}`;
    cb(null, filename);
  },
});
const upload = multer({ storage: storage });
const cors = require("cors");

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

app.use(passport.initialize());
app.use(passport.session());

app.use(cors());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(cookieParser());
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

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
      redirectURL: `${redirectURL}/callback`,
      scope: ["identify", "email"],
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
);

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

// Middleware to check if request has a body
const hasRequestBody = function (req, res, next) {
  const contentLength = req.headers['content-length'];
  if (!contentLength || contentLength === '0') {
    return res.status(400).send('No body provided.');
  }
  next();
};

app.get("/", checkAuth, function (req, res) {
  res.send(`
    Hello ${req.user.username}!<br></br>
    <a href="/logout">logout</a>`);
});

function checkAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.cookie("redirectTo", req.originalUrl); // Store the originalUrl in cookie redirectTo
  res.send(`
    Hi there! <br></br>
    Please <a href="/login">login</a>`);
}

app.get(
  "/login",
  passport.authenticate("discord", {
    scope: ["identify", "email"],
  }),
  function (req, res) {}
);

app.get(
  "/callback",
  passport.authenticate("discord", { failureRedirect: "/" }),
  function (req, res) {
    const redirectTo = req.cookies.redirectTo || "/"; // Get the redirectTo url from the cookies
    res.clearCookie("redirectTo"); // Delete the redirectTo cookie
    res.redirect(redirectTo);
  }
);

app.get("/logout", function (req, res) {
  req.session.destroy();
  req.logout(function (err) {
    if (err) {
      console.log(`Logout error: ${err}`);
    }
    res.redirect("/");
  });
});

app.get("/info", checkAuth, function (req, res) {
  res.json(req.user);
});

app.get("/upload", checkAuth, function (req, res) {
  const userFile = `./users/${req.user.id}.json`;
  const user = JSON.parse(fs.readFileSync(userFile, "utf8"));
  res.render("upload", { user: user });
});

app.post('/upload', apiAuth, hasRequestBody, function (req, res, next) {
  if (!req.body) {
    return res.status(400).send('No request body provided.');
  }

  const fileSize = req.headers['content-length'];
  const userFile = `./users/${req.user.id}.json`;
  const user = JSON.parse(fs.readFileSync(userFile, 'utf8'));

  // Check the user's upload limit
  if (user.uploadLimit && fileSize > user.uploadLimit) {
    return res.status(400).send('Upload size limit exceeded. Cannot upload the file.');
  }

  // Check the total storage limit
  const totalSize = user.files.reduce((total, fileObj) => {
    const stats = fs.statSync(`./public/${fileObj.path}`);
    return total + stats.size;
  }, 0);

  const newTotalSize = totalSize + Number(fileSize);

  if (newTotalSize >= user.storageLimit) {
    return res.status(400).send('Storage limit exceeded. Cannot upload more files.');
  }

  upload.single('file')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      // Handle multer errors
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).send('File size exceeds the allowed limit.');
      } else {
        return res.status(400).send('Error uploading the file.');
      }
    } else if (err) {
      // Handle other errors
      return res.status(500).send('An error occurred while processing the file.');
    }

    // Check if a file is provided
    if (!req.file) {
      return res.status(400).send('No file provided.');
    }

    // Process the successful file upload
    const filePath = path.join('uploads', req.file.filename);
    user.files.push({ path: filePath, originalName: req.file.originalname });
    fs.writeFileSync(userFile, JSON.stringify(user), { flag: 'w' });

    const fileUrl = new URL(filePath, `${req.protocol}://${req.get('host')}/uploads`).href;

    res.status(200).send({
      status: 'success',
      message: 'File uploaded successfully',
      fileUrl: fileUrl
    });
  });
});

app.use("/uploads", express.static(path.join(__dirname, "/public/uploads")));

app.get('/files', checkAuth, function(req, res) {
    const userFile = `./users/${req.user.id}.json`;
    const user = JSON.parse(fs.readFileSync(userFile, 'utf8'));

    // Sanitize the user files before rendering
    const sanitizedFiles = user.files.map(file => {
      return {
        path: sanitizeHtml(file.path),
        originalName: sanitizeHtml(file.originalName)
      };
    });
  
    res.render('files', { files: sanitizedFiles, username: user.username });
  });
  
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

app.get("/admin", checkAuth, checkAdmin, function (req, res) {
  const usersDir = `./users`;
  const files = fs.readdirSync(usersDir);

  const users = files.map((fileName) => {
    const user = JSON.parse(
      fs.readFileSync(path.join(usersDir, fileName), "utf8")
    );
    user.storageLimit = user.storageLimit || 0; // Provide a default value if storageLimit is not defined
    return user;
  });

  const userData = users.map((user) => {
    const files = user.files;
    const totalSize = files.reduce((total, fileObj) => {
      const stats = fs.statSync(`./public/${fileObj.path}`);
      return total + stats.size;
    }, 0);
    return {
      username: user.username,
      files: files.length,
      totalSize: totalSize / 1024 / 1024,
      id: user.id,
      storageLimit: user.storageLimit,
    };
  });

  res.render("admin", { users: userData, user: req.user });
});

// Define the formatStorageLimit helper function
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

app.get('/uploads', checkAuth, function(req, res) {
  const userId = req.query.userId; // Get the userId from the query parameter
  const userFile = `./users/${userId}.json`; // Use the userId to get the user's file

  if (fs.existsSync(userFile)) {
    const user = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    res.render('uploads', { user: user }); // Pass the user data to the 'uploads' view
  } else {
    res.status(404).send('User not found.');
  }
});

// Delete User
app.post("/admin/delete-user", apiAuth, checkAdmin, function (req, res) {
  const { userID } = req.body;
  const userFile = `./users/${userID}.json`;
  if (fs.existsSync(userFile)) {
    try {
      const user = JSON.parse(fs.readFileSync(userFile, "utf8"));
      user.files.forEach((fileObj) => {
        const filePath = `./public/${fileObj.path}`;
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      fs.unlinkSync(userFile);
      res.sendStatus(200);
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  } else {
    res.status(404).send({
      error: `User with ID ${userID} not found`,
    });
  }
});

// Update User Storage Limit
app.post("/admin/update-storage-limit", apiAuth, checkAdmin, function (req, res) {
    const { userID, storageLimit } = req.body;
    const userFile = `./users/${userID}.json`;
    if (fs.existsSync(userFile)) {
      try {
        const user = JSON.parse(fs.readFileSync(userFile, "utf8"));
        const storageLimitBytes = parseFloat(storageLimit) * 1024 * 1024; // Convert storageLimit from MB to bytes
        user.storageLimit = storageLimitBytes;
        fs.writeFileSync(userFile, JSON.stringify(user), { flag: "w" });
        res.status(200).send({
          status: "success",
          message: "Storage limit updated successfully",
          newLimit: user.storageLimit,
        });
      } catch (error) {
        console.error(error);
        res.sendStatus(500);
      }
    } else {
      res.status(404).send({
        error: `User with ID: ${userID} was not found`,
      });
    }
  }
);

app.listen(3000, function (err) {
  if (err) return console.error(err);
  console.log(`Listening at ${redirectURL}`);
});