const express = require("express");
const multer = require("multer");
const uuidv4 = require("uuid").v4;
const rateLimit = require("express-rate-limit");
const exiftool = require("exiftool-vendored").exiftool;
const path = require("path");
const { apiAuth, checkAuth } = require("../middlewares/auth");
const mongoose = require("mongoose");
const User = require("../models/User"); // Import Mongoose User model
const sharp = require("sharp");
const { URL } = require('url');
const fs = require('fs');
const sanitizeHtml = require("sanitize-html");

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Maximum number of requests per windowMs
  message: "Too many requests. Please try again later.",
});
router.use("/upload", limiter);

// Create user directories synchronously
function createUserDirectories(req, file, cb) {
  const userId = req.user._id;
  const userDir = path.join('public/uploads', userId.toString());
  const userFilesDir = path.join(userDir, 'files');

  try {
    fs.mkdirSync(userDir, { recursive: true });
    fs.mkdirSync(userFilesDir, { recursive: true });
    cb(null, userFilesDir);
  } catch (err) {
    cb(err);
  }
}

// Configure multer storage with the synchronous function
const storage = multer.diskStorage({
  destination: createUserDirectories,
  filename: function (req, file, cb) {
    const fileName = file.originalname;
    cb(null, fileName);
  },
});

const upload = multer({ storage: storage });

router.get("/upload", checkAuth, async (req, res) => {
  try {
    const userId = req.user._id; // The user ID should already be a valid ObjectId
    const user = await User.findById(userId);
    res.render("upload", { user: user });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post('/upload', apiAuth, async (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).send('File size exceeds the allowed limit.');
      } else {
        console.error('Multer error:', err);
        return res.status(400).send('Error uploading the file.');
      }
    } else if (err) {
      console.error('Error uploading file:', err);
      return res.status(500).send('An error occurred while processing the file.');
    }

    // Check if a file is provided
    if (!req.file) {
      return res.status(400).send('No file provided.');
    }

    try {
      const userId = req.user._id; // The user ID should already be a valid ObjectId
      const user = await User.findById(userId);
      if (user) {
        const fileName = req.file.originalname;
        const filePath = path.join('uploads', userId.toString(), 'files', fileName);
        const fileUrl = new URL(filePath, `${req.protocol}://${req.get('host')}/`).href;

        // Calculate and save the file size
        const fileSize = req.file.size;

        const timestamp = Date.now();
        const fileObj = {
          path: filePath,
          originalName: fileName,
          size: fileSize,
          timestamp: timestamp,
        };
        user.files.push(fileObj);
        await user.save();

        res.status(200).send({
          status: 'success',
          message: 'File uploaded successfully',
          fileURL: fileUrl,
        });
      } else {
        res.status(404).send('User not found.');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).send('An error occurred while processing the file.');
    }
  });
});


router.get("/files", checkAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const sanitizedFiles = user.files.map((file) => {
      return {
        path: file.path,
        originalName: file.originalName,
        timestamp: file.timestamp,
      };
    });

    const itemsPerPage = 12;
    const page = parseInt(req.query.page) || 1;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = page * itemsPerPage;

    const sortedFiles = sanitizedFiles.sort((a, b) => b.timestamp - a.timestamp);
    const paginatedFiles = sortedFiles.slice(startIndex, endIndex);

    res.render("files", {
      files: paginatedFiles,
      username: user.username,
      avatar: user.avatar,
      id: user.id,
      email: user.email,
      totalPages: Math.ceil(sortedFiles.length / itemsPerPage),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching user files:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/files/api", checkAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const sanitizedFiles = user.files.map((file) => {
      return {
        path: sanitizeHtml(file.path),
        originalName: sanitizeHtml(file.originalName),
        timestamp: file.timestamp,
      };
    });

    const itemsPerPage = 12;
    const page = parseInt(req.query.page) || 1;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = page * itemsPerPage;

    const sortedFiles = sanitizedFiles.sort((a, b) => b.timestamp - a.timestamp);
    const paginatedFiles = sortedFiles.slice(startIndex, endIndex);

    res.json({
      files: paginatedFiles,
      totalPages: Math.ceil(sortedFiles.length / itemsPerPage),
    });
  } catch (error) {
    console.error("Error fetching user files:", error);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = function (app) {
  app.use("/", router);
};
