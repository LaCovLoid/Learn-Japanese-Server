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
        database: "karaoke"
    });
    console.log("connection successful?", connection != null);
}

var _nodefs = require('node:fs'); var _nodefs2 = _interopRequireDefault(_nodefs);

app.get('/japanese', searchHandler);
async function searchHandler(req, res) {
    if (connection == null) return;
    
    
    _nodefs2.default.readFile('./src/jp_word.txt', 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return;
        }
        const lines = data.split('\r\n');
        let text = "";
        for (let i in lines) {
            text += lines[i].trim()+"\r\n";
        }

        _nodefs2.default.writeFileSync('./src/jp_word2.txt', text);

        res.send ({aaa:text.trim()});
        return;
    });

}


