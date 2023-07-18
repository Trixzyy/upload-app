const fs = require("fs");
const path = require("path");

function handleUpload(req, res, next) {
  if (!req.body) {
    return res.status(400).send("No request body provided.");
  }

  const fileSize = req.headers["content-length"];
  const userFile = `./users/${req.user.id}.json`;
  const user = JSON.parse(fs.readFileSync(userFile, "utf8"));

  // Check the user's upload limit
  if (user.uploadLimit && fileSize > user.uploadLimit) {
    return res.status(400).send("Upload size limit exceeded. Cannot upload the file.");
  }

  // Check the total storage limit
  const totalSize = user.files.reduce((total, fileObj) => {
    const stats = fs.statSync(`./public/${fileObj.path}`);
    return total + stats.size;
  }, 0);

  const newTotalSize = totalSize + Number(fileSize);

  if (newTotalSize >= user.storageLimit) {
    return res.status(400).send("Storage limit exceeded. Cannot upload more files.");
  }

  // Check if a file is provided
  if (!req.file) {
    return res.status(400).send("No file provided.");
  }

  // Process the successful file upload
  const filePath = path.join("uploads", req.file.filename);
  user.files.push({ path: filePath, originalName: req.file.originalname });
  fs.writeFileSync(userFile, JSON.stringify(user), { flag: "w" });

  const fileUrl = new URL(filePath, `${req.protocol}://${req.get("host")}/uploads`).href;

  res.status(200).send({
    status: "success",
    message: "File uploaded successfully",
    fileUrl: fileUrl,
  });
}

module.exports = handleUpload;