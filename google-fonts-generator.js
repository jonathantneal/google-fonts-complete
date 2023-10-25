// api-response.json retrieved from: https://www.googleapis.com/webfonts/v1/webfonts?fields=items(category%2Cfamily%2ClastModified%2Csubsets%2Cvariants%2Cversion)&key={YOUR_API_KEY}
// alternatively available from: https://developers.google.com/apis-explorer/?hl=en_US#p/webfonts/v1/webfonts.webfonts.list?fields=items(category%252Cfamily%252ClastModified%252Csubsets%252Cvariants%252Cversion)&_h=3&

const fs = require('fs');

const utils = require('./utils');
const fonts = require('./api-response.json');
const googleFonts = require('./google-fonts.json');


console.time('convert');

const actualizedFonts = process.argv[2]
    ? require(`./${process.argv[2]}`)
    : fonts;

Promise.all([
    utils.convertFontsOptions(
        actualizedFonts,
        ({ family, variant }) => {
            return `/css?subset=latin-ext&family=${family.replace(/\s/g, '+')}:${variant}`;
        }
    ),
    utils.convertFontsOptions(
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
        JSON.stringify(
            utils.getSortedObject({
                ...googleFonts,
                ...combinedResults
            }),
            null,
            '\t'
        ),
        function() {
            console.timeEnd('convert');
            console.log('Operation complete.');
        }
    );
});
