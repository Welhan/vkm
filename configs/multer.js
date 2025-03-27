const multer = require("multer");
const path = require("path");

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/uploads/images");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const xlsxStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/uploads/xlsx");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/jpeg" ||
    file.mimetype === "image/png" ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only .jpeg, .png, and .xlsx files are allowed!"), false);
  }
};
const uploadImage = multer({ storage: imageStorage, fileFilter });
const uploadXlsx = multer({ storage: xlsxStorage, fileFilter });

module.exports = { uploadImage, uploadXlsx };
