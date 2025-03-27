const express = require("express");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const axios = require("axios");
const { db } = require("../configs/db");
const helpers = require("../helpers/helpers");
const { constants } = require("../configs/constants");
dotenv.config();

function formatDate(date, dateTime = true, delimiter = true) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  if (dateTime) {
    if (delimiter) {
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } else {
      return `${year}${month}${day}${hours}${minutes}${seconds}`;
    }
  } else {
    return `${year}-${month}-${day}`;
  }
}

module.exports = {
  index: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    let Username = req.session.Username;
    let akses = await helpers.checkUserAccess(Username, 5, 6);
    if (!akses) return res.redirect("/");
    let menu = await helpers.generateMenu(Username);
    menu = await Promise.all(
      menu.map(async (item) => {
        item.submenu = await helpers.generateSubmenu(item.ID, Username);
        return item;
      })
    );
    return res.render("admin/admin", {
      successMessage: req.flash("success"),
      errorMessage: req.flash("error"),
      session: req.session,
      menu,
      open: 5,
      active: 6,
      csrfToken: req.csrfToken(),
      constants,
    });
  },
  checkEmail: async function (req, res) {
    if (!req.session.ID) {
      return res.status(200).json({ logout: "/logout" });
    }
    let Email = req.body.Email || "";
    let dateNow = formatDate(new Date());
    let token = `W${process.env.websiteID}|${Email}|${dateNow}`;
    token = Buffer.from(token).toString("base64");
    let suggestions = new Array();
    let BracketURL = await helpers.getURLBracket();
    if (BracketURL) {
      await axios
        .post(
          BracketURL + "checkAdmin-api",
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        )
        .then((response) => {
          let data = {
            id: response.data.ID,
            text: response.data.Email,
          };
          suggestions.push(data);
        })
        .catch((err) => {
          let data = {
            id: "",
            text: "",
          };
          suggestions.push(data);
        });
      return res.json(suggestions);
    }
  },
  getDataAdmin: async function (req, res) {
    if (!req.session.ID) {
      return res.status(200).json({ logout: "/logout" });
    }
    let getDataAdmin = (
      await helpers.doQuery(
        db,
        `SELECT ID, Username, Email, AllowedF FROM admin`
      )
    ).results;
    return res.json({
      data: getDataAdmin,
    });
  },
  getAddAdmin: async function (req, res) {
    if (!req.session.ID) {
      return res.status(200).json({ logout: "/logout" });
    }
    res.render(
      "admin/modals/addAdmin",
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
  addAdmin: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    let Username = helpers.escapeHtml(req.body.Username);
    let Email = helpers.escapeHtml(req.body.Email);
    let UserID = helpers.escapeHtml(req.body.UserID);
    let Password = req.body.Password;
    let error = {};
    if (!Username) {
      error.Username = "Nama Pengguna wajib diisi";
    }
    if (!Email) {
      error.Email = "Email wajib diisi";
    }
    if (!Password) {
      error.Password = "Kata Sandi wajib diisi";
    }

    let checkEmailExist = (
      await helpers.doQuery(db, `SELECT * FROM admin WHERE Email = ?`, [Email])
    ).results;

    if (checkEmailExist.length > 0) {
      error.Email = "Email sudah terdaftar";
    }
    let checkUsernameExist = (
      await helpers.doQuery(db, `SELECT * FROM admin WHERE Username = ?`, [
        Username,
      ])
    ).results;

    if (checkUsernameExist.length > 0) {
      error.Username = "Username sudah terdaftar";
    }
    if (Object.keys(error).length > 0) {
      return res.json({ error: error });
    }
    Password = await bcrypt.hash(Password, 10);
    db.query(
      `INSERT INTO admin (Username, Email, UserID, Password, WebsiteID, CreatedDate, CreatedBy) VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
      [
        Username,
        Email,
        UserID,
        Password,
        process.env.websiteID,
        req.session.ID,
      ],
      function (err) {
        if (err) {
          req.flash("error", "Admin gagal ditambahkan!");
          return res.status(202).json({ status: false });
        }
        req.flash("success", "Admin berhasil ditambahkan!");
        return res.status(200).json({ status: true });
      }
    );
  },
  getEditAdmin: async function (req, res) {
    if (!req.session.ID) {
      return res.status(200).json({ logout: "/logout" });
    }
    let ID = req.body.ID;
    let getData = (
      await helpers.doQuery(
        db,
        `SELECT ID, Username, Email FROM admin WHERE ID = ${ID}`
      )
    ).results[0];
    res.render(
      "admin/modals/editAdmin",
      { layout: false, csrfToken: req.csrfToken(), data: getData },
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
  editAdmin: async function (req, res) {
    if (!req.session.ID) {
      return res.status(200).json({ logout: "/logout" });
    }
    let ID = req.body.ID;
    let Username = req.body.Username;
    let error = {};
    if (!Username) {
      error.Username = "Nama Pengguna wajib diisi";
    }
    let checkUsernameExist = (
      await helpers.doQuery(db, `SELECT * FROM admin WHERE Username = ?`, [
        Username,
      ])
    ).results;

    if (checkUsernameExist.length > 0) {
      error.Username = "Username sudah terdaftar";
    }
    if (Object.keys(error).length > 0) {
      return res.json({ error: error });
    }
    db.query(
      `UPDATE admin SET Username = ? WHERE ID = ?`,
      [Username, ID],
      function (err) {
        if (err) {
          req.flash("error", "Admin gagal diubah!");
          return res.status(202).json({ status: false });
        }
        req.flash("success", "Admin berhasil diubah!");
        return res.status(200).json({ status: true });
      }
    );
  },
  getDeleteAdmin: async function (req, res) {
    if (!req.session.ID) {
      return res.status(200).json({ logout: "/logout" });
    }
    let ID = req.body.ID;
    let getData = (
      await helpers.doQuery(
        db,
        `SELECT ID, Username, Email FROM admin WHERE ID = ${ID}`
      )
    ).results[0];
    res.render(
      "admin/modals/deleteAdmin",
      { layout: false, csrfToken: req.csrfToken(), data: getData },
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
  deleteAdmin: async function (req, res) {
    if (!req.session.ID) {
      return res.status(200).json({ logout: "/logout" });
    }
    let ID = req.body.ID;
    db.query(`DELETE FROM admin WHERE ID = ?`, [ID], function (err) {
      if (err) {
        req.flash("error", "Admin gagal dihapus!");
        return res.status(202).json({ status: false });
      }
      req.flash("success", "Admin berhasil dihapus!");
      return res.status(200).json({ status: true });
    });
  },
  getUserAccess: async function (req, res) {
    if (!req.session.ID) {
      return res.status(200).json({ logout: "/logout" });
    }
    let ID = req.body.ID;
    let getData = (
      await helpers.doQuery(db, `SELECT Username FROM admin WHERE ID = ?`, [ID])
    ).results;

    let Username = getData.length > 0 ? getData[0].Username : "";
    let menu = await helpers.generateMenu();
    menu = await Promise.all(
      menu.map(async (item) => {
        item.submenu = await helpers.generateSubmenu(item.ID);
        item.submenu = await Promise.all(
          item.submenu.map(async (subItem) => {
            subItem.access = await helpers.checkUserAccess(
              Username,
              item.ID,
              subItem.ID
            );
            return subItem;
          })
        );
        return item;
      })
    );
    let data = {
      username: Username,
      menu,
      // access,
    };

    res.render(
      "admin/modals/accessAdmin",
      {
        layout: false,
        csrfToken: req.csrfToken(),
        data: data,
        helpers,
      },
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
  updateUserAccess: async function (req, res) {
    if (!req.session.ID) {
      return res.status(200).json({ logout: "/logout" });
    }
    let Username = req.body.Username;
    let SubmenuID = req.body.SubmenuID;
    let View;
    let getDataAccess = (
      await helpers.doQuery(
        db,
        `SELECT View FROM user_access_menu WHERE SubmenuID = ${SubmenuID} AND Username = '${Username}'`
      )
    ).results;
    if (getDataAccess.length > 0) {
      if (getDataAccess[0].View == 1) {
        View = 0;
      } else {
        View = 1;
      }
      db.query(
        `UPDATE user_access_menu SET View = ${View} WHERE SubmenuID = ${SubmenuID} AND Username = '${Username}'`,
        function (err) {
          if (err) {
            console.log(err);
            return res.status(202).json({ status: false });
          }
          return res.status(200).json({ status: true });
        }
      );
    } else {
      let MenuID = (
        await helpers.doQuery(
          db,
          `SELECT MenuID FROM mst_submenu WHERE ID = ${SubmenuID}`
        )
      ).results[0].MenuID;
      let query = `INSERT INTO user_access_menu (Username, MenuID, SubmenuID, View) VALUE (?,?,?,?)`;
      let queryValues = [Username, MenuID, SubmenuID, 1];
      db.query(query, queryValues, function (err) {
        if (err) {
          console.log(err);
          return res.status(202).json({ status: false });
        }
        return res.status(200).json({ status: true });
      });
    }
  },
};
