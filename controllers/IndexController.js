const express = require("express");
const axios = require("axios");
const helpers = require("../helpers/helpers");
const { constants } = require("../configs/constants");
const { db } = require("../configs/db");

module.exports = {
  index: async function (req, res) {
    let Username = req.session.Username;
    if (!Username) return res.redirect("/login");
    let menu = await helpers.generateMenu(Username);
    menu = await Promise.all(
      menu.map(async (item) => {
        item.submenu = await helpers.generateSubmenu(item.ID, Username);
        return item;
      })
    );
    let levelAccess = await helpers.checkUserAccess(Username, 0, 11);
    let otpAccess = await helpers.checkUserAccess(Username, 0, 12);
    sqlLevelUp = `Select * from levelup_history Where ApprovalStatus = 'Pending' AND WebsiteID = ${process.env.websiteID}`;
    countLevel = (await helpers.doQuery(db, sqlLevelUp)).results;
    return res.render("index", {
      successMessage: req.flash("success"),
      errorMessage: req.flash("error"),
      session: req.session,
      menu,
      active: 0,
      open: 0,
      levelUp: countLevel.length,
      csrfToken: req.csrfToken(),
      constants,
      levelAccess,
      otpAccess,
      constants,
    });
  },
  getDetailOTP: async function (req, res) {
    let Username = req.session.Username;
    if (!Username) return res.redirect("/login");
    let UserID = process.env.UserIDOTP;
    await axios
      .post(constants.otp_url + "get-detail-otp", { UserID })
      .then((response) => {
        let data = {
          Username: response.data.Username,
          Phone: response.data.Phone,
        };
        return res.status(200).json(data);
      })
      .catch((err) => {
        let data = {};
        return res.status(202).json(data);
      });
  },
  countPendingWD: async function (req, res) {
    let query =
      "SELECT COUNT(*) as total FROM withdraw_coin WHERE Status = 'Pending'";

    let result = (await helpers.doQuery(db, query)).results;
    data = {
      menu: "Coin Approval",
      result: result[0].total,
    };
    return res.json(data);
  },
  checkWagerPending: async function (req, res) {
    let query = `SELECT COUNT(*) as total FROM leaderboard_winner WHERE Process = 'Waiting' AND Category = 'Top Player'`;
    let result = (await helpers.doQuery(db, query)).results;

    let data = {
      menu: "Prize Approval",
      result: result[0].total,
    };

    return res.json(data);
  },
};
