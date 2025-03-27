const express = require("express");
const helpers = require("../helpers/helpers");
const dotenv = require("dotenv");
const axios = require("axios");
const fs = require("fs");
const { db } = require("../configs/db");
const { constants } = require("../configs/constants");
dotenv.config();

module.exports = {
  index: async function (req, res) {
    let Username = req.session.Username;
    if (!Username) return res.redirect("/login");
    let akses = await helpers.checkUserAccess(Username, 1, 1);
    if (!akses) return res.redirect("/");
    let menu = await helpers.generateMenu(Username);
    menu = await Promise.all(
      menu.map(async (item) => {
        item.submenu = await helpers.generateSubmenu(item.ID, Username);
        return item;
      })
    );

    let logo = (
      await helpers.doQuery(
        db,
        `SELECT Value FROM config WHERE Config = 'Logo'`
      )
    ).results;

    let BracketLink = (
      await helpers.doQuery(
        db,
        `SELECT Value FROM config Where Config = 'Bracket URL' AND WebsiteID = ?`,
        [process.env.websiteID]
      )
    ).results;
    let WebsiteName = (
      await helpers.doQuery(
        db,
        `SELECT Value FROM config Where Config = 'Website Name' AND WebsiteID = ?`,
        [process.env.websiteID]
      )
    ).results;
    let toBronze = (
      await helpers.doQuery(
        db,
        `SELECT Value FROM config Where Config = 'Turnover Bronze' AND WebsiteID = ?`,
        [process.env.websiteID]
      )
    ).results;
    let toSilver = (
      await helpers.doQuery(
        db,
        `SELECT Value FROM config Where Config = 'Turnover Silver' AND WebsiteID = ?`,
        [process.env.websiteID]
      )
    ).results;
    let toGold = (
      await helpers.doQuery(
        db,
        `SELECT Value FROM config Where Config = 'Turnover Gold' AND WebsiteID = ?`,
        [process.env.websiteID]
      )
    ).results;
    let toPlatinum = (
      await helpers.doQuery(
        db,
        `SELECT Value FROM config Where Config = 'Turnover Platinum' AND WebsiteID = ?`,
        [process.env.websiteID]
      )
    ).results;
    let toDiamond = (
      await helpers.doQuery(
        db,
        `SELECT Value FROM config Where Config = 'Turnover Diamond' AND WebsiteID = ?`,
        [process.env.websiteID]
      )
    ).results;
    let getWebsiteURL = (
      await helpers.doQuery(
        db,
        `SELECT Value FROM config WHERE Config = 'Link Main'`
      )
    ).results;
    let getTeleURL = (
      await helpers.doQuery(
        db,
        `SELECT Value FROM config WHERE Config = 'Link Telegram'`
      )
    ).results;
    let configs = {
      websiteName:
        WebsiteName.length > 0 ? WebsiteName[0].Value.toString() : "",
      websiteURL:
        getWebsiteURL.length > 0 ? getWebsiteURL[0].Value.toString() : "",
      telegramURL: getTeleURL.length > 0 ? getTeleURL[0].Value.toString() : "",
      mainURL:
        BracketLink.length > 0
          ? BracketLink[0].Value
            ? BracketLink[0].Value.toString()
            : ""
          : "",
      TOBronze:
        toBronze.length > 0
          ? helpers.reverseIndonesianNumber(toBronze[0].Value.toString())
          : "",
      TOSilver:
        toSilver.length > 0
          ? helpers.reverseIndonesianNumber(toSilver[0].Value.toString())
          : "",
      TOGold:
        toGold.length > 0
          ? helpers.reverseIndonesianNumber(toGold[0].Value.toString())
          : "",
      TOPlatinum:
        toPlatinum.length > 0
          ? helpers.reverseIndonesianNumber(toPlatinum[0].Value.toString())
          : "",
      TODiamond:
        toDiamond.length > 0
          ? helpers.reverseIndonesianNumber(toDiamond[0].Value.toString())
          : "",
      logo:
        logo.length > 0 ? (logo[0].Value ? logo[0].Value.toString() : "") : "",
    };

    let vips = (
      await helpers.doQuery(
        db,
        `SELECT * FROM vip_club WHERE WebsiteID = ? ORDER BY Privilege ASC`,
        [process.env.websiteID]
      )
    ).results;

    return res.render("settings/settings", {
      successMessage: req.flash("success"),
      errorMessage: req.flash("error"),
      session: req.session,
      menu,
      data: configs,
      websiteID: process.env.websiteID,
      csrfToken: req.csrfToken(),
      open: 1,
      active: 1,
      vips: vips,
      constants,
    });
  },
  saveSetting: async function (req, res) {
    let Username = req.session.Username;
    if (!Username) return res.redirect("/login");
    let image = req.file ? req.file.filename : null;
    let websiteName = req.body.websiteName;
    let mainURL = req.body.mainURL;
    let websiteURL = req.body.websiteURL;
    let telegramURL = req.body.telegramURL;
    let privilege = req.body.privilege;
    let privilege_tiers = new Array();
    if (privilege) {
      let dataBefore = (
        await helpers.doQuery(
          db,
          `SELECT Privilege, Tier FROM vip_club WHERE WebsiteID = ? GROUP BY Privilege`,
          [process.env.websiteID]
        )
      ).results;
      let definedLength = 0;
      if (dataBefore.length < privilege.length) {
        definedLength = privilege.length;
      } else {
        definedLength = dataBefore.length;
      }
      const privilege_tiers_found = [];
      for (let i = 1; i <= definedLength; i++) {
        const tierKey = `privilege_tiers${i}`;
        if (req.body[tierKey] && req.body[tierKey].length > 0) {
          privilege_tiers_found.push(req.body[tierKey]);
        }
      }
      privilege.forEach((el, index) => {
        if (privilege_tiers_found[index]) {
          let data_privilege = {
            Privilege: el,
            Tier: privilege_tiers_found[index].join(","),
          };
          privilege_tiers.push(data_privilege);
        }
      });
    } else {
      db.query(
        `DELETE FROM vip_club WHERE WebsiteID = ?`,
        [process.env.websiteID],
        function (err) {
          if (err) {
            console.log(err);
          }
        }
      );
    }
    let TOBronze = req.body.TOBronze ? req.body.TOBronze : 0;
    let TOSilver = req.body.TOSilver ? req.body.TOSilver : 0;
    let TOGold = req.body.TOGold ? req.body.TOGold : 0;
    let TOPlatinum = req.body.TOPlatinum ? req.body.TOPlatinum : 0;
    let TODiamond = req.body.TODiamond ? req.body.TODiamond : 0;
    const websiteID = process.env.websiteID;

    if (websiteURL) {
      if (!/^(https?:\/\/)/.test(websiteURL)) {
        websiteURL = `https://${websiteURL}`;
      }

      if (!websiteURL.endsWith("/")) {
        websiteURL += "/";
      }
      let checkLinkMain = (
        await helpers.doQuery(
          db,
          `SELECT * FROM config WHERE Config = 'Link Main'`
        )
      ).results;
      if (checkLinkMain.length == 0) {
        db.query(
          `INSERT INTO config (Config, Value, WebsiteID, CDate, Last_Date) VALUE ('Link Main','',?,NOW(),NOW())`,
          [process.env.websiteID],
          function (err) {
            if (err) {
              console.log(err);
              req.flash("failed", "Failed to save settings!");
            }
            db.query(
              `UPDATE config SET Value = ? WHERE Config = 'Link Main' AND WebsiteID = ?`,
              [websiteURL, process.env.websiteID],
              function (err) {
                if (err) {
                  console.log(err);
                  req.flash("failed", "Failed to save settings!");
                }
              }
            );
          }
        );
      } else {
        db.query(
          `UPDATE config SET Value = ? WHERE Config = 'Link Main' AND WebsiteID = ?`,
          [websiteURL, process.env.websiteID],
          function (err) {
            if (err) {
              console.log(err);
              req.flash("failed", "Failed to save settings!");
            }
          }
        );
      }
    } else {
      db.query(
        `UPDATE config SET Value = '' WHERE Config = 'Link Main' AND WebsiteID = ?`,
        [process.env.websiteID],
        function (err) {
          if (err) {
            console.log(err);
            req.flash("failed", "Failed to save settings!");
          }
        }
      );
    }

    if (telegramURL) {
      if (!/^(https?:\/\/)/.test(telegramURL)) {
        telegramURL = `https://${telegramURL}`;
      }

      if (!telegramURL.endsWith("/")) {
        telegramURL += "/";
      }
      let checkLinkTele = (
        await helpers.doQuery(
          db,
          `SELECT * FROM config WHERE Config = 'Link Telegram'`
        )
      ).results;
      if (checkLinkTele.length == 0) {
        db.query(
          `INSERT INTO config (Config, Value, WebsiteID, CDate, Last_Date) VALUE ('Link Telegram','',?,NOW(),NOW())`,
          [process.env.websiteID],
          function (err) {
            if (err) {
              console.log(err);
              req.flash("failed", "Failed to save settings!");
            }
            db.query(
              `UPDATE config SET Value = ? WHERE Config = 'Link Telegram' AND WebsiteID = ?`,
              [telegramURL, process.env.websiteID],
              function (err) {
                if (err) {
                  console.log(err);
                  req.flash("failed", "Failed to save settings!");
                }
              }
            );
          }
        );
      } else {
        db.query(
          `UPDATE config SET Value = ? WHERE Config = 'Link Telegram' AND WebsiteID = ?`,
          [telegramURL, process.env.websiteID],
          function (err) {
            if (err) {
              console.log(err);
              req.flash("failed", "Failed to save settings!");
            }
          }
        );
      }
    } else {
      db.query(
        `UPDATE config SET Value = '' WHERE Config = 'Link Telegram' AND WebsiteID = ?`,
        [process.env.websiteID],
        function (err) {
          if (err) {
            console.log(err);
            req.flash("failed", "Failed to save settings!");
          }
        }
      );
    }

    if (mainURL !== "") {
      if (!/^(https?:\/\/)/.test(mainURL)) {
        mainURL = `https://${mainURL}`;
      }

      if (!mainURL.endsWith("/")) {
        mainURL += "/";
      }

      await axios
        .post(mainURL + "checkRoutes-api", {})
        .then(async (res) => {
          let sqlMainUrl = `SELECT * FROM config WHERE Config = 'Bracket URL' AND WebsiteID = ?`;
          checkMainUrl = (await helpers.doQuery(db, sqlMainUrl, [websiteID]))
            .results;

          if (checkMainUrl.length > 0) {
            sql = `UPDATE config SET Value = ? WHERE Config = 'Bracket URL' AND WebsiteID = ?`;
            db.query(sql, [mainURL, websiteID], function (err) {
              if (err) {
                console.error(err);
              }
            });
          } else {
            sql = `INSERT INTO config (Config, Value, WebsiteID, CDate) VALUES (?, ?, ?, NOW())`;
            db.query(sql, ["Bracket URL", mainURL, websiteID], function (err) {
              if (err) {
                console.error(err);
              }
            });
          }
          let dateNow = helpers.formatDate(new Date());
          let token = `W${process.env.websiteID}|${dateNow}`;
          token = Buffer.from(token).toString("base64");
          await axios
            .post(
              mainURL + "web-name-api",
              {},
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              }
            )
            .then(async (response) => {
              let websiteName;
              if (response.data.message === "Unauthorized") {
                websiteName = "";
              } else {
                websiteName = response.data.name;
              }
              let checkWebsiteName = (
                await helpers.doQuery(
                  db,
                  `SELECT * FROM config WHERE Config = 'Website Name' AND WebsiteID = ?`,
                  [websiteID]
                )
              ).results;
              if (checkWebsiteName.length > 0) {
                let sql = `UPDATE config SET Value = ? WHERE Config = 'Website Name' AND WebsiteID = ?`;
                db.query(sql, [websiteName, websiteID], function (err) {
                  if (err) {
                    console.error(err);
                  }
                });
              } else {
                let sql = `INSERT INTO config (Config, Value, WebsiteID, CDate) VALUES (?, ?, ?, NOW())`;
                db.query(
                  sql,
                  ["Website Name", websiteName, websiteID],
                  function (err) {
                    if (err) {
                      console.error(err);
                    }
                  }
                );
              }
            });
        })
        .catch((err) => {
          if (err && err.errors && err.errors[0]) {
            console.log(err.errors[0]);
          } else {
            console.log(err);
          }
        });
    } else {
      db.query(
        `UPDATE config SET Value = '' WHERE Config = 'Bracket URL' AND WebsiteID = ?`,
        [process.env.websiteID],
        function (err) {
          if (err) {
            console.log(err);
            req.flash("failed", "Failed to save settings!");
          }
        }
      );
    }

    if (image) {
      sqlImage = `SELECT * FROM config WHERE Config = 'Logo' AND WebsiteID = ?`;
      checkImage = (await helpers.doQuery(db, sqlImage, [websiteID])).results;
      if (checkImage.length > 0) {
        if (checkImage[0].Value) {
          fs.unlinkSync(
            "public/uploads/images/" +
              checkImage[0].Value.toString().split("/").pop(),
            function (err) {
              if (err) {
                console.error(err);
              } else {
              }
            }
          );
        }

        sql = `UPDATE config SET Value = ? WHERE Config = 'Logo' AND WebsiteID = ?`;
        db.query(
          sql,
          [process.env.base_url + "uploads/images/" + image, websiteID],
          function (err) {
            if (err) {
              console.error(err);
            }
          }
        );
      } else {
        sql = `UPDATE config SET Value = ? WHERE Config = 'Logo' AND WebsiteID = ?`;
        db.query(
          sql,
          [process.env.base_url + "uploads/images/" + image, websiteID],
          function (err) {
            if (err) {
              console.error(err);
            }
          }
        );
      }
    }

    let toBronze = (
      await helpers.doQuery(
        db,
        `SELECT * FROM config WHERE Config = 'Turnover Bronze' AND WebsiteID = ?`,
        [websiteID]
      )
    ).results;

    if (toBronze.length > 0) {
      sql = `UPDATE config SET Value = ? WHERE Config = 'Turnover Bronze' AND WebsiteID = ?`;
      db.query(
        sql,
        [helpers.formatToIndonesianNumber(TOBronze), websiteID],
        function (err) {
          if (err) {
            console.error(err);
          }
        }
      );
    } else {
      sql = `INSERT INTO config (Config, Value, WebsiteID, CDate) VALUES (?, ?, ?, NOW())`;
      db.query(
        sql,
        [
          "Turnover Bronze",
          helpers.formatToIndonesianNumber(TOBronze),
          websiteID,
        ],
        function (err) {
          if (err) {
            console.error(err);
          }
        }
      );
    }

    let toSilver = (
      await helpers.doQuery(
        db,
        `SELECT * FROM config WHERE Config = 'Turnover Silver' AND WebsiteID = ?`,
        [websiteID]
      )
    ).results;

    if (toSilver.length > 0) {
      sql = `UPDATE config SET Value = ? WHERE Config = 'Turnover Silver' AND WebsiteID = ?`;
      db.query(
        sql,
        [helpers.formatToIndonesianNumber(TOSilver), websiteID],
        function (err) {
          if (err) {
            console.error(err);
          }
        }
      );
    } else {
      sql = `INSERT INTO config (Config, Value, WebsiteID, CDate) VALUES (?, ?, ?, NOW())`;
      db.query(
        sql,
        [
          "Turnover Silver",
          helpers.formatToIndonesianNumber(TOSilver),
          websiteID,
        ],
        function (err) {
          if (err) {
            console.error(err);
          }
        }
      );
    }

    let toGold = (
      await helpers.doQuery(
        db,
        `SELECT * FROM config WHERE Config = 'Turnover Gold' AND WebsiteID = ?`,
        [websiteID]
      )
    ).results;

    if (toGold.length > 0) {
      sql = `UPDATE config SET Value = ? WHERE Config = 'Turnover Gold' AND WebsiteID = ?`;
      db.query(
        sql,
        [helpers.formatToIndonesianNumber(TOGold), websiteID],
        function (err) {
          if (err) {
            console.error(err);
          }
        }
      );
    } else {
      sql = `INSERT INTO config (Config,Value,WebsiteID,CDate) VALUES ('Turnover Gold', ?, ?, NOW())`;
      db.query(
        sql,
        [helpers.formatToIndonesianNumber(TOGold), websiteID],
        function (err) {
          if (err) {
            console.error(err);
          }
        }
      );
    }

    let toPlatinum = (
      await helpers.doQuery(
        db,
        `SELECT * FROM config WHERE Config = 'Turnover Platinum' AND WebsiteID = ?`,
        [websiteID]
      )
    ).results;

    if (toPlatinum.length > 0) {
      sql = `UPDATE config SET Value = ? WHERE Config = 'Turnover Platinum' AND WebsiteID = ?`;
      db.query(
        sql,
        [helpers.formatToIndonesianNumber(TOPlatinum), websiteID],
        function (err) {
          if (err) {
            console.error(err);
          }
        }
      );
    } else {
      sql = `INSERT INTO config (Config, Value, WebsiteID, CDate) VALUES (?, ?, ?, NOW())`;
      db.query(
        sql,
        [
          "Turnover Platinum",
          helpers.formatToIndonesianNumber(TOPlatinum),
          websiteID,
        ],
        function (err) {
          if (err) {
            console.error(err);
          }
        }
      );
    }

    let toDiamond = (
      await helpers.doQuery(
        db,
        `SELECT * FROM config WHERE Config = 'Turnover Diamond' AND WebsiteID = ?`,
        [websiteID]
      )
    ).results;

    if (toDiamond.length > 0) {
      sql = `UPDATE config SET Value = ? WHERE Config = 'Turnover Diamond' AND WebsiteID = ?`;
      db.query(
        sql,
        [helpers.formatToIndonesianNumber(TODiamond), websiteID],
        function (err) {
          if (err) {
            console.error(err);
          }
        }
      );
    } else {
      sql = `INSERT INTO config (Config, Value, WebsiteID, CDate) VALUES (?, ?, ?, NOW())`;
      db.query(
        sql,
        [
          "Turnover Diamond",
          helpers.formatToIndonesianNumber(TODiamond),
          websiteID,
        ],
        function (err) {
          if (err) {
            console.error(err);
          }
        }
      );
    }

    if (privilege_tiers.length > 0) {
      helpers
        .doQuery(db, `DELETE FROM vip_club WHERE WebsiteID = ?`, [
          process.env.websiteID,
        ])
        .then(() => {
          const insertPromises = [];
          privilege_tiers.forEach(async (el) => {
            const query = `
              INSERT INTO vip_club (Tier, Privilege, WebsiteID, CDate, Last_Date)
              VALUE (?, ?, ?, NOW(), NOW())
            `;
            insertPromises.push(
              helpers.doQuery(db, query, [
                el.Tier,
                el.Privilege,
                process.env.websiteID,
              ])
            );
          });
          return Promise.all(insertPromises);
        })
        .then(() => {})
        .catch((err) => {
          console.error("An error occurred:", err);
        });
    }
    req.flash("success", "Settings saved!");
    return res.redirect("/settings");
  },
};
