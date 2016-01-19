// api-response.json retrieved from: https://www.googleapis.com/webfonts/v1/webfonts?fields=items(category%2Cfamily%2ClastModified%2Cvariants%2Cversion)&key={YOUR_API_KEY}
// alternatively available from: https://developers.google.com/apis-explorer/?hl=en_US#p/webfonts/v1/webfonts.webfonts.list?fields=items%252Ffiles&_h=4

var exports = {};
var fonts = require('./api-response.json');
var fs = require('fs');
var http = require('http');
var postcss = require('postcss');
var postcssProcessor = postcss();
var promise = Promise.resolve();
var userAgents = require('./user-agents.json');

function eachFont(font) {
	var family = font.family;
	var data = {};

	exports[family] = data;

	font.variants.forEach(function (variant) {
		var host = 'fonts.googleapis.com';
		var path = '/css?family=' + family.replace(/\s/g, '+') + ':' + variant;

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

										var fontVariant = fontStyle + ':' + fontWeight;

										var fontURLs = data[fontVariant] = data[fontVariant] || {
											local: []
										};

										rule.eachDecl('src', function (decl) {
											postcss.list.comma(decl.value).forEach(function (value) {
												value.replace(/(local|url)\((.+?)\)/g, function (match, type, path) {
													path = /^(['"]).*\1$/.test(path) ? path.slice(1, -1) : path.replace(/^https?:/, '');

													if (type === 'local') {
														if (fontURLs.local.indexOf(path) === -1) {
															fontURLs.local.push(path);
														}
													} else if (type === 'url') {
														fontURLs[format] = path;
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
}

function oncomplete() {
	var string = JSON.stringify(exports, null, '\t').replace(
		/\[[\W\w]+?\]/g,
		function (match) {
			return match.replace(/[\n\t]+/g, '').replace(/,/g, ', ');
		}
	).replace(
		/(eot|svg|ttf)": /g,
		'$1":    '
	).replace(
		/(woff)": /g,
		'$1":   '
	).replace(
		/(woff2)": /g,
		'$1":  '
	);

	fs.writeFile('google-fonts.json', string, function () {
		console.log('Operation complete.');
	});
}

fonts.forEach(eachFont);

promise.then(oncomplete);
