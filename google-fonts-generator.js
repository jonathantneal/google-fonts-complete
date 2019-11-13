// api-response.json retrieved from: https://www.googleapis.com/webfonts/v1/webfonts?fields=items(category%2Cfamily%2ClastModified%2Csubsets%2Cvariants%2Cversion)&key={YOUR_API_KEY}
// alternatively available from: https://developers.google.com/apis-explorer/?hl=en_US#p/webfonts/v1/webfonts.webfonts.list?fields=items(category%252Cfamily%252ClastModified%252Csubsets%252Cvariants%252Cversion)&_h=3&

const fs = require('fs');
const https = require('https');
const postcss = require('postcss');

const fonts = require('./api-response.json');
const userAgents = require('./user-agents.json');

const getSortedObject = object => {
    let sortedObject = {};

    Object.keys(object)
        .sort()
        .forEach(key => {
            const entry = object[key];

            if (Array.isArray(entry) || typeof entry !== 'object') {
                sortedObject[key] = entry;
            } else {
                sortedObject[key] = getSortedObject(entry);
            }
        });

    return sortedObject;
};

const fetch = options => {
    return new Promise((resolve, reject) => {
        https.get(options, response => {
            let result = '';

            response.on('data', data => {
                result += data;
            });

            response.on('end', end => {
                resolve(result);
            });
        });
    });
};


const convertFont = async({ convertedFont, family, format }, fetchOptions) => {
    let { variants, unicodeRange } = convertedFont;

    const css = await fetch(fetchOptions);

    if (css) {
        let subset = null;
        const root = postcss.parse(css);
        root.each(rule => {
            if (rule.type === 'comment') {
                subset = rule.text;
            }

            if (rule.type === 'atrule' && rule.name === 'font-face') {
                let fontStyle = 'normal';
                let fontWeight = '400';

                rule.walkDecls('font-weight', decl => {
                    fontWeight = decl.value;
                });

                rule.walkDecls('font-style', decl => {
                    fontStyle = decl.value;
                });
                variants[fontStyle] = variants[fontStyle] || {};
                variants[fontStyle][fontWeight] = variants[fontStyle][fontWeight] || {
                    local: [],
                    url: {}
                };

                rule.walkDecls('src', decl => {
                    postcss.list.comma(decl.value).forEach(value => {
                        value.replace(
                            /(local|url)\((.+?)\)/g,
                            (match, type, path) => {
                                if (type === 'local') {
                                    if (
                                        variants[fontStyle][fontWeight].local.indexOf(path) === -1
                                    ) {
                                        variants[fontStyle][fontWeight].local.push(path);
                                    }
                                } else if (type === 'url') {
                                    variants[fontStyle][fontWeight].url[format] = path;
                                }
                            }
                        );
                    });
                });

                rule.walkDecls('unicode-range', decl => {
                        unicodeRange = {
                            ...unicodeRange,
                            [subset]: decl.value
                        }
                });

                console.log('Captured', family, fontStyle, fontWeight, 'as', format,'...');
            }
        });
        return {
            ...convertedFont,
            variants,
            unicodeRange
        };
    } else {
        console.log('Rejected', family, fontStyle, fontWeight, 'as', format,'...');
        return null;
    }
};

const getFetchOptions = ({ family, variants, format, pathCb }) => {
    const userAgent = userAgents[format];

    const variantsList = ['eot', 'svg'].includes(format)
        ? variants
        : [variants.join(',')];

    return variantsList.map(variant => ({
        host: 'fonts.googleapis.com',
        path: encodeURI(pathCb({ family, variant })),
        headers: {
            'User-Agent': userAgent
        }
    }));
}


const convertFontsOptions = async (fonts, pathCb) => {
    let results = {};

    for (const font of fonts) {
        const { family, variants, ...originalFont } = font;

        const agents = Object.keys(userAgents);

        let convertedFont = {
            ...originalFont,
            variants: {},
            unicodeRange: {}
        };

        for(const format of agents) {
            const optionsList = getFetchOptions({ family, variants, format, pathCb });
            for (const options of optionsList) {
                convertedFont = await convertFont({ convertedFont, family, format }, options);
            }
        }
        results[family] = convertedFont;
    };

    return results;
};

console.time('convert');

Promise.all([
    convertFontsOptions(
        fonts,
        ({ family, variant }) => {
            return `/css?subset=latin-ext&family=${family.replace(/\s/g, '+')}:${variant}`;
        }
    ),
    convertFontsOptions(
        [
            {
                "family": "Material Icons",
                "category": "icon",
                "variants": [
                    "regular",
                ],
                "subsets": [
                    "latin"
                ],
            }
        ],
        () => {
            return '/icon?family=Material+Icons';
        }
    )
])
.then(results => {
    const combinedResults = {
        ...results[0],
        ...results[1]
    }
    fs.writeFile(
        'google-fonts.json',
        JSON.stringify(getSortedObject(combinedResults), null, '\t'),
        function() {
            console.timeEnd('convert');
            console.log('Operation complete.');
        }
    );
});
