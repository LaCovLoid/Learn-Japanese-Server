"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _promise = require('mysql2/promise');
var _dotenv = require('dotenv'); var _dotenv2 = _interopRequireDefault(_dotenv);
var _crypto = require('crypto'); var _crypto2 = _interopRequireDefault(_crypto);

var _cors = require('cors'); var _cors2 = _interopRequireDefault(_cors);

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
async function testHandler(req, res) {
    if (connection == null) return;
    
    let [result] = await connection.query("SELECT * FROM `words` WHERE `yomi_word_same`='1'");
    res.send(getList(result));
}


app.get('/random', randomHandler);
async function randomHandler(req, res) {
    if (connection == null) return;
    
    let [result] = await connection.query("SELECT * FROM `words` WHERE `yomi_word_same`='0' Order by rand() Limit 1");
    res.send(getList(result));
}

app.get('/user_info', userInfoHandler);
async function userInfoHandler(req, res) {
    if (connection == null) return;
    
    let accessToken = req.headers["access-token"];
    let [tokenUserId] = await connection.query("SELECT `user_id` FROM `tokens` WHERE `token`=?", [accessToken]);

    if (tokenUserId.length == 0){
        res.status(400).send({reaseon:"token not found"});
        return;
    }

    let [userId] = await connection.query("SELECT `resolve`,`favorite` FROM `users` WHERE `id`=?", [tokenUserId[0].user_id]);
    if (userId.length == 0){
        res.status(404).send({reason:"user not found"});
        return;
    }

    let favorite = [];
    let result = [];
    let resolve = [];
    let text = "";

    if (userId[0].resolve != null){
        resolve = userId[0].resolve.split("/");
        for (let i = 0; i < resolve.length - 1; i++){
            text += "`id`='" + resolve[i] + "' OR ";
        }
        text += "`id`='" + resolve[resolve.length - 1] + "'";
    }
    if (userId[0].favorite != null){
        favorite = userId[0].favorite.split("/");
    }
    if (text !=""){
        result =  await connection.query("SELECT * FROM `words` WHERE "+text);
    }
    console.log([getList(result[0]),favorite]);
    res.send([getList(result[0]),favorite]);
}



//마이페이지이동 or 문제 제출때 토큰 시간 지나면 강제 로그아웃하게 하기
//토큰 갱신할때 처음거랑 하루 이상 차이날시 전부 삭제후 발급

//풀었던 문제 리스트 보낼 때 >> 토큰에서 유저인덱스 유니온 users 푼 문제 리스트
//그럼 푼 문제를 한번에 줄 게 아니라 나눠서 db에 저장해야하나? 
// 아냐, 한번에 받은 다음 탭할때마다 전송하는게 좋을거같아
//그럼 서버에서는... 여러개받아서 스플리트 해서 or조건으로 전부 반환하면 됨
//문제는 한 단어의 여러종류를 풀었을때..인데
// 차피 or문 들어가면 똑같잖아? 그냥 다 넣어서 하면 될 듯




app.post('/login', loginHandler);
async function loginHandler(req, res) {
    let id = req.body.id._value;
    let password = req.body.password._value;
    if (id == null || password == null || id == "" || password == "") {
        res.status(400).send({reason:"empty id or password" });
        return;
    }
    password = sha512Hash(password);

    let [user] = await connection.query("SELECT `id` FROM `users` WHERE `user_id`=? AND `password`=?", [id, password]);
    if (user.length <= 0) {
        res.status(400).send({reason:"wrong id or password" });
        return;
    }

    let hashToken = sha512Hash(id + password + new Date());
    await connection.query("INSERT INTO `tokens`(`token`,`user_id`)VALUES(?,?)", [hashToken, user[0].id]);

    res.send(hashToken);
}

app.post('/regist', registHandler);
async function registHandler(req, res) {
    if (connection == null) return;

    let id = req.body.id._value;
    let password = req.body.password._value;

    if (id == null || password == null || id.trim() == "" || password.trim() == "") {
        res.status(400).send({ reason:"empty id or password" });
        return;
    }
    password = sha512Hash(password);

    let [check] = await connection.query("SELECT * FROM `users` WHERE `user_id`=?", [id]);
    if (check.length > 0) {
        res.status(400).send({ reason:"already id as same is exist" });
        return;
    }

    try {
        await connection.query("INSERT INTO `users`(`user_id`,`password`) VALUES(?,?)", [id, password]);
    } catch (e) {
        res.status(400).send({ reason:"DB Error" });
        return;
    }

    res.send({ success: true });
}


function getList(data){
    let list = [];
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

function sha512Hash(str) {
    return _crypto2.default.createHash('sha512').update(str).digest('hex');
}