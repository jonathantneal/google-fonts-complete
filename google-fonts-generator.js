// api-response.json retrieved from: https://www.googleapis.com/webfonts/v1/webfonts?fields=items(category%2Cfamily%2ClastModified%2Csubsets%2Cvariants%2Cversion)&key={YOUR_API_KEY}
// alternatively available from: https://developers.google.com/apis-explorer/?hl=en_US#p/webfonts/v1/webfonts.webfonts.list?fields=items(category%252Cfamily%252ClastModified%252Csubsets%252Cvariants%252Cversion)&_h=3&

var exports = {};
var fonts = require('./api-response.json');
var fs = require('fs');
var http = require('http');
var postcss = require('postcss');
var postcssProcessor = postcss();
var promise = Promise.resolve();
var userAgents = require('./user-agents.json');

function getSortedObject(object) {
	var sortedObject = {};

	Object.keys(object).sort().forEach(function (key) {
		if (object[key] instanceof Array || typeof object[key] !== 'object') {
			sortedObject[key] = object[key];
		} else {
			sortedObject[key] = getSortedObject(object[key]);
		}
	});

	return sortedObject;
}

function fontToPath(family, variant) {
	return '/css?family=' + family.replace(/\s/g, '+') + ':' + variant;
}

function eachFont(font) {
	var family = font.family;
	var variants = font.variants;

	delete font.family;
	delete font.variants;

	font.variants = {};

	exports[family] = font;

	variants.forEach(function (variant) {
		var host = 'fonts.googleapis.com';
		var path = fontToPath(family, variant);

		Object.keys(userAgents).forEach(function (format) {
			var userAgent = userAgents[format];

			var options = {
				host: host,
				path: path,
				headers: {
					'User-Agent': userAgent
				}
			};

			promise = promise.then(function () {
				return new Promise(function (resolve, reject) {
					function callback(response) {
						var css = '';

						response.on('data', function (data) {
							css += data;
						});

						response.on('end', function (end) {
							if (response.statusCode === 200) {
								postcssProcessor.process(css).then(function (result) {
									result.root.eachAtRule('font-face', function (rule) {
										var fontStyle = 'normal';
										var fontWeight = '400';

										rule.eachDecl('font-weight', function (decl) {
											fontWeight = decl.value;
										});

										rule.eachDecl('font-style', function (decl) {
											fontStyle = decl.value;
										});

										font.variants[fontStyle] = font.variants[fontStyle] || {};
										font.variants[fontStyle][fontWeight] = font.variants[fontStyle][fontWeight] || {
											local: [],
											url: {}
										};

										rule.eachDecl('src', function (decl) {
											postcss.list.comma(decl.value).forEach(function (value) {
												value.replace(/(local|url)\((.+?)\)/g, function (match, type, path) {
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
				});
			});
		});
	});

	return font;
}

function oncomplete() {
	fs.writeFile('google-fonts.json', JSON.stringify(getSortedObject(exports), null, '\t'), function () {
		console.log('Operation complete.');
	});
}

fonts.forEach(eachFont);

promise.then(oncomplete);
