const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash/fp');
const { fetch } = require('fetch-ponyfill')({});
const promisePipe = require('promise-pipe');
const promiseRetry = require('promise-retry');
const { Semaphore } = require('await-semaphore');
const fonts = require('./google-fonts-linear.json');

const semaphore = new Semaphore(64);

function properPromiseRetry(fn, options) {
  async function wrapper(retry) {
    try {
      return await fn();
    } catch (e) {
      return retry(e);
    }
  }

  return promiseRetry(wrapper, options);
}

async function downloadAndSaveFont(font) {
  const { path: url, fontStyle, fontWeight, family, format } = font;
  const dir = path.join('fonts', family, fontStyle, fontWeight);
  const fname = path.join(dir, `font.${format}`);
  async function getWriteStream() {
    await fs.mkdirp(dir);
    // return fs.createWriteStream(fname);
  }

  async function getReadStream() {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`failed to download ${fname}`);
    }
    // return res.body;
    return res.buffer();
  }

  console.log('started', fname);
  const [readStream, writeStream] = await Promise.all([getReadStream(), getWriteStream()]);
  await fs.writeFile(fname, readStream);
  // await promisePipe(readStream, writeStream);
  console.log('Downloaded', fname);
}

function decoratedDownloadFont(v) {
  return properPromiseRetry(
    () => semaphore.use(() => downloadAndSaveFont(v)),
    { randomize: true },
  );
}

const downloadFonts = _.flow(
  _.filter(v => v.type === 'url'),
  _.map(decoratedDownloadFont),
  v => Promise.all(v),
);

async function doIt() {
  try {
    await downloadFonts(fonts);
    console.log('Completed');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

doIt();
