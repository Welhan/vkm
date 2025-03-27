const express = require("express");
const dotenv = require("dotenv");
const helpers = require("../helpers/helpers");
const constants = require("../configs/constants");
const { db } = require("../configs/db");
const bcrypt = require("bcrypt");
const fs = require("fs");
const forge = require("node-forge");
dotenv.config();

function decrypt(encryptedString) {
  const privateKeyPem = fs.readFileSync("private_key.pem", "utf8");
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const encryptedBytes = forge.util.decode64(encryptedString);
  return privateKey.decrypt(encryptedBytes, "RSA-OAEP", {
    md: forge.md.sha256.create(),
  });
}

module.exports = {
  login: async function (req, res) {
    const publicKey = fs.readFileSync("public_key.pem", "utf8");
    res.render("login/login", {
      layout: false,
      csrfToken: req.csrfToken(),
      successMessage: req.flash("success"),
      errorMessage: req.flash("error"),
      publicKey,
    });
  },
  auth: async function (req, res) {
    let Username = req.body.username;
    let Password = req.body.password;
    Password = decrypt(Password);
    let error = {};
    if (!Username) {
      error.Username = "Nama Pengguna wajib diisi";
    }
    if (!Password) {
      error.Password = "Kata sandi wajib diisi";
    }
    if (Object.keys(error).length > 0) {
      return res.json({ error: error });
    }
    let checkUser = (
      await helpers.doQuery(
        db,
        `SELECT ID, Username, Password, UserID, Email FROM admin WHERE Username = ?`,
        [Username]
      )
    ).results;
    if (checkUser.length > 0) {
      let thisMatch = await bcrypt.compare(Password, checkUser[0].Password);
      if (thisMatch) {
        req.session.ID = checkUser[0].ID;
        req.session.Username = checkUser[0].Username.toUpperCase();
        req.session.UserID = checkUser[0].UserID;
        req.session.Email = checkUser[0].Email;
        req.flash("success", "Login berhasil");
        return res.json({ redirect: "/" });
      } else {
        req.flash("error", "Login gagal!");
        return res.json({ redirect: "/login" });
      }
    } else {
      req.flash("error", "Login gagal!");
      return res.json({ redirect: "/login" });
    }
  },
  getChangePassword: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    res.render(
      "modals/changePassword",
      { layout: false, csrfToken: req.csrfToken() },
      (err, html) => {
        if (err) {
          console.error("Error rendering template:", err);
        }
        return res.json({
          view: html,
        });
      }
    );
  },
  changePassword: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    let CurrentPassword = req.body.CurrentPassword;
    let NewPassword = req.body.NewPassword;
    let ConfirmPassword = req.body.ConfirmPassword;
    let Username = req.session.Username;
    let Email = req.session.Email;
    let error = {};
    if (!CurrentPassword) {
      error.CurrentPassword = "Password saat ini wajib diisi";
    }
    if (!NewPassword) {
      error.NewPassword = "Password baru wajib diisi";
    }
    if (!ConfirmPassword) {
      error.ConfirmPassword = "Konfirmasi password baru wajib diisi";
    }
    if (ConfirmPassword != NewPassword) {
      error.Mismatch = "Password tidak sama";
    }
    if (Object.keys(error).length > 0) {
      return res.json({ error: error });
    }
    let checkUser = (
      await helpers.doQuery(
        db,
        `SELECT ID, Username, Password, UserID FROM admin WHERE Username = ? AND Email = ?`,
        [Username, Email]
      )
    ).results;
    if (checkUser.length > 0) {
      let thisMatch = await bcrypt.compare(
        CurrentPassword,
        checkUser[0].Password
      );
      let Password = await bcrypt.hash(NewPassword, 10);
      if (thisMatch) {
        db.query(
          `UPDATE admin SET Password = ? WHERE Username = ? AND Email = ?`,
          [Password, Username, Email],
          function (err) {
            if (err) {
              req.flash("error", "Ganti password gagal!");
              return res.status(202).json(true);
            }
            req.flash("success", "Ganti password berhasil!");
            return res.status(200).json(true);
          }
        );
      } else {
        req.flash("error", "Ganti password gagal!");
        return res.status(202).json(true);
      }
    } else {
      req.flash("error", "Ganti password gagal!");
      return res.status(202).json(true);
    }
  },
  logout: async function (req, res) {
    req.session.destroy();
    return res.redirect("/login");
  },
};
