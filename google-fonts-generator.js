// api-response.json retrieved from: https://www.googleapis.com/webfonts/v1/webfonts?fields=items(category%2Cfamily%2ClastModified%2Csubsets%2Cvariants%2Cversion)&key={YOUR_API_KEY}
// alternatively available from: https://developers.google.com/apis-explorer/?hl=en_US#p/webfonts/v1/webfonts.webfonts.list?fields=items(category%252Cfamily%252ClastModified%252Csubsets%252Cvariants%252Cversion)&_h=3&

const url = require('url');
const fonts = require('./api-response.json');
const fs = require('mz/fs');
const _ = require('lodash/fp');
const { fetch } = require('fetch-ponyfill')({});
const postcss = require('postcss');
const promiseRetry = require('promise-retry');
const { Semaphore } = require('await-semaphore');
const cartesianProduct = require('cartesian-product');

const postcssProcessor = postcss();
const userAgents = require('./user-agents.json');

const semaphore = new Semaphore(64);

function getSortedObject(object) {
  const sortedObject = {};

  Object.keys(object).sort().forEach((key) => {
    if (object[key] instanceof Array || typeof object[key] !== 'object') {
      sortedObject[key] = object[key];
    } else {
      sortedObject[key] = getSortedObject(object[key]);
    }
  });

  return sortedObject;
}

function fontToQ(family, variant) {
  return { family: `${family}:${variant}` };
}

function atRules(root) {
  const rules = [];
  root.eachAtRule(rule => rules.push(rule));
  return rules;
}

const fontFaceDecls = ['font-weight', 'font-style', 'src'];

function getDecls(rule) {
  const decls = [];
  fontFaceDecls.forEach((name) => {
    rule.eachDecl(name, (decl) => {
      decls.push({ name, decl });
    });
  });

  return decls;
}

function metadata(decls) {
  const fontStyle = _.getOr('normal', 'font-style[0].decl.value', decls);
  const fontWeight = _.getOr('400', 'font-weight[0].decl.value', decls);
  const srcs = _.getOr([], 'src', decls);

  function processSrc(value) {
    const match = /(local|url)\((.+?)\)/g.exec(value);
    if (!match) {
      return { fontStyle, fontWeight };
    }

    const [, type, path] = match;

    return { fontStyle, fontWeight, type, path };
  }

  return _.flow(
    _.flatMap(v => postcss.list.comma(v.decl.value)),
    _.map(processSrc),
    _.reject(v => v.path.startsWith('https://fonts.gstatic.com/stats/')),
  )(srcs);
}

const processRule = _.flow(
  getDecls,
  _.groupBy(v => v.name),
  metadata,
  _.flatten,
);

const getAllDecls = _.flow(
  atRules,
  _.flatMap(processRule),
);

async function getFont({ ua, format, family, variant, subset }) {
  const host = 'fonts.googleapis.com';
  const logMsg = `${family} ${variant} ${format}`;
  console.log('Started', logMsg);
  const fontUrl = url.format({
    protocol: 'https',
    host,
    pathname: 'css',
    query: fontToQ(family, variant, subset),
  });
  const res = await fetch(
    fontUrl,
    { headers: { 'User-Agent': ua } },
  );
  if (!res.ok) {
    throw new Error(`Failed to download ${logMsg}`);
  }
  console.log('First bytes for', logMsg);
  const css = await res.text();
  console.log('Downloaded', logMsg);

  const result = await postcssProcessor.process(css);
  return _.flow(
    getAllDecls,
    _.map(_.flow(
      _.set('family', family),
      _.set('format', format),
      _.set('variant', variant),
      _.set('subset', subset),
    )),
  )(result.root);
}

async function flattenPromises(v) {
  const res = await Promise.all(v);
  return _.flatten(res);
}

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

function getFontDecorated(args) {
  return properPromiseRetry(
    () => semaphore.use(() => getFont(args)),
    { randomize: true },
  );
}

function eachFont(font) {
  const { family, variants, subsets } = font;

  function fetchForVariant([variant, subset]) {
    return _.flow(
      _.toPairs,
      _.map(([format, ua]) => getFontDecorated({ ua, format, family, variant, subset })),
      flattenPromises,
    )(userAgents);
  }

  const allSubsets = subsets.join(',');
  const uniqSubsets = _.uniq([...subsets, allSubsets]);

  return _.flow(
    cartesianProduct,
    _.map(fetchForVariant),
    flattenPromises,
  )([variants, uniqSubsets]);
}

async function doIt() {
  async function getData() {
    try {
      return await _.flow(
        _.map(eachFont),
        flattenPromises,
      )(fonts);
    } catch (e) {
      console.error(e);
      process.exit(1);
      return undefined;
    }
  }

  const res = await getData();

  function reducer(acc, next) {
    const { fontStyle, fontWeight, type, path, format, family, subset } = next;
    const ss = subset.includes(',') ? 'all' : subset;

    if (type !== 'local') {
      if (ss === 'latin') {
        return _.setWith(Object, [family, 'variants', fontStyle, fontWeight, type, format], path, acc);
      }

      return _.setWith(Object, [family, 'variants', fontStyle, fontWeight, 'subset', ss, type, format], path, acc);
    }

    return _.updateWith(
      Object,
      [family, 'variants', fontStyle, fontWeight, 'local'],
      (locals = []) => _.uniq([...locals, path]),
      acc,
    );
  }

  const init = _.flow(
    _.keyBy(v => v.family),
    _.mapValues(_.flow(
      _.set('variants', {}),
      _.omit(['family']),
    )),
  )(fonts);

  await fs.writeFile('google-fonts-linear.json', JSON.stringify(res));
  const obj = _.reduce(reducer, init, res);
  const json = JSON.stringify(getSortedObject(obj), null, '\t');
  await fs.writeFile('google-fonts.json', json);
  console.log('Operation complete');
}

doIt();
