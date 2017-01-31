var
	path = require('path'),
	fs = require('fs'),
	chalk = require('chalk'),
	requireFromString = require('require-from-string'),
	exists = require('path-exists').sync,
	FileXHR = require('./FileXHR');

// Determine if it's a NodeJS output filesystem or if it's a foreign/virtual one.
function isNodeOutputFS(compiler) {
	return (compiler.outputFileSystem
			&& compiler.outputFileSystem.constructor
			&& compiler.outputFileSystem.constructor.name
			&& compiler.outputFileSystem.constructor.name === 'NodeOutputFileSystem');
}

function findLocales(context, target) {
	if(Array.isArray(target)) {
		return target;
	} else if(target === 'used') {
		return localesInManifest(path.join(context, 'resources', 'ilibmanifest.json'));
	} else if(target === 'all') {
		return localesInManifest('node_modules/@enact/i18n/ilibmanifest');
	}
	return [];
}

function localesInManifest(manifest) {
	try {
		var meta = JSON.parse(fs.readFileSync(manifest, {encoding:'utf8'}));
		var locales = [];
		var curr, name, index;
		for(var i=0; meta.files && i<meta.files.length; i++) {
			curr = path.dirname(meta.files[i]);
			if(locales.indexOf(curr) === -1 && curr.indexOf('zoneinfo') !== 0) {
				// Remove lower-scoped directories.
				/*for(var j=0; j<locales.length; j++) {
					if(curr.indexOf(locales[j]) === 0) {
						locales[j].splice(j, 1);
						break;
					}
				}*/
				// Put appinfo-based entries at the top of the array to reduce number
				// of appinfo files we'll need to create.
				if(meta.files.indexOf(path.join(curr, 'appinfo.json')) > -1) {
					locales.unshift(curr);
				} else {
					locales.push(curr);
				}
				
			}
		}
		return locales;
	} catch(e) {
		return [];
	}
}

function localeString(path) {
	var tokens = path.split('/');
	if(tokens.length>1) {
		return tokens[0] + '-' + tokens[tokens.length-1];
	} else {
		return path;
	}
}

var htmlFiles = [];
var htmlContents = [];
function prerenderLocale(compilation, html, locale, ReactDOMServer, App) {
	var locStr = localeString(locale);
	if(global.iLibLocale) {
		global.iLibLocale.updateLocale(locStr);
	}
	var code = ReactDOMServer.renderToString(App['default'] || App);
	var i = htmlContents.indexOf(code);
	if(i>-1) {
		updateAppinfo(compilation, path.join('resources', locale, 'appinfo.json'),
				path.relative(path.join('resources', locale), htmlFiles[i]));
	} else {
		//var outName = path.join('resources', locale, 'index.html');
		var outName = 'index.' + locStr + '.html';
		var data = html.replace('<div id="root"></div>', '<div id="root">' + code + '</div>');
		/*data = data.replace(/"([^'"]*\.(js|css))"/g, function(match, file) {
			if(!path.isAbsolute(file)) {
				return '"' + path.relative(path.join('resources', locale), file) + '"';
			} else {
				return '"' + file + '"';
			}
		});*/
		fs.writeFileSync(path.join(compilation.options.output.path, outName), data, {encoding:'utf8'});
		// add to stats
		compilation.assets[outName] = {
			size: function() { return data.length; },
			source: function() { return data; },
			updateHash: function(hash) { return hash.update(data); },
			map: function() { return null; }
		};
		updateAppinfo(compilation, path.join('resources', locale, 'appinfo.json'),
				path.relative(path.join('resources', locale), outName));
		htmlFiles.push(outName);
		htmlContents.push(code);
	}
}

function updateAppinfo(compilation, file, index) {
	var outFile = path.join(compilation.options.output.path, file);
	var appinfo = {}
	if(exists(outFile)) {
		appinfo = JSON.parse(fs.readFileSync(outFile, {encoding:'utf8'}));
	}
	appinfo.main = index;
	var data = JSON.stringify(appinfo, null, '\t');
	fs.writeFileSync(outFile, data, {encoding:'utf8'});
	// add to compilation stats
	compilation.assets[file] = {
		size: function() { return data.length; },
		source: function() { return data; },
		updateHash: function(hash) { return hash.update(data); },
		map: function() { return null; }
	};
}

function PrerenderPlugin(options) {
	this.options = options || {};
	// can be 'used', 'all', or a specific array of locales
	this.options.locales = this.options.locales || 'used';
}
module.exports = PrerenderPlugin;
PrerenderPlugin.prototype.apply = function(compiler) {
	var opts = this.options;
	var htmlTemplate, ReactDOMServer, App;
	compiler.plugin('compilation', function(compilation) {
		if(isNodeOutputFS(compiler)) {
			compilation.plugin('html-webpack-plugin-after-html-processing', function(params, callback) {
				htmlTemplate = params.html;
				var appFile = path.join(compiler.context, compiler.options.output.path, 'main.js');

				// Attempt to resolve 'react-dom/server' relative to the project itself with internal as fallback
				try {
					ReactDOMServer = require(path.join(compiler.context, 'node_modules', 'react-dom', 'server'));
				} catch(e) {
					ReactDOMServer = require('react-dom/server');
				}

				// Add fetch to the global variables
				if (!global.fetch) {
					global.fetch = require('node-fetch');
					global.Response = global.fetch.Response;
					global.Headers = global.fetch.Headers;
					global.Request = global.fetch.Request;
				}
				try {
					var src = compilation.assets['main.js'].source();
					if(params.plugin.options.externalFramework) {
						// Add external Enact framework filepath if it's used
						src = src.replace(/require\(["']enact_framework["']\)/g, 'require("' + params.plugin.options.externalFramework +  '")');
					}
					App = requireFromString(src, 'main.js');
					var code = ReactDOMServer.renderToString(App['default'] || App);
					params.html = htmlTemplate.replace('<div id="root"></div>', '<div id="root">' + code + '</div>');

					if(!global.iLibLocale && params.plugin.options.externalFramework) {
						var framework = require(params.plugin.options.externalFramework);
						global.iLibLocale = framework('@enact/i18n/src/locale');
					}
				} catch(e) {
					console.log();
					console.log(chalk.yellow('Unable to generate prerender of app state HTML'));
					console.log('Reason: ' + e.message || e);
					if(e.stack) {
						console.log(e.stack);
					}
					console.log();
					console.log('Continuing build without prerendering...');
				}
				callback && callback();
			});
		}
	});
	compiler.plugin('after-emit', function(compilation, callback) {
		if(isNodeOutputFS(compiler) && htmlTemplate && ReactDOMServer && App) {
			FileXHR.compilation = compilation;
			global.XMLHttpRequest = FileXHR;

			var locales = findLocales(compiler.options.context, opts.locales);
			for(var i=0; i<locales.length; i++) {
				prerenderLocale(compilation, htmlTemplate, locales[i], ReactDOMServer, App);
			}
		}
		callback && callback();
	});
};
