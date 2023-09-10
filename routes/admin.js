const express = require('express');
const router = express.Router();
const { apiAuth, checkAuth, checkAdmin } = require('../middlewares/auth');
const User = require('../models/User'); // Import your Mongoose User model
const fs = require('fs');

router.get('/admin', checkAuth, checkAdmin, async (req, res) => {
  try {
    const users = await User.find();
    const userData = await Promise.all(
      users.map(async (user) => {
        const totalSize = await calculateTotalSize(user.files);
        return {
          username: user.username,
          files: user.files.length,
          totalSize: totalSize / 1024 / 1024,
          id: user.id, // Use _id instead of id
          storageLimit: user.storageLimit,
        };
      })
    );

    res.render('admin', {
      users: userData,
      user: req.user,
      files: users.length,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/uploads', checkAuth, checkAdmin, async (req, res) => {
  const userId = req.query._id;
  try {
    const user = await User.findById(userId);
    if (user) {
      res.render('uploads', { user: user });
    } else {
      res.status(404).send('User not found.');
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/admin/delete-user', apiAuth, checkAdmin, async (req, res) => {
  const { _id } = req.body;
  try {
    const user = await User.findById(_id);
    if (user) {
      // Remove the user's session if it exists (You may need to implement session removal logic here)
      await User.deleteOne({ _id: userID });
      res.sendStatus(200);
    } else {
      res.status(404).send({
        error: `User with ID ${userID} not found`,
      });
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

router.post('/admin/update-storage-limit', apiAuth, checkAdmin, async (req, res) => {
  console.log('Request body:', req.body); // Log the request body
  const { storageLimit, userID } = req.body;
  try {
    const user = await User.findById(userID);
    if (user) {
      const storageLimitBytes = parseFloat(storageLimit) * 1024 * 1024;
      user.storageLimit = storageLimitBytes;
      await user.save();
      res.status(200).send({
        status: 'success',
        message: 'Storage limit updated successfully',
        newLimit: user.storageLimit,
      });
    } else {
      res.status(404).send({
        error: `User with ID: ${userID} was not found`,
      });
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

module.exports = function (app) {
  app.use('/', router);
};

// Helper function to calculate total file size
async function calculateTotalSize(files) {
  let totalSize = 0;
  for (const fileObj of files) {
    const filePath = `./public/${fileObj.path}`;
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }
  }
  return totalSize;
}
