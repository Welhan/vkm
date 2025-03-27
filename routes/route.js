const express = require("express");
const router = express.Router();
const IndexController = require("../controllers/IndexController");
const AuthController = require("../controllers/AuthController");
const SettingController = require("../controllers/SettingController");
const UploadController = require("../controllers/UploadController");
const AdminController = require("../controllers/AdminController");
const { uploadImage, uploadXlsx } = require("../configs/multer");
const multer = require("multer");
const crypto = require("crypto");

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let bannerPathMobile = "public/uploads/banner/mobile/";
    let bannerPathDesktop = "public/uploads/banner/desktop/";
    if (req.session.ID) {
      let isImage = file.mimetype.startsWith("image/");
      if (isImage) {
        if (file.fieldname === "imageMobile") {
          cb(null, bannerPathMobile);
        } else if (file.fieldname === "imageBanner") {
          cb(null, bannerPathDesktop);
        } else {
          cb(new Error("Unknown fieldname"), false);
        }
      } else {
        cb(new Error("File is not an image"), false);
      }
    } else {
      cb(new Error("No session ID"), false);
    }
  },
  filename: function (req, file, cb) {
    const randomString = crypto.randomBytes(16).toString("hex");
    const fileExtension = file.originalname.split(".").pop();
    cb(null, `${randomString}.${fileExtension}`);
  },
});
var upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

router.get("/", IndexController.index);
router.post("/getDetailOTP", IndexController.getDetailOTP);
router.get("/login", AuthController.login);
router.post("/auth", AuthController.auth);
router.get("/logout", AuthController.logout);
router.post("/getPendingWD", IndexController.countPendingWD);
router.post("/getPendingWager", IndexController.checkWagerPending);

//change password
router.post("/getChangePassword", AuthController.getChangePassword);
router.post("/changePassword", AuthController.changePassword);

//routing page
router.get("/upload-leaderboard", UploadController.index);
router.get("/settings", SettingController.index);
router.get("/admin", AdminController.index);

//admin
router.post("/checkEmail", AdminController.checkEmail);
router.post("/getDataAdmin", AdminController.getDataAdmin);
router.post("/getAddAdmin", AdminController.getAddAdmin);
router.post("/addAdmin", AdminController.addAdmin);
router.post("/getEditAdmin", AdminController.getEditAdmin);
router.post("/editAdmin", AdminController.editAdmin);
router.post("/getDeleteAdmin", AdminController.getDeleteAdmin);
router.post("/deleteAdmin", AdminController.deleteAdmin);
router.post("/getAccessAdmin", AdminController.getUserAccess);
router.post("/updateUserAccess", AdminController.updateUserAccess);

// uploads
router.post("/getDataTop50", UploadController.getDataTop50);
router.post("/dataTop50", UploadController.dataTop50);
router.post("/getDataTopSlot", UploadController.getDataTopSlot);
router.post("/dataTopSlot", UploadController.dataTopSlot);
router.post("/getDataTopCasino", UploadController.getDataTopCasino);
router.post("/dataTopCasino", UploadController.dataTopCasino);
router.post("/getDataTopWD", UploadController.getDataTopWD);
router.post("/dataTopWD", UploadController.dataTopWD);
router.get("/getDataTop200", UploadController.dataTop200);

//setting
router.post(
  "/save-setting",
  uploadImage.single("image"),
  SettingController.saveSetting
);

// upload
router.post(
  "/upload-xslx-process-leads",
  uploadXlsx.single("xslx"),
  UploadController.uploadXslxLeadsProcess
);
router.post("/getUploadLeadsProcess", UploadController.getUploadLeadsProcess);
router.get("/getTemplate", UploadController.templateUpload);

module.exports = router;
