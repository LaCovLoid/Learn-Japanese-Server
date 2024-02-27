"use strict"; function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _express = require('express'); var _express2 = _interopRequireDefault(_express);
var _promise = require('mysql2/promise');
var _dotenv = require('dotenv'); var _dotenv2 = _interopRequireDefault(_dotenv);
var _crypto = require('crypto'); var _crypto2 = _interopRequireDefault(_crypto);

var _cors = require('cors'); var _cors2 = _interopRequireDefault(_cors);
var _deeplnode = require('deepl-node'); var deepl = _interopRequireWildcard(_deeplnode);

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

app.get('/random', randomHandler);
async function randomHandler(req, res) {
  if (connection == null) return;
  
  let [result] = await connection.query("SELECT * FROM `words` WHERE `yomi_word_same`='0' Order by rand() Limit 1");
  if (result == null) {
    res.status(404).send({reason:"DB Error"});
  }
  res.send({word_id:result[0].id, word:result[0].word, mean:result[0].mean, yomigana_length:result[0].yomigana.length});
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
    for (let i = 0; i < resolve.length - 2; i++){
      text += "`id`='" + resolve[i] + "' OR ";
    }
    text += "`id`='" + resolve[resolve.length - 2] + "'";
  }
  if (userId[0].favorite != null){
    favorite = userId[0].favorite.split("/");
  }
  if (text !=""){
    result =  await connection.query("SELECT * FROM `words` WHERE "+text);
  }
  res.send([getList(result[0]),favorite]);
}

app.get('/word_check', checkHandler);
async function checkHandler(req, res) {
  if (connection == null) return;

  let text = req.query.text;
  let wordId = req.query.wordId;
  let token = req.headers["access-token"];
  let tokenResult = [];
  
  let [result] =  await connection.query("SELECT `yomigana` FROM `words` WHERE `id`=?",[wordId]);
  if (result == null) {
    res.status(404).send({reason:"not found id"});
    return;
  }
  let correct = result[0].yomigana == text ? true : false;

  if (token) {
    tokenResult = await connection.query("SELECT `user_id` FROM `tokens` WHERE `token`=?",[token]);
  }
  if (correct && tokenResult.length > 0){
    await connection.query("UPDATE `users` SET `resolve`=CONCAT(`users`.`resolve`,?) WHERE `id`=?",[wordId+"/",tokenResult[0][0].user_id])
  }

  res.send({isAnswer:correct});
}

app.get('/answer', answerHandler);
async function answerHandler(req, res) {
  if (connection == null) return;

  let wordId = req.query.wordId;
  let [result] =  await connection.query("SELECT `yomigana` FROM `words` WHERE `id`=?",[wordId]);
  if (result == null) {
    res.status(404).send({reason:"not found id"});
    return;
  }
  res.send({yomigana: result[0].yomigana});
}

app.get('/translate', translateHandler);
async function translateHandler(req, res) {
  const authKey = String(process.env.authKey);
  const translator = new deepl.Translator(authKey);

  let text = req.query.text;
  let type = req.query.type;
  let startLanguage = '';
  let toLanguage = '';

  if (text == null) text = "안녕하세요";
  if (type == null) type = 0;

  if (type == 0) {
    startLanguage = 'ja';
    toLanguage = 'ko';
  }else {
    startLanguage = 'ko';
    toLanguage = 'ja';
  }
  translator.translateText(text, startLanguage , toLanguage )
    .then(deeplFetchHandler)
    .catch(deeplErrorHandler);

  function deeplErrorHandler() {
    res.status(404).send();
  }
  function deeplFetchHandler(response) {
    res.send(response.text);
  }
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


////////////////////////////////////////////////////////////////////////////////////////////////

function getList(data){
  let list = [];
  if (data==null || data.length < 1) { return list;}
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