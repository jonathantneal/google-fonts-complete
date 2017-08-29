// api-response.json retrieved from: https://www.googleapis.com/webfonts/v1/webfonts?fields=items(category%2Cfamily%2ClastModified%2Csubsets%2Cvariants%2Cversion)&key={YOUR_API_KEY}
// alternatively available from: https://developers.google.com/apis-explorer/?hl=en_US#p/webfonts/v1/webfonts.webfonts.list?fields=items(category%252Cfamily%252ClastModified%252Csubsets%252Cvariants%252Cversion)&_h=3&

const exports = {};
const fonts = require('./api-response.json');
const fs = require('fs');
const http = require('http');
const postcss = require('postcss');

const postcssProcessor = postcss();
let promise = Promise.resolve();
const userAgents = require('./user-agents.json');

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

function fontToPath(family, variant) {
  return `/css?family=${family.replace(/\s/g, '+')}:${variant}`;
}

function eachFont(font) {
  const family = font.family;
  const variants = font.variants;

  delete font.family;
  delete font.variants;

  font.variants = {};

  exports[family] = font;

  variants.forEach((variant) => {
    const host = 'fonts.googleapis.com';
    const path = fontToPath(family, variant);

    Object.keys(userAgents).forEach((format) => {
      const userAgent = userAgents[format];

      const options = {
        host,
        path,
        headers: {
          'User-Agent': userAgent,
        },
      };

      promise = promise.then(() => new Promise(((resolve, reject) => {
        function callback(response) {
          let css = '';

          response.on('data', (data) => {
            css += data;
          });

          response.on('end', (end) => {
            if (response.statusCode === 200) {
              postcssProcessor.process(css).then((result) => {
                result.root.eachAtRule('font-face', (rule) => {
                  let fontStyle = 'normal';
                  let fontWeight = '400';

                  rule.eachDecl('font-weight', (decl) => {
                    fontWeight = decl.value;
                  });

                  rule.eachDecl('font-style', (decl) => {
                    fontStyle = decl.value;
                  });

                  font.variants[fontStyle] = font.variants[fontStyle] || {};
                  font.variants[fontStyle][fontWeight] = font.variants[fontStyle][fontWeight] || {
                    local: [],
                    url: {},
                  };

                  rule.eachDecl('src', (decl) => {
                    postcss.list.comma(decl.value).forEach((value) => {
                      value.replace(/(local|url)\((.+?)\)/g, (match, type, path) => {
                        if (type === 'local') {
                          if (font.variants[fontStyle][fontWeight].local.indexOf(path) === -1) {
                            font.variants[fontStyle][fontWeight].local.push(path);
                          }
                        } else if (type === 'url') {
                          font.variants[fontStyle][fontWeight].url[format] = path;
                        }
                      });
                    });
                  });

                  console.log('Captured', family, fontStyle, fontWeight, 'as', format, '...');

                  resolve();
                });
              });
            } else {
              console.log('Rejected', family, fontStyle, fontWeight, 'as', format, '...');

              resolve();
            }
          });
        }

        http.get(options, callback);
      })));
    });
  });

  return font;
}

function oncomplete() {
  fs.writeFile('google-fonts.json', JSON.stringify(getSortedObject(exports), null, '\t'), () => {
    console.log('Operation complete.');
  });
}

fonts.forEach(eachFont);

promise.then(oncomplete);
