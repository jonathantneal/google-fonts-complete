var URL = 'https://www.googleapis.com/webfonts/v1/webfonts?fields=items(category%2Cfamily%2ClastModified%2Csubsets%2Cvariants%2Cversion)&key=';

var fs = require('fs');
var https = require('https');

function fetchGoogleFontsList(url, key) {
  return new Promise(function (resolve, reject) {
    var req = https.get(url + key, function(res) {
      if (res.statusCode < 200 || res.statusCode > 299) {
         reject(new Error('Failed to load list, status code: ' + res.statusCode));
      }

      var rawData = '';
      res.setEncoding('utf8');

      res.on('data', function(chunk) { return rawData += chunk; });
      res.on('end', function() {
        try {
          var list = JSON.parse(rawData);
          resolve(list.items);
        } catch (e) {
          reject(new Error(e.message));
        }
      });
    });

    // handle connection errors of the request
    req.on('error', function(err) { return reject(err); });
  })
}

var key = process.argv[2];

if (key === undefined) {
  console.log('\x1b[31m', 'The API Key is required!');
  return false;
}

fetchGoogleFontsList(URL, key)
  .then(function(list) {
      fs.writeFile('api-response.json', JSON.stringify(list, null, '\t'), function () {
        console.log('Operation complete.');
      });
  });
