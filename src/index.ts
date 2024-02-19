import express, { json, urlencoded } from 'express';
import { createConnection } from 'mysql2/promise';
import axios from 'axios';
import cors from 'cors';

import dotenv from "dotenv"

const app = express();
const port = 3000;
let connection: any;

dotenv.config();
connectServer();

app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});

async function connectServer() {
    connection = await createConnection({
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

import fs from 'node:fs';
app.get('/japanese', insertSqlHandler);
async function insertSqlHandler(req: any, res: any) {
    if (connection == null) return;
    
    fs.readFile('./src/words.txt', 'utf8', async (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        const lines = data.split('\r\n\r\n');

        let word:string = "";
        let mean:string = "";
        let yomigana:string = "";
        let example_word:string = "";
        let example_mean:string = "";
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
//히라>가타 변환법 발음중에 가타카나 있는거 있음
function katakanaToHiragana(katakana) {
    // 가타카나와 히라가나의 유니코드 범위를 이용하여 변환
    return katakana.replace(/[\u30A1-\u30F6]/g, function(match) {
    return String.fromCharCode(match.charCodeAt(0) - 0x60);
    });
}
//확인법 히라가나인지 가타카나인지 확인하고 위의 함수 사용
function isHiraganaOrKatakana(inputString) {
    // 정규식을 사용하여 가타카나 또는 히라가나 문자를 확인합니다.
    const hiraganaRegex = /[\u3040-\u309F]/; // 히라가나 범위
    const katakanaRegex = /[\u30A0-\u30FF]/; // 가타카나 범위

    if (hiraganaRegex.test(inputString)) {
        console.log('입력된 문자열은 히라가나입니다.');
    } else if (katakanaRegex.test(inputString)) {
        console.log('입력된 문자열은 가타카나입니다.');
    } else {
        console.log('히라가나 또는 가타카나가 아닙니다.');
    }
}

app.get('/test', testHandler);
async function testHandler(req: any, res: any) {
    if (connection == null) return;
    await connection.query("INSERT INTO `users`(`user_id`, `password`,`resolve`) VALUES (?,?,?)", ["ididid","pass123","12a/2c/14b/2b"]);
    res.send("test");
}