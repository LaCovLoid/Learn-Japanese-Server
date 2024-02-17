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
        database: "karaoke"
    });
    console.log("connection successful?", connection != null);
}

import fs from 'node:fs';

app.get('/japanese', searchHandler);
async function searchHandler(req: any, res: any) {
    if (connection == null) return;
    
    
    fs.readFile('./src/jp_word.txt', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        const lines = data.split('\r\n');
        let text = "";
        for (let i in lines) {
            text += lines[i].trim()+"\r\n";
        }

        fs.writeFileSync('./src/jp_word2.txt', text);

        res.send ({aaa:text.trim()});
        return;
    });

}


