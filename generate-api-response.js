const URL = 'https://www.googleapis.com/webfonts/v1/webfonts?fields=items(category%2Cfamily%2ClastModified%2Csubsets%2Cvariants%2Cversion)&key=';

const fs = require('fs');
const https = require('https');

const utils = require('./utils');


const fetchGoogleFontsList = url => {
  return new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      if (res.statusCode < 200 || res.statusCode > 299) {
         reject(new Error('Failed to load list, status code: ' + res.statusCode));
      }

      let rawData = '';
      res.setEncoding('utf8');

      res.on('data', chunk => rawData += chunk );
      res.on('end', function() {
        try {
          const list = JSON.parse(rawData);
          resolve(list.items);
        } catch (e) {
          reject(new Error(e.message));
        }
      });
    });

    // handle connection errors of the request
    req.on('error', err => reject(err) );
  })
}

const key = process.argv[2];
const isSeparate = process.argv[3] === 'true';


if (key === undefined) {
  console.log('\x1b[31m', 'The API Key is required!');
  return false;
}

fetchGoogleFontsList(URL + key)
  .then(list => {
      if (!isSeparate) {
          fs.writeFile('api-response.json', JSON.stringify(list, null, '\t'), function () {
            console.log('Operation complete.');
          });
      } else {
        const chunkedFonts = utils.getChunkedFonts(list);
        for (const key in chunkedFonts) {
            if (Object.hasOwnProperty.call(chunkedFonts, key)) {
                const fontFamily = chunkedFonts[key];
                fs.writeFileSync(`api-response_${key}.json`, JSON.stringify(fontFamily, null, '\t'))
            }
        }
      }
  });
