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
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
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
/*
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
        let yomi_word_same:boolean = false;
        let mean_locate:number = 0;

        for (let i = 0; i < lines.length; i++) {
            const firstLine = lines[i].split('\r\n')[0];
            example_word = lines[i].split('\r\n')[1];
            example_mean = lines[i].split('\r\n')[2];
            word = firstLine.split(' ')[0];

            if (lines[i].includes('[')){
                yomi_word_same = false;
                mean_locate = 2;
                yomigana = String(firstLine.split(' ')[1]).replace('\[','').replace('\]','');
            } else {
                yomi_word_same = true;
                mean_locate = 1;
                yomigana = word;
            }
            
            for (let j = mean_locate; j < firstLine.split(' ').length; j++){
                mean += firstLine.split(' ')[j]+' ';
            }

            yomigana = katakanaToHiragana(yomigana);
            mean = mean.trim();

            await connection.query("INSERT INTO `words`(`word`, `mean`,`yomigana`,`yomi_word_same`,`example_word`,`example_mean`) VALUES (?,?,?,?,?,?)", [word,mean,yomigana,yomi_word_same,example_word,example_mean]);
            mean = "";
        }
        res.send ("successed");
        return;
    });
}

function katakanaToHiragana(word:string) {                              //왜 반복되지? replace덕에 모든 값들 하나하나씩 반복됨
    return word.replace(/[\u30A1-\u30F6]/g, function(katakana) {        //ア부터 ン까지의 유니코드값을 정규식으로 찾아낸 후에 
    return String.fromCharCode(katakana.charCodeAt(0) - 0x60);          //히라가나와 가타카나의 유니코드 차만큼 값 뺌 /chatAt(n) n번째의글자갖고옴 /fromCharCode 유니코드를 문자로 반환
    });
}
*/

app.get('/test', testHandler);
async function testHandler(req: any, res: any) {
    if (connection == null) return;
    
    let [result] = await connection.query("SELECT * FROM `words` WHERE `yomi_word_same`='1'");
    let filtered = getList(result);
    res.send({wordList:filtered});
}

app.get('/random', randomHandler);
async function randomHandler(req: any, res: any) {
    if (connection == null) return;
    
    let [result] = await connection.query("SELECT * FROM `words` WHERE `yomi_word_same`='0' Order by rand() Limit 1");
    let filtered = getList(result);
    res.send({wordList:filtered});
}



function getList(data:any):any{
    let list:any[] = [];
    for(let i = 0; i < data.length; i++) {
        list.push ({
            id : data[i].id,
            word : data[i].word,
            mean : data[i].mean,
            yomigana : data[i].yomigana,
            example_word : data[i].example_word,
            example_mean : data[i].example_mean,
            yomi_word_same : data[i].yomi_word_same,
        });
    }
    return list;
}