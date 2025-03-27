const { resolve } = require("path");
const { db } = require("../configs/db.js");
const axios = require("axios");
const { constants } = require("../configs/constants");
const moment = require("moment");
const os = require("os");
const fs = require("fs");

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  doQuery: async function (conn, sql, args) {
    return new Promise((resolve, reject) => {
      conn.query(sql, args, (error, results, fields) => {
        if (error) {
          reject(error);
        } else {
          resolve({ results, fields });
        }
      });
    });
  },
  formatDate: async function (date, dateTime = true, delimiter = true) {
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
  },
  syncMenu: async function () {
    return await this.generateMenu();
  },
  syncSubmenu: async function (menuid) {
    return await this.generateSubmenu(menuid);
  },
  generateMenu: async function (username = "") {
    let query = `SELECT * FROM mst_menu WHERE Active = 1`;

    if (username) {
      query = `SELECT DISTINCT A.ID, A.Menu, A.Icon
        FROM mst_menu A
        LEFT JOIN mst_submenu B ON B.MenuID = A.ID
        RIGHT JOIN user_access_menu C ON A.ID = C.MenuID
        WHERE A.Active = 1 AND C.Username = '${username}' AND C.View = 1`;
    }
    return (await this.doQuery(db, query)).results;
  },
  generateSubmenu: async function (menuid, username = "") {
    let query = `SELECT * FROM mst_submenu WHERE MenuID = ${menuid}`;

    if (username) {
      query = `SELECT A.ID, A.Submenu, A.Url, B.SubmenuID FROM mst_submenu A
        RIGHT JOIN user_access_menu B ON A.ID = B.SubmenuID
        RIGHT JOIN mst_menu C on B.MenuID = C.ID
        WHERE A.MenuID = '${menuid}' AND B.Username = '${username}' AND C.Active = 1 AND B.View = 1 ORDER BY C.ID ASC;`;
    }
    return (await this.doQuery(db, query)).results;
  },
  getData: async function (url, data) {
    try {
      const response = await axios.post(url, data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  newData: async function (table, obj) {
    let keys = Object.keys(obj);
    let values = Object.values(obj);
    const formattedValues = values.map((value) =>
      typeof value === "string" ? `'${value}'` : value
    );

    let sql = `INSERT INTO ${table} (${keys.join(
      ","
    )}) VALUES (${formattedValues.join(",")})`;
    db.query(sql, (err, hasil) => {
      if (err) return err;
    });
    return true;
  },
  updateData: async function (table, obj, where) {
    let updateString = Object.entries(obj)
      .map(([key, value]) => `${key} = '${value}'`)
      .join(", ");
    let conditions = Object.entries(where)
      .map(([key, value]) => `${key} = '${value}'`)
      .join(" AND ");

    let sql = `UPDATE ${table} SET ${updateString} WHERE 1 = 1 AND ${conditions}`;
    db.query(sql, (err) => {
      if (err) {
        console.log(err);
        return err;
      }
      return { status: true };
    });
  },
  log_update: async function (status, log, UserID) {
    let formattedDate = moment().utcOffset("+0700").format("DD-MM-YYYY");
    let formattedTime = moment().utcOffset("+0700").format("HH:mm:ss");
    let filePath =
      status == "success" ? constants.transactionPath : constants.errorPath;
    let path =
      status == "success"
        ? "logs/transactions/Transaction"
        : "logs/errors/Error";
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath, (err) => {
        if (err) {
          return console.log(err);
        }
      });
    }
    if (!fs.existsSync(`${path} - ${formattedDate}.txt`)) {
      if (UserID) {
        fs.appendFileSync(
          `${path} - ${formattedDate}.txt`,
          `[${formattedTime}] ${log} 'UserID = ${UserID} '${os.EOL}`,
          "utf-8",
          (err) => {
            if (err) {
              console.error(err);
            }
          }
        );
      } else {
        fs.appendFileSync(
          `${path} - ${formattedDate}.txt`,
          `[${formattedTime}] ${log} ${os.EOL}`,
          "utf-8",
          (err) => {
            if (err) {
              console.error(err);
            }
          }
        );
      }
    } else {
      if (UserID) {
        fs.appendFileSync(
          `${path} - ${formattedDate}.txt`,
          `[${formattedTime}] ${log} 'UserID = ${UserID} '${os.EOL}`,
          "utf-8",
          (err) => {
            if (err) {
              console.error(err);
            }
          }
        );
      } else {
        fs.appendFileSync(
          `${path} - ${formattedDate}.txt`,
          `[${formattedTime}] ${log} ${os.EOL}`,
          "utf-8",
          (err) => {
            if (err) {
              console.error(err);
            }
          }
        );
      }
    }
  },
  generateTransactionID: async function (category, loyalty = "", type = "") {
    let currentMonth = new Date().getMonth() + 1;
    let currentYear = new Date().getFullYear();
    let formattedMonth = currentMonth.toString().padStart(2, "0");
    let formattedYear = currentYear.toString();
    let loyaltyCodes = {
      Bronze: "BRZ",
      Silver: "SLV",
      Gold: "GLD",
      Platinum: "PLT",
      Diamond: "DMD",
    };
    let categoryCodes = {
      Top50: "TOP",
      TopSlot: "TOP-SLT",
      TopCasino: "TOP-CSN",
      TopWD: "TOP-WDR",
      WeeklyQuest: "WEK-QST",
      LevelUp: "LVL",
      Luckyspin: "LSP",
      Redeem: "RDM",
      Custom: "CTM-CRM",
      DailyLogin: "DLY-LOG",
      Gacha: "GCH",
      Reload: "RLD",
      WDCoin: "WTD-COI",
    };
    let postfixCode;
    if (category == "Luckyspin") {
      if (type == "Nominal") {
        postfixCode = "00";
      } else if (type == "Barang") {
        postfixCode = "01";
      }
    } else {
      postfixCode = "00";
    }
    let prefixCode =
      category === "TopSlot" ||
      category === "TopCasino" ||
      category === "TopWD" ||
      category === "WeeklyQuest" ||
      category === "Custom" ||
      category === "DailyLogin" ||
      category === "WDCoin"
        ? `${categoryCodes[category]}`
        : `${categoryCodes[category]}-${loyaltyCodes[loyalty]}`;
    let config = "";
    if (loyalty != "") {
      config = category + loyalty;
    } else {
      config = category;
    }
    let number = randomInt(100000, 999999);
    let newTransactionID = `${formattedMonth}-${formattedYear}-${prefixCode}-${postfixCode}-${number}`;
    let checkTransactionID = `SELECT * FROM transaction_history WHERE TransactionID = ?`;
    let checkResult = (
      await this.doQuery(db, checkTransactionID, [newTransactionID])
    ).results;
    while (checkResult.length > 0) {
      number = randomInt(100000, 999999);
      newTransactionID = `${formattedMonth}-${formattedYear}-${prefixCode}-${postfixCode}-${number}`;
      checkResult = (
        await this.doQuery(db, checkTransactionID, [newTransactionID])
      ).results;
    }
    return newTransactionID;
  },
  formatToIndonesianNumber: function (number) {
    const units = [
      { value: 1e9, label: "miliar" },
      { value: 1e6, label: "juta" },
      { value: 1e3, label: "ribu" },
    ];

    for (const unit of units) {
      if (number >= unit.value) {
        const formattedNumber = (number / unit.value).toLocaleString("id-ID", {
          maximumFractionDigits: 2,
        });
        return `${formattedNumber} ${unit.label}`;
      }
    }

    return number.toLocaleString("id-ID");
  },
  reverseIndonesianNumber: function (formattedString) {
    const units = {
      miliar: 1e9,
      juta: 1e6,
      ribu: 1e3,
    };

    const parts = formattedString.split(" ");

    if (parts.length === 1) {
      return parts[0];
    }

    const [numberString, unitLabel] = parts;
    const multiplier = units[unitLabel.toLowerCase()];

    if (!multiplier) {
      throw new Error(
        "Label satuan tidak dikenal. Gunakan 'ribu', 'juta', atau 'miliar'."
      );
    }

    const numericValue = parseFloat(numberString.replace(",", "."));
    return numericValue * multiplier;
  },
  getURLBracket: async function () {
    let BracketURL = (
      await this.doQuery(
        db,
        `SELECT Value FROM config WHERE Config = 'Bracket URL'`
      )
    ).results;
    if (BracketURL.length > 0) {
      if (BracketURL[0].Value != "") {
        return BracketURL[0].Value;
      } else {
        return false;
      }
    } else {
      return false;
    }
  },
  escapeHtml: function (text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, function (m) {
      return map[m];
    });
  },
  getConfigNotification: async function (config) {
    let notification = (
      await this.doQuery(
        db,
        `SELECT Header, Detail, Footer FROM copywriting WHERE Config = '${config}'`
      )
    ).results;
    if (notification.length > 0) {
      let data = {
        Header: notification[0].Header,
        Detail: notification[0].Detail,
        Footer: notification[0].Footer,
      };
      return data;
    } else {
      return false;
    }
  },
  checkUserAccess: async function (username, menuID, submenuID) {
    let query = `SELECT A.* FROM user_access_menu A LEFT JOIN mst_menu B ON A.MenuID = B.ID 
    WHERE A.Username = '${username}' 
    AND A.MenuID = ${menuID} 
    AND A.SubmenuID = ${submenuID} 
    AND A.View = 1 
    AND (B.ID IS NULL OR B.Active = 1)`;
    let result = (await this.doQuery(db, query)).results;
    if (result.length > 0) {
      // return true;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(true);
        }, 100);
      });
    } else {
      // return false;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(false);
        }, 100);
      });
    }
  },
};
