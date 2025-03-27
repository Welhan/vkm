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

async function sheetTop50(sheetData, insertId, bracketUrl, FileID) {
  return new Promise(async (resolve) => {
    parentPort.postMessage({
      message: `Processing Top 50 started`,
    });
    for (let [index, el] of sheetData.entries()) {
      if (!el.Player) {
        parentPort.postMessage({
          row: index + 2,
          message: "Terdapat Kolom Player yang Kosong",
        });
      } else {
        await new Promise(async (rslv, reject) => {
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
                let sqlLevelUp = `SELECT * FROM user WHERE Username = ?`;
                let checkLevel = (
                  await helpers.doQuery(db, sqlLevelUp, [el.Player])
                ).results;
                if (checkLevel.length > 0) {
                  if (
                    checkLevel[0].Loyalty !== "" &&
                    checkLevel[0].Loyalty !== null &&
                    checkLevel[0].Loyalty !== undefined
                  ) {
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
                        let prizeSql = `SELECT Bonus FROM loyalty_bonus WHERE Tier = ?`;
                        let prize = (
                          await helpers.doQuery(db, prizeSql, [
                            loyalty[indexHadiah],
                          ])
                        ).results;
                        if (prize[0]) {
                          bonus += prize[0]["Bonus"];
                        }
                        indexHadiah++;
                      }
                      // insert db levelUp history
                      db.query(
                        `INSERT INTO levelup_history (WebsiteID, Username, CurrentLevel, LevelUpTo, Prize, CDate) VALUES (?,?,?,?,?, NOW())`,
                        [
                          process.env.websiteID,
                          el.Player,
                          loyalty[curIndex],
                          loyalty[levelIndex],
                          bonus,
                        ],
                        function (err) {
                          if (err) {
                            console.error(err);
                          }
                          // update user loyalty
                          db.query(
                            `UPDATE user SET Loyalty = ?, LevelUpDate = NOW() WHERE Username = ?`,
                            [loyalty[levelIndex], el.Player],
                            function (err) {
                              if (err) {
                                console.error(err);
                              }
                            }
                          );
                        }
                      );
                    }
                  } else {
                    db.query(
                      `UPDATE user SET Loyalty = ?, LevelUpDate = NOW() WHERE Username = ?`,
                      [el.Loyalty, el.Player],
                      function (err) {
                        if (err) {
                          console.error(err);
                        }
                      }
                    );
                  }
                }

                // cek player di top_league, ada update, ga ada insert
                cekLeague = `SELECT * FROM top_league WHERE Username = ? AND Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND LAST_DAY(CURRENT_DATE())`;
                let resultLeague = (
                  await helpers.doQuery(db, cekLeague, [el.Player])
                ).results;
                // cek league
                const today = new Date();
                let curLeague = el.Loyalty;
                let lastLeague =
                  resultLeague.length > 0 ? resultLeague[0].Loyalty : "";
                if (today.getDate() !== 1) {
                  curLeague =
                    resultLeague.length > 0
                      ? resultLeague[0].League
                      : el.Loyalty;
                }

                if (resultLeague.length > 0) {
                  db.query(
                    `UPDATE top_league set FileID = ?, Loyalty = ?, League = ?, Last_league = ?, Turnover = ?, Last_Date = NOW() WHERE ID = ?`,
                    [
                      insertId,
                      el.Loyalty,
                      curLeague,
                      lastLeague,
                      el.Turnover,
                      resultLeague[0].ID,
                    ],
                    function (err, result) {
                      if (err) {
                        console.log(err);
                        helpers.log_update(
                          "error",
                          `Player ${el.Player} not updated in top_league`
                        );
                        reject(err);
                      } else {
                        helpers.log_update(
                          "success",
                          `Player ${el.Player} updated in top_league`
                        );
                        rslv(result);
                      }
                    }
                  );
                } else {
                  db.query(
                    `INSERT INTO top_league (FileID, Date, WebsiteID, Loyalty, League, Last_League, Username, FakeAcc, Turnover,CDate) VALUE (?,NOW(),?,?,?,'',?,?,?, NOW())`,
                    [
                      insertId,
                      process.env.websiteID,
                      el.Loyalty,
                      el.Loyalty,
                      el.Player,
                      el["Fake Account"].toLowerCase() == "n" ? 0 : 1,
                      el.Turnover,
                    ],
                    function (err, result) {
                      if (err) {
                        console.log(err);
                        helpers.log_update(
                          "error",
                          `Player ${el.Player} not updated in top_league`
                        );
                        reject(err);
                      } else {
                        helpers.log_update(
                          "success",
                          `Player ${el.Player} updated in top_league`
                        );
                        rslv(result);
                      }
                    }
                  );
                }
              } else {
                db.query(
                  `SELECT TotalNotFound FROM files WHERE ID = ${FileID}`,
                  function (err, resultQuery) {
                    if (err) {
                      console.log(err);
                    }
                    let TotalNotFound =
                      resultQuery[0].TotalNotFound != 0
                        ? resultQuery[0].TotalNotFound
                        : 0;
                    TotalNotFound = TotalNotFound + 1;

                    db.query(
                      `UPDATE files SET TotalNotFound = ${TotalNotFound} WHERE ID = ${FileID}`,
                      function (err) {
                        if (err) {
                          console.log(err);
                        }
                        helpers.log_update(
                          "error",
                          `Player ${el.Player} not found in top_league di row ${
                            index + 2
                          }`
                        );
                        parentPort.postMessage({
                          row: index + 2,
                          player: el.Player,
                          message: `Baris ${
                            index + 2
                          } Player not found in the system`,
                        });
                        rslv();
                      }
                    );
                  }
                );
              }
            })
            .catch((err) => {
              console.log(`error : ${err}`);
              reject(err);
            });
        });
      }
    }
    parentPort.postMessage({ message: `Processing Top 50 completed` });
    resolve();
  });
}
async function sheetGame(sheetData, insertId, bracketUrl, FileID) {
  return new Promise(async (resolve) => {
    parentPort.postMessage({
      message: `Processing Game started`,
    });
    for (let [index, el] of sheetData.entries()) {
      if (!el.Player) {
        parentPort.postMessage({
          row: index + 2,
          message: "Terdapat Kolom Player yang Kosong",
        });
      } else {
        await new Promise(async (rslv, reject) => {
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
                    cekGame = `SELECT * FROM top_gamer WHERE Username = ? AND Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND LAST_DAY(CURRENT_DATE()) AND Game_Category = ?`;
                    let resultGame = (
                      await helpers.doQuery(db, cekGame, [el.Player, game])
                    ).results;
                    to = 0;
                    if (game == "Slot") {
                      to = el.Slot > 0 ? el.Slot : 0;
                    } else if (game == "Casino") {
                      to = el.Casino > 0 ? el.Casino : 0;
                    }
                    if (resultGame.length > 0) {
                      db.query(
                        `UPDATE top_gamer SET FileID = ?, Turnover = ? WHERE Username = ? AND Date BETWEEN DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01') AND LAST_DAY(CURRENT_DATE()) AND Game_Category = ?`,
                        [insertId, to, el.Player, game],
                        function (err) {
                          if (err) {
                            helpers.log_update(
                              "error",
                              `Player ${el.Player} not updated in top_game`
                            );
                            console.error(err);
                          }

                          rslv();
                        }
                      );
                    } else {
                      db.query(
                        `INSERT INTO top_gamer (FileID, Date, WebsiteID, Game_Category, Username, FakeAcc, Turnover, CDate) VALUE (?,NOW(),?,?,?,?,?,NOW())`,
                        [
                          insertId,
                          process.env.websiteID,
                          game,
                          el.Player,
                          el["Fake Account"].toLowerCase() == "n" ? 0 : 1,
                          to,
                        ],
                        function (err) {
                          if (err) {
                            console.error(err);
                            helpers.log_update(
                              "error",
                              `Player ${el.Player} not updated in top_game`
                            );
                            reject(err);
                          }
                          rslv();
                        }
                      );
                    }
                  })
                );
                helpers.log_update(
                  "success",
                  `Player ${el.Player} updated in top_gamer`
                );
              } else {
                let TotalNotFound = 0;
                let getTotalNotFound = (
                  await helpers.doQuery(
                    db,
                    `SELECT TotalNotFound FROM files WHERE ID = ${FileID}`
                  )
                ).results;
                if (getTotalNotFound.length == 0) {
                  TotalNotFound = 2;
                } else {
                  TotalNotFound = getTotalNotFound[0].TotalNotFound + 2;
                }
                db.query(
                  `UPDATE files SET TotalNotFound = ${TotalNotFound} WHERE ID = ${FileID}`,
                  function (err) {
                    if (err) {
                      console.log(err);
                    }
                    helpers.log_update(
                      "error",
                      `Player ${el.Player} not found in top_gamer`
                    );
                    parentPort.postMessage({
                      row: index + 2,
                      player: el.Player,
                      message: `Baris ${
                        index + 2
                      } Player not found in the system`,
                    });
                    rslv();
                  }
                );
              }
            })
            .catch((err) => {
              console.log(err);
              reject(err);
            });
          rslv();
        });
      }
    }
    parentPort.postMessage({ message: `Processing Game completed` });
    resolve();
  });
}

async function main() {
  try {
    const file = workerData.file;
    const insertId = workerData.insertId;
    const FileID = workerData.FileID;
    let bracketUrl = (
      await helpers.doQuery(
        db,
        `SELECT * FROM config WHERE WebsiteID = ? AND Config ='Bracket URL'`,
        [process.env.websiteID]
      )
    ).results[0].Value;
    let sheetData = reader.utils.sheet_to_json(file.Sheets["Top 50"]);
    await sheetTop50(sheetData, insertId, bracketUrl.toString(), FileID);
    let sheetData2 = reader.utils.sheet_to_json(file.Sheets["Game"]);
    await sheetGame(sheetData2, insertId, bracketUrl.toString(), FileID);
    parentPort.postMessage({ message: "All sheets processed successfully" });
  } catch (err) {
    parentPort.postMessage({ error: err.message });
  }
}
main();
