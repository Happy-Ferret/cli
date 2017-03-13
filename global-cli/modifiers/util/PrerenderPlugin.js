var
	path = require('path'),
	fs = require('fs'),
	chalk = require('chalk'),
	requireFromString = require('require-from-string');

// Determine if it's a NodeJS output filesystem or if it's a foreign/virtual one.
function isNodeOutputFS(compiler) {
	return (compiler.outputFileSystem
			&& compiler.outputFileSystem.constructor
			&& compiler.outputFileSystem.constructor.name
			&& compiler.outputFileSystem.constructor.name === 'NodeOutputFileSystem');
}

function PrerenderPlugin(options) {
	this.options = options || {};
	this.options.chunk = this.options.chunk || 'main.js';
	this.options.ilibChunk = this.options.ilibChunk || 'ilib-assist.js';
}
module.exports = PrerenderPlugin;
PrerenderPlugin.prototype.apply = function(compiler) {
	var opts = this.options;
	var src, ilibAssist;

	compiler.plugin('compilation', function(compilation) {
		if(isNodeOutputFS(compiler)) {
			compilation.plugin('chunk-asset', function(chunk, file, callback) {
				if(file === opts.chunk) {
					src = compilation.assets[opts.chunk].source();
				} else if(file === opts.ilibChunk) {
					ilibAssist = compilation.assets[opts.ilibChunk].source();
				}
				callback && callback();
			});
			compilation.plugin('html-webpack-plugin-after-html-processing', function(params, callback) {
				var appFile = path.join(compiler.context, compiler.options.output.path, opts.chunk);

				// Attempt to resolve 'react-dom/server' relative to the project itself with internal as fallback
				var ReactDOMServer;
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
					if(params.plugin.options.externalFramework) {
						// Add external Enact framework filepath if it's used
						src = src.replace(/require\(["']enact_framework["']\)/g, 'require("' + params.plugin.options.externalFramework +  '")');
						ilibAssist = ilibAssist.replace(/require\(["']enact_framework["']\)/g, 'require("' + params.plugin.options.externalFramework +  '")');
					}
					ilibAssist = ilibAssist.replace(/window\["webpackJsonpApp"\]/g, 'global.webpackJsonpApp').replace('installedChunks[chunkId] = [callback];',
							'installedChunks[chunkId] = [callback]; require(__webpack_require__.p + "" + chunkId + "." + ({"1":"main"}[chunkId]||chunkId) + ".js"); return;')
							.replace('function $L(str) {', 'function $L(str) { return "_$L(" + encodeURIComponent(JSON.stringify(str)) + ")";');
					requireFromString(ilibAssist, opts.ilibChunk);
					var App = requireFromString(src, opts.chunk);
					var code = ReactDOMServer.renderToStaticMarkup(App['default'] || App);
					code = code.replace(/>[^<]+</g, function(match) {
						return match.replace(/_\$L\(([^)]*)\)/g, function(m, val) {
							return '<script type="text/javascript">document.write($L(' + decodeURIComponent(val) + '));</script>';
						});
					}).replace(/_\$L\(([^)]*)\)/g, function(m, val) {
						return JSON.parse(decodeURIComponent(val));
					});

					var content = '<script type="text/javascript" src="ilib-assist.js"></script>\n\t\t' +
							'<div id="root">' + code + '</div>';
					params.html = params.html.replace(/<script[^>]*ilib-assist.js[^>]*><\/script>/g, '')
							.replace(/['"]ilib-assist.js['"],*/g, '').replace('<div id="root"></div>', content);
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
};
