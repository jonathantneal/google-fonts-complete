const URL = 'https://www.googleapis.com/webfonts/v1/webfonts?fields=items(category%2Cfamily%2ClastModified%2Csubsets%2Cvariants%2Cversion)&key=';
const _ = require('lodash/fp');
const fs = require('mz/fs');
const { fetch } = require('fetch-ponyfill')({});

const isArray = Array.isArray;

const sort = _.sortBy(_.identity);

const sortKeys = _.flow(
  _.toPairs,
  _.sortBy(v => v[0]),
  _.fromPairs,
);

const sortLists = _.flow(
  sortKeys,
  _.mapValues(v => (isArray(v) ? sort(v) : v)),
);

const sortAllLists = _.flow(
  _.sortBy(v => v.family),
  _.map(sortLists),
);

async function fetchGoogleFontsList(url, key) {
  const result = await fetch(url + key);
  const json = await result.json();
  console.log('Download complete');
  const res = sortAllLists(json.items);
  await fs.writeFile('api-response.json', JSON.stringify(res, null, '\t'));
}

const key = process.argv[2];

if (key === undefined) {
  console.log('\x1b[31m', 'The API Key is required!');
  process.exit(1);
}

fetchGoogleFontsList(URL, key);
