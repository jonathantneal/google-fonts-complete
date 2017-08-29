const URL = 'https://www.googleapis.com/webfonts/v1/webfonts?fields=items(category%2Cfamily%2ClastModified%2Csubsets%2Cvariants%2Cversion)&key=';

const fs = require('mz/fs');
const { fetch } = require('fetch-ponyfill')({});

async function fetchGoogleFontsList(url, key) {
  const result = await fetch(url + key);
  const json = await result.json();
  console.log('Download complete');
  await fs.writeFile('api-response.json', JSON.stringify(json.items, null, '\t'));
}

const key = process.argv[2];

if (key === undefined) {
  console.log('\x1b[31m', 'The API Key is required!');
  process.exit(1);
}

fetchGoogleFontsList(URL, key);
