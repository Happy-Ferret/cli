var
	path = require('path'),
	fs = require('fs'),
	chalk = require('chalk'),
	requireFromString = require('require-from-string'),
	exists = require('path-exists').sync,
	FileXHR = require('./FileXHR');

require('console.mute');

// Determine if it's a NodeJS output filesystem or if it's a foreign/virtual one.
function isNodeOutputFS(compiler) {
	return (compiler.outputFileSystem
			&& compiler.outputFileSystem.constructor
			&& compiler.outputFileSystem.constructor.name
			&& compiler.outputFileSystem.constructor.name === 'NodeOutputFileSystem');
}

function findLocales(context, target) {
	if(target === 'tv') {
		return JSON.parse(fs.readFileSync(path.join(__dirname, 'locales-tv.json'), {encoding: 'utf8'})).paths;
	} else if(target === 'signage') {
		return JSON.parse(fs.readFileSync(path.join(__dirname, 'locales-signage.json'), {encoding: 'utf8'})).paths;
	} else if(target === 'used') {
		return localesInManifest(path.join(context, 'resources', 'ilibmanifest.json'));
	} else if(target === 'all') {
		return localesInManifest('node_modules/@enact/i18n/ilibmanifest');
	} else {
		return target.replace(/-/g, '/').split(',');
	}
}

function localesInManifest(manifest, includeParents) {
	try {
		var meta = JSON.parse(fs.readFileSync(manifest, {encoding:'utf8'}).replace(/-/g, '/'));
		var locales = [];
		var curr, name, index;
		for(var i=0; meta.files && i<meta.files.length; i++) {
			if(includeParents) {
				for(curr = path.dirname(meta.files[i]); curr && curr !== '.'; curr = path.dirname(curr)) {
					if(locales.indexOf(curr) === -1 && (curr.length === 2 || curr.indexOf('/') === 2)) {
						locales.push(curr);
					}
				}
			} else {
				curr = path.dirname(meta.files[i]);
				if(locales.indexOf(curr) === -1 && (curr.length === 2 || curr.indexOf('/') === 2)) {
					locales.push(curr);
				}
			}
		}
		locales.sort(function(a, b) {
			return a.split('/').length > b.split('/').length;
		});
		return locales;
	} catch(e) {
		return [];
	}
}

var htmlFiles = [];
var htmlContents = [];
function prerenderLocale(compilation, html, locale, ReactDOMServer, src) {
	var locStr = locale.replace(/\//g, '-');
	global.publicPath = path.relative(path.join('resources', locale), '.') + '/';
	console.mute();
	var App = requireFromString(src, 'main.' + locStr + '.js');
	if(global.iLibLocale) {
		global.iLibLocale.updateLocale(locStr);
	}
	var code = ReactDOMServer.renderToString(App['default'] || App);
	console.resume();
	var i = htmlContents.indexOf(code);
	if(i>-1) {
		updateAppinfo(compilation, path.join('resources', locale, 'appinfo.json'),
				path.relative(path.join('resources', locale), htmlFiles[i]));
	} else {
		var outName = path.join('resources', locale, 'index.html');
		var outputHTML = '<div id="root">' + code + '</div>\n\t\t<script type="text/javascript">window.publicPath = "'
				+ global.publicPath + '";</script>';
		var data = html.replace('<div id="root"></div>', outputHTML);
		data = data.replace(/"([^'"]*\.(js|css))"/g, function(match, file) {
			if(!path.isAbsolute(file)) {
				return '"' + path.relative(path.join('resources', locale), file) + '"';
			} else {
				return '"' + file + '"';
			}
		});
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
}

PrerenderPlugin.prototype.apply = function(compiler) {
	var opts = this.options;
	var htmlTemplate, ReactDOMServer, src;
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
					src = compilation.assets['main.js'].source();
					if(params.plugin.options.externalFramework) {
						// Add external Enact framework filepath if it's used
						src = src.replace(/require\(["']enact_framework["']\)/g, 'require("' + params.plugin.options.externalFramework +  '")');
					}
					console.mute();
					var App = requireFromString(src, 'main.js');
					var code = ReactDOMServer.renderToString(App['default'] || App);
					console.resume();
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
	if(opts.locales) {
		compiler.plugin('after-emit', function(compilation, callback) {
			if(isNodeOutputFS(compiler) && htmlTemplate && ReactDOMServer && src) {
				FileXHR.compilation = compilation;
				global.XMLHttpRequest = FileXHR;

				var locales = findLocales(compiler.options.context, opts.locales);
				for(var i=0; i<locales.length; i++) {
					prerenderLocale(compilation, htmlTemplate, locales[i], ReactDOMServer, src);
				}
			}
			callback && callback();
		});
	}
};

module.exports = PrerenderPlugin;
