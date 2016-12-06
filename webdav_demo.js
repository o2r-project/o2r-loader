'use strict';
var express = require('express');
var app = express();

var createClient = require("webdav");
var fs = require("fs");

var client = createClient(
    "https://uni-muenster.sciebo.de/public.php/webdav",
    "c7hsPIHGvgWnD6U",
    ""
);


app.get('/api/v1/compendium', function (req, res) {
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

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');    // allow CORS
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
    res.setHeader('Access-Control_Allow-Headers', 'X-Requested-With, Content-Type');
    next();
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!')
});
