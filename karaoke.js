const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const axios = require('axios').default;
var cors = require('cors');

const SEARCH_TYPE_ALL = 0
const SEARCH_TYPE_SINGER = 1

const app = express();
const port = 3000;
let connection;
//let link = "https://www.youtube.com/user/ziller/search?query=" + number; 프런트에 사용해야함

connectServer();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});

app.get('/number/:keyword', numberHandler);
async function numberHandler(req, res) {
    if (connection == null) return;

    let keyword = req.params.keyword;
    if (keyword == null || isNaN(keyword)) return;

    let result = await search(keyword, "all", 16, 1, 1);
    if (result[0].length == 0 || result[0][0].length == 0) return;
    res.send({ array: result[0][0] });
}

app.get('/search/:keyword', searchHandler);
async function searchHandler(req, res) {
    if (connection == null) return;

    let keyword = req.params.keyword;
    if (keyword == null) return;

    let strType = req.query.str_type;   // 검색종류 
    let natType = req.query.nat_type;   // 국가별
    let page = req.query.page;          // 페이지

    // null,0=한번에 1=제목 2=가수 4=작사가 8=작곡가 16=곡번호 32=가사 그외엔 전체검색으로
    if (!strType) { res.status(400).send("failed"); return; }
    strType = strType.toLowerCase();
    if (!(strType == "all" || strType == "title" || strType == "singer" || strType == "writer" || strType == "maker" || strType == "number" || strType == "lyrics")) { res.status(400).send("failed"); return; }
    if (strType == "all") page = 1;
    switch (strType) {
        case "all": strType = "0"
            break;
        case "title": strType = "1"
            break;
        case "singer": strType = "2"
            break;
        case "writer": strType = "4"
            break;
        case "maker": strType = "8"
            break;
        case "number": strType = "16"
            break;
        case "lyrics": strType = "32"
            break;
    }

    // KOR ENG JPN CHN PHL INS 그 외 전체
    // 링크를 넣을 땐 대문자만 인식하며 대문자치환을 해줘야함
    if (!natType) { res.status(400).send("failed"); return; }
    natType = natType.toLowerCase();
    if (!(natType == "all" || natType == "kor" || natType == "eng" || natType == "jpn" || natType == "chn" || natType == "phl" || natType == "ins")) { res.status(400).send("failed"); return; }
    natType = natType.toUpperCase();


    //전체를 검색했을땐 page가 없기에 1로 설정
    if (!page) page = 1;
    if (isNaN(page) || page <= 0) { res.status(400).send("failed"); return; }

    let [queryResult] = await connection.query("SELECT `keywords`.`date`,`keywords`.`number`,`keywords`.`str_type`,`keywords`.`nat_type`,`keywords`.`page`,`keywords`.`class`,`keywords`.`date`,`songs`.`title`,`songs`.`singer`,`songs`.`writer`,`songs`.`maker` FROM `keywords`" +
        " LEFT JOIN `songs` ON `songs`.`number`=`keywords`.`number` WHERE `keywords`.`keyword`=?" +
        " AND `keywords`.`page`=? AND `keywords`.`nat_type`=? AND `keywords`.`str_type`=?",
        [keyword, page, natType, strType]);

    if (queryResult.length == null) return;

    let nowDate = new Date();
    let filtered;

    if (queryResult.length <= 0) {
        //검색결과 암것도 없는경우 인걸 확인
        filtered = await search(keyword, natType, strType, page, 0);
    } else if ((nowDate.getTime() - queryResult[0].date.getTime()) > 60 * 60 * 1000) {
        //시간이 지났으니 삭제하고 실행
        await connection.query("DELETE FROM `keywords` WHERE `keyword`=? AND `page`=? AND `nat_type`=? AND `str_type`=?", [keyword, page, natType, strType]);
        filtered = await search(keyword, natType, strType, page, 0);
    } else {
        //기존에 있던걸 그대로 넣음
        if (strType == 0 && queryResult[0].number != 0) {
            filtered = [[], [], [], [], []];
            for (let i = 0; i < queryResult.length; i++) {
                let locate;
                let isSong = true;
                switch (queryResult[i].class) {
                    case "title": locate = 0;
                        break;
                    case "singer": locate = 1;
                        break;
                    case "writer": locate = 2;
                        break;
                    case "maker": locate = 3;
                        break;
                    case "number": locate = 4;
                        break;
                    default:
                        isSong = false;
                }
                if (isSong) {
                    filtered[locate].push(getSongInfo(queryResult[i]));
                }
            }
        } else if (strType == 0) {
            filtered = [[], [], [], [], []];
        } else {
            filtered = [[]];
            for (let i = 0; i < queryResult.length; i++) {
                filtered[0].push(getSongInfo(queryResult[i]));
            }
            if (queryResult[0].number == 0) filtered = [[]];
        }
    }
    await increaseCount(keyword);
    res.send({ array: filtered });
}


async function search(keyword, natType, strType, page, strCond) {
    let url = "https://www.tjmedia.com/tjsong/song_search_list.asp?strType=" + strType + "&natType=" + natType + "&strText=" + keyword + "&strCond=" + strCond + "&searchOrderItem=&searchOrderType=&searchOrderItem=&intPage=" + page;
    let result = await axios.get(url);

    if (result == null) return;
    result = result.data;

    let searchResult = [];
    result = result.split("<!--노래제목검색 S-->");
    let nothing = true;
    // result[i] -> 1곡제목 2가수 3작사가 4작곡가 5곡번호 
    for (let i = 1; i < result.length; i++) {
        let tempArray = result[i].split("<tr>");
        if (tempArray.length < 2) return;

        let songs = [];
        let limit = strType == 0 ? tempArray.length : tempArray.length - 1;

        for (let j = 2; j < limit; j++) {
            // 가수 작사 작곡 
            let number = tempArray[j].split("<td>")[1].split("</td>")[0].replace(/<\/?[^>]+(>|$)/g, "");
            let title = tempArray[j].split("<td class=\"left\">")[1].split("</td>")[0].replace(/<\/?[^>]+(>|$)/g, "");
            let singer = tempArray[j].split("<td>")[2].split("</td>")[0].replace(/<\/?[^>]+(>|$)/g, "");
            let writer = tempArray[j].split("<td>")[3].split("</td>")[0].replace(/<\/?[^>]+(>|$)/g, "");
            let maker = tempArray[j].split("<td>")[4].split("</td>")[0].replace(/<\/?[^>]+(>|$)/g, "");

            let [songNumberResult] = await connection.query("SELECT `number` FROM `songs` WHERE `number`=?", [number]);
            if (songNumberResult.length == 0) {
                await connection.query("INSERT INTO `songs`(`number`, `title`,`singer`,`writer`,`maker`) VALUES (?,?,?,?,?)", [number, title, singer, writer, maker]);
            }

            let className = "null";
            if (strType == 0) {
                switch (i) {
                    case 1: className = "title";
                        break;
                    case 2: className = "singer";
                        break;
                    case 3: className = "writer";
                        break;
                    case 4: className = "maker";
                        break;
                    case 5: className = "number";
                        break;
                }
                await connection.query("INSERT INTO `keywords`(`keyword`, `number`, `str_type`, `nat_type`, `page`, `class`) VALUES (?,?,?,?,?,?)", [keyword, number, strType, natType, page, className]);
                nothing = false;
            } else {
                await connection.query("INSERT INTO `keywords`(`keyword`, `number`, `str_type`, `nat_type`, `page`) VALUES (?,?,?,?,?)", [keyword, number, strType, natType, page]);
                nothing = false;
            }

            songs.push({
                number: number,
                title: title,
                singer: singer,
                writer: writer,
                maker: maker,
            });
        }
        searchResult.push(songs);
    }

    if (nothing) {
        await connection.query("INSERT INTO `keywords`(`keyword`, `number`, `str_type`, `nat_type`, `page`) VALUES (?,?,?,?,?)", [keyword, 0, strType, natType, page]);
    }

    return searchResult;
}


//왜인지 계속 두번 실행 될 때가 있음 ????????????????????????????????????????????????
// TODO: 
async function increaseCount(keyword) {
    if (connection == null) return;

    let nowDate = new Date();

    let [checked] = await connection.query("SELECT `date` FROM `popular_keywords` ORDER BY `date` ASC LIMIT 1");
    if (checked.length != 0 && (nowDate.getTime() - checked[0].date.getTime()) > 30 * 24 * 60 * 60 * 1000) {
        await connection.query("DELETE FROM `popular_keywords` WHERE 1");
        res.send({ array: [] });
    }

    let [popular_keywords] = await connection.query("SELECT * FROM `popular_keywords` WHERE keyword=?", [keyword]);

    //update_date를 통해 1분내로 같은걸 검색할 시 안올리게 하는 방법도 가능
    if (popular_keywords.length == 0) {
        await connection.query("INSERT INTO `popular_keywords`(`keyword`, `count`) VALUES (?,?)", [keyword, '1']);
    } else {
        await connection.query("UPDATE `popular_keywords` SET `count`=`count`+1 WHERE keyword=?", [keyword]);
    }
}


app.get('/song/:number', songDetailHandler);
async function songDetailHandler(req, res) {
    if (connection == null) return;

    let number = req.params.number;
    if (number == null) return;

    let [result] = await connection.query("SELECT * FROM `songs` WHERE `number`=?", [number]);
    if (result.length == 0) {
        res.status(400).send("failed");
        return;
    }

    res.send({ array: getSongInfo(result[0]) });
}


app.get('/new', newSongHandler);
async function newSongHandler(req, res) {
    if (connection == null) return;
    let nowDate = new Date();
    let [queryResult] = await connection.query("SELECT * FROM `new_songs`");

    let songsArray = [];
    if (queryResult.length == 0 || nowDate.getTime() - queryResult[0].date.getTime() > 1000 * 60 * 60) {
        await connection.query("DELETE FROM `new_songs` WHERE 1");

        let result = await axios.get("https://www.tjmedia.com/tjsong/song_monthNew.asp");
        result = result.data.split("<!--목록 S-->")[1].split("<tr>");

        for (let i = 2; i < result.length; i++) {
            let number = result[i].split("<td>")[1].split("</td>")[0];
            let title = result[i].split("<td class=\"left\">")[1].split("</td>")[0];
            let singer = result[i].split("<td>")[2].split("</td>")[0];
            let writer = result[i].split("<td>")[3].split("</td>")[0];
            let maker = result[i].split("<td>")[4].split("</td>")[0];
            songsArray.push({
                number: number,
                title: title,
                singer: singer,
                writer: writer,
                maker: maker,
            });
            let check = await connection.query("SELECT `number` FROM `songs` WHERE `number`=?", [number])
            if (check.length == 0) {
                await connection.query("INSERT INTO `songs`(`number`, `title`,`singer`,`writer`,`maker`) VALUES (?,?,?,?,?)", [number, title, singer, writer, maker]);
            }
            await connection.query("INSERT INTO `new_songs`(`number`, `title`,`singer`,`writer`,`maker`) VALUES (?,?,?,?,?)", [number, title, singer, writer, maker]);
        }
    } else {
        for (let i = 0; i < queryResult.length; i++) {
            songsArray.push(getSongInfo(queryResult[i]));
        }
    }

    res.send({ array: songsArray });
}



app.get('/popular/song', popularSongHandler);
async function popularSongHandler(req, res) {
    if (connection == null) return;
    let nowDate = new Date();
    let [queryResult] = await connection.query("SELECT * FROM `popular_songs` ORDER BY `rank` ASC");

    let songsArray = [];
    if (queryResult.length == 0 || nowDate.getTime() - queryResult[0].date.getTime() > 1000 * 60 * 60) {
        await connection.query("DELETE FROM `popular_songs` WHERE 1");

        let result = await axios.get("https://www.tjmedia.com/tjsong/song_monthPopular.asp");
        result = result.data.split("<!--목록 S-->")[1].split("<tr>");

        for (let i = 2; i < result.length; i++) {
            let rank = result[i].split("<td>")[1].split("</td>")[0];
            let number = result[i].split("<td>")[2].split("</td>")[0];
            let title = result[i].split("<td class=\"left\">")[1].split("</td>")[0];
            let singer = result[i].split("<td>")[3].split("</td>")[0];

            songsArray.push({
                rank: rank,
                number: number,
                title: title,
                singer: singer,
            });
            let check = await connection.query("SELECT `number` FROM `songs` WHERE `number`=?", [number])
            if (check.length == 0) {
                await connection.query("INSERT INTO `songs`(`number`,`title`,`singer`) VALUES (?,?,?)", [number, title, singer]);
            }
            await connection.query("INSERT INTO `popular_songs`(`rank`, `number`,`title`,`singer`) VALUES (?,?,?,?)", [rank, number, title, singer]);
        }
    } else {
        for (let i = 0; i < queryResult.length; i++) {
            songsArray.push(getSongInfo(queryResult[i]));
        }
    }

    res.send({ array: songsArray });
}


app.get('/popular/keyword', popularKeywordHandler);
async function popularKeywordHandler(req, res) {
    if (connection == null) return;

    let [popular_keywords] = await connection.query("SELECT * FROM `popular_keywords` ORDER BY `count` DESC  LIMIT 10");

    let keywordsArray = [];
    for (let i = 0; i < popular_keywords.length; i++) {
        keywordsArray.push({
            keyword: popular_keywords[i].keyword,
        });
    }
    res.send({ array: keywordsArray });
}


app.get('/lyrics/:keyword', lyricsHandler);

async function lyricsHandler(req, res) {
    if (connection == null) return;

    let keyword = req.params.keyword;
    if (keyword == null) { res.status(400).send("failed"); return; }

    let [keywordQuery] = await connection.query("SELECT `number` FROM `lyrics_keywords` WHERE `keyword`=?", [keyword]);
    let number;
    if (keywordQuery.length == 0) {

        let melonSearch = await axios.get("https://www.melon.com/search/total/index.htm?q=" + keyword + "&section=&searchGnbYn=Y&kkoSpl=Y&kkoDpType=&mwkLogType=T");
        if (!melonSearch) return;
        melonSearch = melonSearch.data;

        if (melonSearch.indexOf("<!-- 검색 결과 없음 -->") != -1) {
            await connection.query("INSERT INTO `lyrics_keywords`(`keyword`,`number`) VALUES (?,?)", [keyword, 0]);
            res.send({ error: "검색 결과가 없습니다." });
            return;
        } else if (melonSearch.indexOf("tbody") != -1) {
            number = melonSearch.split("tbody")[1].split("value=\"")[1].split("\"")[0];
            await connection.query("INSERT INTO `lyrics_keywords`(`keyword`,`number`) VALUES (?,?)", [keyword, number]);
        } else if (melonSearch.indexOf("data-song-no=\"") != -1) {
            number = melonSearch.split("data-song-no=\"")[1].split("\"")[0];
            await connection.query("INSERT INTO `lyrics_keywords`(`keyword`,`number`) VALUES (?,?)", [keyword, number]);
        } else {
            await connection.query("INSERT INTO `lyrics_keywords`(`keyword`,`number`) VALUES (?,?)", [keyword, 0]);
            res.send({ error: "검색 결과가 없습니다." });
            return;
        }
    } else {
        number = keywordQuery[0].number;
    }


    let [lyricsQuery] = await connection.query("SELECT `lyrics` FROM `lyrics` WHERE `number`=?", [number]);
    let lyrics;
    if (number == 0) {
        lyrics = "검색 결과가 없습니다."
    } else if (lyricsQuery.length == 0) {
        let lyricsSearch = await axios.get("https://www.melon.com/song/detail.htm?songId=" + number);
        lyrics = lyricsSearch.data.split("<!-- 가사 -->")[1].split("<!-- //가사 -->")[0];

        if (lyrics.indexOf('none') == -1) {
            lyrics = lyrics.split("확장됨 -->")[1].split("</div>")[0].trim();
        } else {
            lyrics = "가사가 아직 없습니다";
        }
        await connection.query("INSERT INTO `lyrics`(`lyrics`,`number`) VALUES (?,?)", [lyrics, number]);
    } else {
        lyrics = lyricsQuery[0].lyrics;
    }
    res.send({ lyrics: lyrics });

}



app.get('/youtube/:keyword', getYoutubeSearchInfo);
async function getYoutubeSearchInfo(req, res) {
    searchKeyword = req.params.keyword;
    let response = await axios.get("https://www.youtube.com/results?search_query=" + searchKeyword);

    result = response.data;
    result = result.split("\"itemSectionRenderer\":")[1];
    result = result.split("\"videoRenderer\"");

    /*
    for (let i = 1; i < result.length; i++) {
        let url = result[i].split("\"videoId\":\"")[1].split("\"")[0];
        let thumnail = result[i].split("\"url\":")[1].split("\"")[1];
        let title = result[i].split("text")[1].split("\"}")[0];

        if (i == 2) break;
    }
    */
    result = result[1];
    if (result.indexOf("\"videoId\":\"") == -1) {
        res.send("영상이 없습니다");
        return;
    }
    result = result.split("\"videoId\":\"")[1].split("\"")[0];

    res.send({ youtubeId: result });
}



//////////////////////////////////////////////////////////////////////////////



async function connectServer() {
    connection = await mysql.createConnection({
        host: process.env.DB_HOST, // 'localhost',
        port: 3306,
        user: 'root',
        password: 'root',
        database: 'karaoke'
    });
    console.log("connection successful?", connection != null);
}


function getSongInfo(data) {
    return {
        number: data.number,
        title: data.title,
        singer: data.singer,
        writer: data.writer,
        maker: data.maker,
        lyrics: data.lyrics,
        rank: data.rank,
    }
}
