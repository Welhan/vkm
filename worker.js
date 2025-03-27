const { parentPort, workerData } = require("worker_threads");
const dotenv = require("dotenv");
const path = require("path");
const reader = require("xlsx");
const axios = require("axios");
dotenv.config();

const helpers = require("../../helpers/helpers");
const { db } = require("../../configs/db");
const loyalty = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"];
const games = ["Slot", "Casino"];

async function sheetTopGamer(sheetData) {}

async function main() {
  try {
    const file = workerData.file;
    const insertId = workerData.insertId;
    let bracketUrl = (
      await helpers.doQuery(
        db,
        `SELECT * FROM config WHERE WebsiteID = '${process.env.websiteID}' AND Config ='Bracket URL' `
      )
    ).results[0].Value;
    let sheetData = reader.utils.sheet_to_json(file.SheetNames[0]);
    parentPort.postMessage(sheetData);
    for (let [index, el] of sheetData.entries()) {
      console.log(el.Player, typeof el.Player);
      if (!el.Player) {
        errMsg.push({
          row: index + 2,
          message: "Terdapat Kolom Player yang Kosong",
        });
      } else {
        await new Promise(async (resolve, reject) => {
          let dateNow = helpers.formatDate(new Date());
          let token = `W${process.env.websiteID}|${el.Player}|${el.Loyalty}|${dateNow}`;
          token = Buffer.from(token).toString("base64");
          await axios
            .post(
              bracketUrl + "player-api",
              {},
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              }
            )
            .then(async (response) => {
              if (
                response.data.player == true &&
                response.data.status == true
              ) {
                // cek level up
                const loyaltyLowerCase = loyalty.map((level) =>
                  level.toLowerCase()
                );
                let sqlLevelUp = `SELECT * FROM user WHERE Username = '${el.Player}'`;
                let checkLevel = (await helpers.doQuery(db, sqlLevelUp))
                  .results;
                if (checkLevel.length > 0) {
                  if (checkLevel[0].Loyalty !== "") {
                    let curIndex = loyaltyLowerCase.indexOf(
                      checkLevel[0].Loyalty.toLowerCase()
                    );
                    let levelIndex = loyaltyLowerCase.indexOf(
                      el.Loyalty.toLowerCase()
                    );
                    bonus = 0;

                    if (levelIndex > curIndex) {
                      let indexHadiah = curIndex + 1;
                      let selisih = levelIndex - curIndex;
                      for (let i = 0; i < selisih; i++) {
                        let prizeSql = `SELECT Bonus FROM loyalty_bonus WHERE Tier = '${loyalty[indexHadiah]}'`;
                        let prize = (await helpers.doQuery(db, prizeSql))
                          .results;
                        if (prize[0]) {
                          bonus += prize[0]["Bonus"];
                        }
                        indexHadiah++;
                      }
                      // insert db levelUp history
                      db.query(
                        `INSERT INTO levelup_history (WebsiteID, Username, CurrentLevel, LevelUpTo, Prize, CDate) VALUES ('${process.env.websiteID}','${el.Player}','${loyalty[curIndex]}','${loyalty[levelIndex]}', '${bonus}', NOW())`,
                        function (err) {
                          if (err) {
                            console.error(err);
                          }
                          // update user loyalty
                          db.query(
                            `UPDATE user SET Loyalty = '${loyalty[levelIndex]}', LevelUpDate = NOW() WHERE Username = '${el.Player}'`,
                            function (err) {
                              if (err) {
                                console.error(err);
                              }
                            }
                          );
                        }
                      );
                    }
                  }
                }

                // cek player di top_league, ada update, ga ada insert
                cekLeague = `SELECT * FROM top_league WHERE Username = '${el.Player}' AND Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND LAST_DAY(CURRENT_DATE())`;
                let resultLeague = (await helpers.doQuery(db, cekLeague))
                  .results;
                // cek league
                const today = new Date();
                let curLeague =
                  resultLeague.length > 0
                    ? resultLeague[0].Loyalty
                    : el.Loyalty;
                let lastLeague = "";
                if (today.getDate() === 1 && resultLeague.length > 0) {
                  lastLeague = curLeague;
                  curLeague = el.Loyalty;
                }
                if (resultLeague.length > 0) {
                  db.query(
                    `UPDATE top_league set FileID = '${insertId}', Loyalty = '${el.Loyalty}', League = '${curLeague}', Last_league = '${lastLeague}', Turnover = ${el.Turnover}, Last_Date = NOW() WHERE ID = '${resultLeague[0].ID}'`,
                    function (err, result) {
                      if (err) {
                        console.log(err);
                        reject(err);
                      } else {
                        resolve(result);
                      }
                    }
                  );
                } else {
                  db.query(
                    `INSERT INTO top_league (FileID, Date, WebsiteID, Loyalty, League, Last_League, Username, FakeAcc, Turnover,CDate) VALUE (${insertId},NOW(),'${
                      process.env.websiteID
                    }','${el.Loyalty}','${el.Loyalty}','','${el.Player}', ${
                      el["Fake Account"].toLowerCase() == "n" ? 0 : 1
                    }, ${el.Turnover}, NOW())`,
                    function (err, result) {
                      if (err) {
                        console.log(err);
                        reject(err);
                      } else {
                        resolve(result);
                      }
                    }
                  );
                }
              } else {
                console.log(false);
              }
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        });
      }
    }
    sheetData = reader.utils.sheet_to_json(file.SheetNames[1]);
    parentPort.postMessage(sheetData);
    for (let [index, el] of sheetData.entries()) {
      if (!el.Player) {
        errMsg.push({
          row: index + 2,
          message: "Terdapat Kolom Player yang Kosong",
        });
      } else {
        await new Promise(async (resolve, reject) => {
          let dateNow = helpers.formatDate(new Date());
          let token = `W${process.env.websiteID}|${el.Player}||${dateNow}`;
          token = Buffer.from(token).toString("base64");
          await axios
            .post(
              bracketUrl + "player-api",
              {},
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              }
            )
            .then(async (response) => {
              if (
                response.data.player == true &&
                response.data.status == true
              ) {
                // cek db top_gamer dlu
                await Promise.all(
                  games.map(async (game) => {
                    cekGame = `SELECT * FROM top_gamer WHERE Username = '${el.Player}' AND Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND LAST_DAY(CURRENT_DATE()) AND Game_Category = '${game}'`;
                    let resultGame = (await helpers.doQuery(db, cekGame))
                      .results;
                    to = 0;
                    if (game == "Slot") {
                      to = el.Slot > 0 ? el.Slot : 0;
                    } else if (game == "Casino") {
                      to = el.Casino > 0 ? el.Casino : 0;
                    }
                    if (resultGame.length > 0) {
                      db.query(
                        `UPDATE top_gamer SET FileID = ${insertId}, Turnover = ${to} WHERE Username = '${el.Player}' AND Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND LAST_DAY(CURRENT_DATE()) AND Game_Category = '${game}'`,
                        function (err) {
                          if (err) {
                            console.error(err);
                          }
                        }
                      );
                    } else {
                      db.query(
                        `INSERT INTO top_gamer (FileID, Date, WebsiteID, Game_Category, Username, FakeAcc, Turnover, CDate) VALUE (${insertId},NOW(),${
                          process.env.websiteID
                        },'${game}','${el.Player}',${
                          el["Fake Account"].toLowerCase() == "n" ? 0 : 1
                        },${to},NOW())`,
                        function (err) {
                          if (err) {
                            console.error(err);
                          }
                        }
                      );
                    }
                  })
                );
              } else {
                console.log(false);
              }
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
        });
      }
    }
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
}
main();
