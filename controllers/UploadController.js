const express = require("express");
const helpers = require("../helpers/helpers");
const dotenv = require("dotenv");
const reader = require("xlsx");
const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const { db } = require("../configs/db");
const startTime = Date.now();
const loyalty = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
const games = ["Slot", "Casino"];
const { Worker } = require("worker_threads");
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
let errMsg = [];

async function updatePlacement() {
  new Promise((resolve, reject) => {
    loyalty.map(async (el) => {
      let sql = `SELECT ID, CASE WHEN Turnover IS NULL OR Turnover = 0 THEN '' ELSE ROW_NUMBER() OVER(ORDER BY Turnover DESC, Username ASC)
                END AS Placement, CurrentPlacement, LastPlacement
                FROM top_league
                WHERE Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND LAST_DAY(CURRENT_DATE()) AND League = ? AND WebsiteID = ?`;
      let classmentResult = (
        await helpers.doQuery(db, sql, [el, process.env.websiteID])
      ).results;
      await Promise.all(
        classmentResult.map(async (item) => {
          let update = {
            CurrentPlacement: Number(item.Placement),
            LastPlacement: Number(item.CurrentPlacement),
            Last_Date: formatDate(new Date()),
          };
          let where = { ID: item.ID };
          await helpers.updateData("top_league", update, where);
        })
      );
      resolve();
    }),
      games.map(async (game) => {
        let sql = `SELECT ID, CASE WHEN Turnover IS NULL OR Turnover = '' THEN '' ELSE ROW_NUMBER() OVER(ORDER BY Turnover DESC, Username ASC)
              END AS Placement, CurrentPlacement, LastPlacement
          FROM top_gamer
          WHERE Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND LAST_DAY(CURRENT_DATE()) AND Game_Category = ? AND WebsiteID = ?`;
        let classmentResult = (
          await helpers.doQuery(db, sql, [game, process.env.websiteID])
        ).results;

        await Promise.all(
          classmentResult.map(async (el) => {
            let update = {
              CurrentPlacement: Number(el.Placement),
              LastPlacement: Number(el.CurrentPlacement),
              Last_Date: formatDate(new Date()),
            };
            let where = { ID: el.ID };
            await helpers.updateData("top_gamer", update, where);
          })
        );
        resolve();
      });
  });
}
module.exports = {
  index: async function (req, res) {
    let Username = req.session.Username;
    if (!Username) return res.redirect("/login");
    let akses = await helpers.checkUserAccess(Username, 3, 5);
    if (!akses) return res.redirect("/");
    let menu = await helpers.generateMenu(Username);
    menu = await Promise.all(
      menu.map(async (item) => {
        item.submenu = await helpers.generateSubmenu(item.ID, Username);
        return item;
      })
    );
    let bracketLink = (
      await helpers.doQuery(
        db,
        `SELECT * FROM config WHERE Config = 'Bracket URL'`
      )
    ).results;

    return res.render("uploads/upload-leaderboard", {
      successMessage: req.flash("success"),
      errorMessage: req.flash("error"),
      session: req.session,
      menu,
      csrfToken: req.csrfToken(),
      open: 3,
      active: 5,
      bracket: bracketLink[0].Value ? true : false,
      constants,
    });
  },
  uploadXslxLeadsProcess: async function (req, res) {
    errMsg = new Array();
    let Username = req.session.Username;
    if (!Username) return res.redirect("/login");
    let file = reader.readFile("./public/uploads/xlsx/" + req.file.filename);
    let fileData = "./public/uploads/xlsx/" + req.file.filename;
    new Promise((resolve, reject) => {
      try {
        let errTemplate = new Array();
        let errTop50 = false;
        let errGame = false;
        let TotalData = 0;
        file.SheetNames.forEach(async (sheetName) => {
          if (sheetName == "Top 50") {
            let sheetData = reader.utils.sheet_to_json(file.Sheets[sheetName]);
            let headers = Object.keys(sheetData[0]);
            if (headers.length >= 4) {
              if (
                headers[0] !== "Player" ||
                headers[1] !== "Loyalty" ||
                headers[2] !== "Turnover" ||
                headers[3] !== "Fake Account"
              ) {
                errTop50 = true;
                let error = {
                  error: `Template Leaderboard Top50 Tidak Sesuai`,
                };
                errTemplate.push(error);
              } else {
                TotalData += sheetData.length;
              }
            } else {
              errTop50 = true;
              let error = { error: `Template Leaderboard Top50 Tidak Sesuai` };
              errTemplate.push(error);
            }
          } else if (sheetName == "Game") {
            let sheetData = reader.utils.sheet_to_json(file.Sheets[sheetName]);
            let headers = Object.keys(sheetData[0]);
            if (headers.length >= 4) {
              if (
                headers[0] != "Player" ||
                headers[1] != "Slot" ||
                headers[2] != "Casino" ||
                headers[3] != "Fake Account"
              ) {
                errGame = true;
                let error = { error: `Template Leaderboard Game Tidak Sesuai` };
                errTemplate.push(error);
              } else {
                TotalData += sheetData.length * 2;
              }
            } else {
              errGame = true;
              let error = { error: `Template Leaderboard Game Tidak Sesuai` };
              errTemplate.push(error);
            }
          }
        });
        if (errTemplate.length == 2) {
          req.flash(
            "error",
            "Template Leaderboard Top50 dan Game tidak sesuai"
          );
          return res.redirect("/upload-leaderboard");
        } else if (errTop50) {
          req.flash("error", "Template Leaderboard Top50 tidak sesuai");
          return res.redirect("/upload-leaderboard");
        } else if (errGame) {
          req.flash("error", "Template Leaderboard Game tidak sesuai");
          return res.redirect("/upload-leaderboard");
        } else {
          db.query(
            `INSERT INTO files (UploadFor, TotalData, CUserID, CDate) VALUE (?, ?, ?, NOW())`,
            ["Leaderboard", TotalData, req.session.ID],
            async function (err, results) {
              if (err) {
                req.flash("error", "Upload XLSX gagal!");
                return res.redirect("/upload-leaderboard");
              }
              req.session.FileID = results.insertId;
              req.flash("success", "Uploading...");
              res.redirect("/upload-leaderboard");
              const worker = new Worker(
                path.resolve(__dirname, "worker/worker.js"),
                {
                  workerData: {
                    file,
                    insertId: results.insertId,
                    FileID: req.session.FileID,
                  },
                }
              );

              worker.on("message", (result) => {
                errMsg.push({
                  row: result.row,
                  player: result.player,
                  message: result.message,
                });
              });

              worker.on("error", (err) => {
                console.log(err);
              });

              worker.on("exit", (code) => {
                if (code !== 0) {
                  console.error(`Worker stopped with exit code ${code}`);
                }
              });
              resolve();
            }
          );
        }
      } catch (error) {
        reject(error);
      }
    });
    fs.unlink(fileData, (err) => {});
  },
  getUploadLeadsProcess: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/login");
    }
    let FileID = req.session.FileID ? req.session.FileID : null;
    if (FileID) {
      let totalDataResult = (
        await helpers.doQuery(
          db,
          `SELECT TotalData, TotalNotFound FROM files WHERE ID = ?`,
          [FileID]
        )
      ).results;
      let totalData = totalDataResult[0].TotalData;
      let totalDataNotFound = totalDataResult[0]["TotalNotFound"];
      let uploadProcessTop50 = (
        await helpers.doQuery(
          db,
          `SELECT COUNT(ID) AS uploadProcess FROM top_league WHERE FileID = ?`,
          [FileID]
        )
      ).results[0].uploadProcess;
      let uploadProcessGame = (
        await helpers.doQuery(
          db,
          `SELECT COUNT(ID) AS uploadProcess FROM top_gamer WHERE FileID = ?`,
          [FileID]
        )
      ).results[0].uploadProcess;
      let uploadProcess = uploadProcessTop50 + uploadProcessGame;
      let progress = parseFloat(
        (uploadProcess + totalDataNotFound) / totalData
      );
      if (progress == 1) {
        req.session.FileID = null;
        updatePlacement();
      }
      res.json({ progress, errMsg: errMsg.length > 0 ? errMsg : [] });
    }
  },
  getDataTop50: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    res.render(
      "uploads/dataTable/top50",
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
  dataTop50: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    let Loyalty = req.body.Loyalty ? req.body.Loyalty : "Bronze";
    let queryGetData = `SELECT CurrentPlacement, Username, Turnover FROM top_league 
        WHERE Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') 
        AND LAST_DAY(CURRENT_DATE()) 
        AND League = ? 
        AND WebsiteID = ?
        AND Turnover > 0
        ORDER BY CurrentPlacement, Username ASC`;
    let values = [Loyalty, process.env.websiteID];
    let getData = (await helpers.doQuery(db, queryGetData, values)).results;
    return res.json({
      data: getData,
    });
  },
  getDataTopSlot: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    res.render(
      "uploads/dataTable/topSlot",
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
  dataTopSlot: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    let getData = (
      await helpers.doQuery(
        db,
        `SELECT CurrentPlacement, Username, Turnover FROM top_gamer 
        WHERE Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') 
        AND LAST_DAY(CURRENT_DATE()) 
        AND Game_Category = 'Slot' 
        AND WebsiteID = ? 
        AND Turnover > 0
        ORDER BY CurrentPlacement, Username ASC`,
        [process.env.websiteID]
      )
    ).results;
    return res.json({
      data: getData,
    });
  },
  getDataTopWD: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    res.render(
      "uploads/dataTable/topWD",
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
  dataTopWD: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    let getData = (
      await helpers.doQuery(
        db,
        `SELECT CurrentPlacement, Username, Withdraw FROM top_withdraw 
        WHERE Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') 
        AND LAST_DAY(CURRENT_DATE()) 
        AND WebsiteID = ?
        ORDER BY CurrentPlacement, Username ASC`,
        [process.env.websiteID]
      )
    ).results;
    return res.json({
      data: getData,
    });
  },
  getDataTopCasino: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    res.render(
      "uploads/dataTable/topCasino",
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
  dataTopCasino: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/");
    }
    let getData = (
      await helpers.doQuery(
        db,
        `SELECT CurrentPlacement, Username, Turnover FROM top_gamer 
        WHERE Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') 
        AND LAST_DAY(CURRENT_DATE()) 
        AND Game_Category = ? 
        AND WebsiteID = ?
        AND Turnover > 0
        ORDER BY CurrentPlacement, Username ASC`,
        ["Casino", process.env.websiteID]
      )
    ).results;
    return res.json({
      data: getData,
    });
  },
  dataTop200: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/login");
    }

    let table = ["top_gamer", "top_withdraw", "top_league"];
    let workbook = xlsx.utils.book_new();
    let Loyalties = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
    for (const el of table) {
      if (el == "top_gamer") {
        const topSlot = await helpers.doQuery(
          db,
          `SELECT A.CurrentPlacement, A.Username, A.Turnover, A.Game_Category, COALESCE(B.Phone,'') AS Phone 
           FROM top_gamer A 
           LEFT JOIN user B ON A.Username = B.Username 
           WHERE A.Game_Category = ? 
           AND Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') 
           AND LAST_DAY(CURRENT_DATE()) 
           AND A.WebsiteID = ?
           AND A.Turnover > 0
           ORDER BY A.CurrentPlacement ASC LIMIT 200`,
          ["Slot", process.env.websiteID]
        );

        const topCasino = await helpers.doQuery(
          db,
          `SELECT A.CurrentPlacement, A.Username, A.Turnover, A.Game_Category, COALESCE(B.Phone,'') AS Phone 
           FROM top_gamer A 
           LEFT JOIN user B ON A.Username = B.Username 
           WHERE A.Game_Category = ? 
           AND Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') 
           AND LAST_DAY(CURRENT_DATE()) 
           AND A.WebsiteID = ?
           AND A.Turnover > 0
           ORDER BY A.CurrentPlacement ASC LIMIT 200`,
          ["Casino", process.env.websiteID]
        );

        const slotData =
          topSlot.results.length > 0
            ? topSlot.results.map((row) => ({
                Placement: row.CurrentPlacement,
                Username: row.Username,
                Turnover: row.Turnover,
                Phone: row.Phone,
              }))
            : [
                {
                  Placement: null,
                  Username: null,
                  Turnover: null,
                  Phone: null,
                },
              ];

        const casinoData =
          topCasino.results.length > 0
            ? topCasino.results.map((row) => ({
                Placement: row.CurrentPlacement,
                Username: row.Username,
                Turnover: row.Turnover,
                Phone: row.Phone,
              }))
            : [
                {
                  Placement: null,
                  Username: null,
                  Turnover: null,
                  Phone: null,
                },
              ];

        const slotSheet = xlsx.utils.json_to_sheet(slotData);
        const casinoSheet = xlsx.utils.json_to_sheet(casinoData);

        xlsx.utils.book_append_sheet(workbook, slotSheet, "Top Slot");
        xlsx.utils.book_append_sheet(workbook, casinoSheet, "Top Casino");
      }

      if (el == "top_withdraw") {
        const topWD = await helpers.doQuery(
          db,
          `SELECT A.CurrentPlacement, A.Username, A.Withdraw, COALESCE(B.Phone,'') AS Phone 
           FROM top_withdraw A 
           LEFT JOIN user B ON A.Username = B.Username 
           WHERE Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
            AND LAST_DAY(CURRENT_DATE()) 
            AND A.WebsiteID = ?
           ORDER BY A.CurrentPlacement ASC LIMIT 200 `,
          [process.env.websiteID]
        );

        const wdData =
          topWD.results.length > 0
            ? topWD.results.map((row) => ({
                Placement: row.CurrentPlacement,
                Username: row.Username,
                Withdraw: row.Withdraw,
                Phone: row.Phone,
              }))
            : [
                {
                  Placement: null,
                  Username: null,
                  Withdraw: null,
                  Phone: null,
                },
              ];

        const wdSheet = xlsx.utils.json_to_sheet(wdData);
        xlsx.utils.book_append_sheet(workbook, wdSheet, "Top WD");
      }
      if (el == "top_league") {
        for (const Loyalty of Loyalties) {
          try {
            const topWager = await helpers.doQuery(
              db,
              `SELECT A.CurrentPlacement, A.Username, A.Turnover, COALESCE(B.Phone,'') AS Phone 
               FROM top_league A 
               LEFT JOIN user B ON A.Username = B.Username 
               WHERE Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') 
               AND LAST_DAY(CURRENT_DATE())
               AND A.Loyalty = ?
               AND A.WebsiteID = ?
               AND A.Turnover > 0
               ORDER BY A.CurrentPlacement ASC LIMIT 200`,
              [Loyalty, process.env.websiteID]
            );

            const wagerData =
              topWager.results.length > 0
                ? topWager.results.map((row) => ({
                    Placement: row.CurrentPlacement,
                    Username: row.Username,
                    Turnover: row.Turnover,
                    Phone: row.Phone,
                  }))
                : [
                    {
                      Placement: null,
                      Username: null,
                      Turnover: null,
                      Phone: null,
                    },
                  ];

            const wagerSheet = xlsx.utils.json_to_sheet(wagerData);
            xlsx.utils.book_append_sheet(
              workbook,
              wagerSheet,
              `Top Wager ${Loyalty}`
            );
          } catch (error) {
            console.error(`Error processing Loyalty: ${Loyalty}`, error);
          }
        }
      }
    }

    const now = new Date();
    const tanggal = String(now.getDate()).padStart(2, "0");
    const bulan = String(now.getMonth() + 1).padStart(2, "0");
    const tahun = now.getFullYear();
    const fileName = `Data Top 200 ${tanggal}-${bulan}-${tahun}.xlsx`;
    const filePath = path.join(__dirname, fileName);
    xlsx.writeFile(workbook, filePath);
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error generating file.");
      }
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error("Error deleting the file:", unlinkErr);
        }
      });
    });
  },
  templateUpload: async function (req, res) {
    if (!req.session.ID) {
      return res.redirect("/login");
    }
    const workbook = xlsx.utils.book_new();

    const top50Data = [
      {
        Player: "Player1",
        Loyalty: "Gold",
        Turnover: 1000,
        "Fake Account": "n",
      },
      {
        Player: "Player2",
        Loyalty: "Silver",
        Turnover: 800,
        "Fake Account": "n",
      },
    ];

    const gameData = [
      { Player: "Player1", Slot: 500, Casino: 500, "Fake Account": "n" },
      { Player: "Player2", Slot: 300, Casino: 500, "Fake Account": "n" },
    ];

    const top50Sheet = xlsx.utils.json_to_sheet(top50Data);
    const gameSheet = xlsx.utils.json_to_sheet(gameData);

    xlsx.utils.book_append_sheet(workbook, top50Sheet, "Top 50");
    xlsx.utils.book_append_sheet(workbook, gameSheet, "Game");
    const now = new Date();
    const tanggal = String(now.getDate()).padStart(2, "0");
    const bulan = String(now.getMonth() + 1).padStart(2, "0");
    const tahun = now.getFullYear();
    const fileName = `Template Upload ${tanggal}-${bulan}-${tahun}.xlsx`;
    const filePath = path.join(__dirname, fileName);
    xlsx.writeFile(workbook, filePath);

    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Error generating file.");
      }
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error("Error deleting the file:", unlinkErr);
        }
      });
    });
  },
};
