const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  id: String, // or ObjectId
  username: String,
  avatar: String,
  email: String,
  registrationDate: Date,
  locale: String,
  isAdmin: Boolean,
  apiKey: String,
  uploadLimit: Number,
  storageLimit: Number,
  files: [
    {
      path: String,
      originalName: String,
      timestamp: Number,
      thumbnail: String,
      size: Number,
    },
   ],
});

const User = mongoose.model('User', userSchema);

module.exports = User;