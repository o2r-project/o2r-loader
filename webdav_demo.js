'use strict';
var express = require('express');
var app = express();

var createClient = require("webdav");
var fs = require("fs");
var url = require("url");
var bodyParser = require('body-parser');

app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');    //allow CORS
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
    res.setHeader('Access-Control_Allow-Headers', 'X-Requested-With, Content-Type');
    next();
});

app.post('/api/v1/compendium/', function (req, res) {
    var share_url = req.body.shareURL;
    //var share_url = 'https://uni-muenster.sciebo.de/index.php/s/c7hsPIHGvgWnD6U';
    console.log('webdavurl: ' + share_url);

    // Extract owncloud share token from share URL
    var token = url.parse(share_url).path.split("/")[3];
    console.log('token :' + token);

    // Get domain name
    var hostname = url.parse(share_url).hostname.split(".");

    hostname = hostname[hostname.length - 2];

    console.log('hostname: ' + hostname);

    if (hostname != 'sciebo') {
        throw new Error('Invalid file host');
    }
    var client = createClient(
        "https://uni-muenster.sciebo.de/public.php/webdav",
        token,
        ""
    );

    client
        .getDirectoryContents("/")
        .then(function (contents) {
            //console.log(JSON.stringify(contents, undefined, 4));
            return res.json(contents);
        })
        .catch(function (err) {
            console.error(err);
        });

    // Example: get pingtainer.zip
    client
        .getFileContents("/pingtainer.zip")
        .then(function (zip) {
            //fs.writeFileSync("./myImage.jpg", imageData);
            console.log("Done loading file.")
        })
        .catch(function (err) {
            console.error(err);
        });


});



app.listen(3000, function () {
    console.log('Example app listening on port 3000!')
});
