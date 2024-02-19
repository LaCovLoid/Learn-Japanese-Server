"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _promise = require('mysql2/promise');

var _cors = require('cors'); var _cors2 = _interopRequireDefault(_cors);

var _dotenv = require('dotenv'); var _dotenv2 = _interopRequireDefault(_dotenv);

const app = _express2.default.call(void 0, );
const port = 3000;
let connection;

_dotenv2.default.config();
connectServer();

app.use(_cors2.default.call(void 0, ));
app.use(_express.json.call(void 0, ));
app.use(_express.urlencoded.call(void 0, { extended: true }));

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});

async function connectServer() {
    connection = await _promise.createConnection.call(void 0, {
        host: process.env.DB_HOST, // 'localhost',
        port: 3306,
        user: "root",
        password: "root",
        database: "japanese_db"
    });
    console.log("connection successful?", connection != null);
}


/* //단어 db 정제를 위한 임시 코드

import fs from 'node:fs';

app.get('/japanese', sortHandler);
async function sortHandler(req: any, res: any) {
    if (connection == null) return;
    
    fs.readFile('./src/jp_word.txt', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        const lines = data.split('\r\n');
        let text = "";
        let secondText:string[] = [];
        let lineCount = 0;
        for (let i in lines) {
            lines[i] = lines[i].trim();
            if (lines[i].includes("^")){
                secondText.push(lines[i].split("^")[1]);
                lines[i] = lines[i].split("^")[0];
            }
            text += lines[i]+"\r\n";
        }

        text = text + "\r\n";
        for (let i in secondText) {
            text += secondText[i] +'\r\n';

            lineCount++;
            if (lineCount == 3) {
                text += '\r\n';
                lineCount = 0;
            }
        }
        fs.writeFileSync('./src/jp_word2.txt', text);
        res.send ({file:text});
        return;
    });

}
*/

var _nodefs = require('node:fs'); var _nodefs2 = _interopRequireDefault(_nodefs);
app.get('/japanese', insertSqlHandler);
async function insertSqlHandler(req, res) {
    if (connection == null) return;
    
    _nodefs2.default.readFile('./src/words.txt', 'utf8', async (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        const lines = data.split('\r\n\r\n');

        let word = "";
        let mean = "";
        let yomigana = "";
        let example_word = "";
        let example_mean = "";
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('[')){
                const firstLine = lines[i].split('\r\n')[0];
                example_word += lines[i].split('\r\n')[1];
                example_mean += lines[i].split('\r\n')[2];

                word += firstLine.split(' ')[0];
                for (let j = 2; j < firstLine.split(' ').length; j++){
                    mean += firstLine.split(' ')[j]+' ';
                }
                mean = mean.trim();
                yomigana += String(firstLine.split(' ')[1]).replace('\[','').replace('\]','');

            } else {

            }
            //await connection.query("INSERT INTO `words`(`word`, `mean`,`yomigana`,`word_yomi_same`,`example_word`,`example_mean`) VALUES (?,?,?,?,?,?)", [,,,,,]);
        }

        for (let i in lines) {
            if(!lines[i].includes("[")){
            }
        }

        //await connection.query("INSERT INTO `words`(`number`, `title`,`singer`,`writer`,`maker`) VALUES (?,?,?,?,?)", [,]);
        res.send ({word:word , mean:mean, yomigana:yomigana});
        return;
    });

}

function katakanaToHiragana(katakana) {
    // 가타카나와 히라가나의 유니코드 범위를 이용하여 변환
    return katakana.replace(/[\u30A1-\u30F6]/g, function(match) {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
    });
}


app.get('/test', testHandler);
async function testHandler(req, res) {
    if (connection == null) return;
    await connection.query("INSERT INTO `users`(`user_id`, `password`,`resolve`) VALUES (?,?,?)", ["ididid","pass123","12a/2c/14b/2b"]);
    res.send("test");
}