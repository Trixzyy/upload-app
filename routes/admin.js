const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const { apiAuth, checkAuth, checkAdmin } = require('../middlewares/auth');

router.get('/admin', checkAuth, checkAdmin, function (req, res) {
  const usersDir = `./users`;
  const files = fs.readdirSync(usersDir);

  const users = files.map((fileName) => {
    const user = JSON.parse(
      fs.readFileSync(path.join(usersDir, fileName), 'utf8')
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

  res.render('admin', { users: userData, user: req.user, files: files.length });
});

router.get('/uploads', checkAuth, function(req, res) {
  const userId = req.query.userId; // Get the userId from the query parameter
  const userFile = `./users/${userId}.json`; // Use the userId to get the user's file

  if (fs.existsSync(userFile)) {
    const user = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    res.render('uploads', { user: user }); // Pass the user data to the 'uploads' view
  } else {
    res.status(404).send('User not found.');
  }
});

router.post('/admin/delete-user', apiAuth, checkAdmin, function (req, res) {
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

router.post("/admin/update-storage-limit", apiAuth, checkAdmin, function (req, res) {
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

module.exports = function (app) {
  app.use('/', router);
};