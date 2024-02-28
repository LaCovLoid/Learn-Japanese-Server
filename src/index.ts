import express, { json, request, urlencoded } from 'express';
import { createConnection } from 'mysql2/promise';
import dotenv from "dotenv";
import crypto from 'crypto';
import axios from 'axios';
import cors from 'cors';
import * as deepl from 'deepl-node';

const app = express();
const port = 3000;
let connection:any;

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

app.get('/random', randomHandler);
async function randomHandler(req:any, res:any) {
  if (connection == null) return;
  
  let [result] = await connection.query("SELECT * FROM `words` WHERE `yomi_word_same`='0' Order by rand() Limit 1");
  if (result == null) {
    res.status(404).send({reason:"DB Error"});
  }
  res.send({word_id:result[0].id, word:result[0].word, mean:result[0].mean, yomigana_length:result[0].yomigana.length});
}

app.get('/user_info', userInfoHandler);
async function userInfoHandler(req:any, res:any) {
  if (connection == null) return;
  
  let accessToken = req.headers["access-token"];
  let [tokenUserId] = await connection.query("SELECT `user_id` FROM `tokens` WHERE `token`=?", [accessToken]);

  if (tokenUserId.length == 0){
    res.status(400).send({reaseon:"token not found"});
    return;
  }

  let [user] = await connection.query("SELECT `user_id`,`resolve`,`favorite` FROM `users` WHERE `id`=?", [tokenUserId[0].user_id]);
  if (user.length == 0){
    res.status(404).send({reason:"user not found"});
    return;
  }

  let favorite = [];
  let result = [];
  let resolve = [];
  let text = "";

  if (user[0].resolve != null){
    resolve = user[0].resolve.split("/");
    for (let i = 0; i < resolve.length - 2; i++){
      text += "`id`='" + resolve[i] + "' OR ";
    }
    text += "`id`='" + resolve[resolve.length - 2] + "'";
  }
  if (user[0].favorite != null){
    favorite = user[0].favorite.split("/");
    favorite.pop();
  }
  if (text !=""){
    result =  await connection.query("SELECT * FROM `words` WHERE "+text);
  }
  res.send({user_id:user[0].user_id,resolve:getList(result[0]),favorite:favorite});
}

app.get('/word_check', checkHandler);
async function checkHandler(req:any, res:any) {
  if (connection == null) return;

  let text = req.query.text;
  let wordId = req.query.wordId;
  let token = req.headers["access-token"];
  let tokenResult:any = [];
  
  let [result] =  await connection.query("SELECT `yomigana` FROM `words` WHERE `id`=?",[wordId]);
  if (result == null) {
    res.status(404).send({reason:"not found id"});
    return;
  }
  let correct:boolean = result[0].yomigana == text ? true : false;

  if (token) {
    tokenResult = await connection.query("SELECT `user_id` FROM `tokens` WHERE `token`=?",[token]);
  }
  if (correct && tokenResult.length > 0){
    await connection.query("UPDATE `users` SET `resolve`=CONCAT(`users`.`resolve`,?) WHERE `id`=?",[wordId+"/",tokenResult[0][0].user_id])
  }

  res.send({isAnswer:correct});
}

app.get('/answer', answerHandler);
async function answerHandler(req:any, res:any) {
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
async function translateHandler(req:any, res:any):Promise<any> {
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
  translator.translateText(text, startLanguage as deepl.SourceLanguageCode, toLanguage as deepl.TargetLanguageCode)
    .then(deeplFetchHandler)
    .catch(deeplErrorHandler);

  function deeplErrorHandler() {
    res.status(404).send();
  }
  function deeplFetchHandler(response:any) {
    res.send(response.text);
  }
}

app.get('/rank',rankHandler);
async function rankHandler(req:any, res:any) {
  if (connection == null) return;

  let accessToken = req.headers["access-token"];
  let score = req.query.score;
  if (score == null) return;

  if (accessToken) {
    let [temp] = await connection.query("SELECT `user_id` FROM `tokens` WHERE `token`=?", [accessToken]);
    if (temp.length == 0) return;
    let [temp2] = await connection.query("SELECT `user_id` FROM `users` WHERE `id`=?", [temp[0].user_id]);
    if (temp2.length == 0) return;
    let userId = temp2[0].user_id;
    await connection.query("INSERT INTO `rank`(`user_id`,`score`) VALUES(?,?)", [userId, score]);
  }
  let [result] = await connection.query("SELECT * FROM `rank` ORDER BY `score` DESC LIMIT 10");
  let rank:any = [];
  for (let i = 0; i < result.length; i++) {
    rank.push({
      user_id: result[i].user_id,
      score: result[i].score,
    });
  }
  res.send({rank:rank});
}

app.get('/modify_favorite',modifyFavoriteHandler);
async function modifyFavoriteHandler(req:any,res:any) {
  if (connection == null) return;

  let wordId = req.query.wordId;
  if (wordId == null || wordId == "") return;
  let accessToken = req.headers["access-token"];
  if (accessToken == null || accessToken == "") return;
  
  let [temp] = await connection.query("SELECT `user_id` FROM `tokens` WHERE `token`=?", [accessToken]);
  if (temp.length == 0) return;
  let [user] = await connection.query("SELECT `favorite` FROM `users` WHERE `id`=?", [temp[0].user_id]);
  if (user.length == 0) {
    await connection.query("UPDATE `users` SET `favorite`=? WHERE `id`=?", [wordId+"/",temp[0].user_id]);
    res.send({success: true});
    return;
  }

  let favorite = (user[0].favorite).split('/');
  favorite.pop();
  if (favorite.indexOf(wordId) > -1) {
    favorite.splice(favorite.indexOf(wordId),1);
  } else {
    favorite.push(wordId);
  }

  let favoriteText = "";
  for (let i = 0; i < favorite.length; i++) {
    favoriteText += favorite[i] + '/';
  }
  await connection.query("UPDATE `users` SET `favorite`=? WHERE `id`=?", [favoriteText, temp[0].user_id]);

}

app.post('/login', loginHandler);
async function loginHandler(req:any, res:any) {
  if (connection == null) return;

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
  await connection.query("DELETE FROM `tokens` WHERE `user_id`=?", [user[0].id]); 
  await connection.query("INSERT INTO `tokens`(`token`,`user_id`)VALUES(?,?)", [hashToken, user[0].id]);

  res.send(hashToken);
}

app.post('/regist', registHandler);
async function registHandler(req:any, res:any) {
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
      await connection.query("INSERT INTO `users`(`user_id`,`password`,`resolve`,`favorite`) VALUES(?,?)", [id, password,"0/","0/"]);
  } catch {
    res.status(400).send({ reason:"DB Error" });
    return;
  }

  res.send({ success: true });
}


////////////////////////////////////////////////////////////////////////////////////////////////

function getList(data:any):any{
  let list:any[] = [];
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

function sha512Hash(str:string):string {
  return crypto.createHash('sha512').update(str).digest('hex');
}