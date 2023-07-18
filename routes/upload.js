const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const uuidv4 = require('uuid').v4;
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const { apiAuth, checkAuth } = require('../middlewares/auth');

const router = express.Router();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Maximum number of requests per windowMs
    message: 'Too many requests. Please try again later.',
});
router.use('/upload', limiter);

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

router.get('/upload', checkAuth, function (req, res) {
    const userFile = `./users/${req.user.id}.json`;
    const user = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    res.render('upload', { user: user });
});

router.post('/upload', apiAuth, function (req, res, next) {
  const fileSize = req.headers['content-length'];
  const userFile = `./users/${req.user.id}.json`;
  const user = JSON.parse(fs.readFileSync(userFile, 'utf8'));

  // Check the user's upload limit
  if (user.uploadLimit && fileSize > user.uploadLimit) {
    return res.status(400).send('Upload size limit exceeded. Cannot upload the file. Upgrade your account to increase the upload file size limit.');
  }

  // Check the total storage limit
  const totalSize = user.files.reduce((total, fileObj) => {
    const stats = fs.statSync(`./public/${fileObj.path}`);
    return total + stats.size;
  }, 0);

  const newTotalSize = totalSize + Number(fileSize);

  if (newTotalSize >= user.storageLimit) {
    return res.status(400).send('File size exceeded the storage limit. Upgrade your account to increase the storage limit.');
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

router.get('/files', checkAuth, function(req, res) {
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

router.get("/upload", checkAuth, function (req, res) {
  const userFile = `./users/${req.user.id}.json`;
  const user = JSON.parse(fs.readFileSync(userFile, "utf8"));
  res.render("upload", { user: user });
});

module.exports = function (app) {
  app.use('/', router);
};