// @remove-on-eject-begin
/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */
// @remove-on-eject-end

var path = require('path');
var webpack = require('webpack');
var autoprefixer = require('autoprefixer');
var LessPluginRi = require('resolution-independence');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var GracefulFsPlugin = require('graceful-fs-webpack-plugin');
var ILibPlugin = require('ilib-webpack-plugin');
var WebOSMetaPlugin = require('webos-meta-webpack-plugin');
var CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
var WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');
var PrepackWebpackPlugin = require('prepack-webpack-plugin').default;

var pkg = require(path.resolve('./package.json'));
var enact = pkg.enact || {};

// This is the development configuration.
// It is focused on developer experience and fast rebuilds.
// The production configuration is different and lives in a separate file.
module.exports = {
	// Don't attempt to continue if there are any errors.
	bail: true,
	// We use sourcemaps to allow devtools to view the original module code data
	devtool: 'cheap-module-source-map',
	// These are the "entry points" to our application.
	// This means they will be the "root" imports that are included in JS bundle.
	// The first two entry points enable "hot" CSS and auto-refreshes for JS.
	entry: {
		main: [
			// Include a few polyfills by default (Promise, Object.assign, and fetch)
			require.resolve('./polyfills'),
			// Include React performance tools for debugging/optimization testing
			require.resolve('react-addons-perf'),
			// Finally, this is your app's code
			path.resolve(pkg.main || 'index.js')
		]
	},
	output: {
		// The build output directory.
		path: path.resolve('./dist'),
		// Generated JS file names (with nested folders).
		// There will be one main bundle, and one file per asynchronous chunk.
		// We don't currently advertise code splitting but Webpack supports it.
		filename: '[name].js',
		// There are also additional JS chunk files if you use code splitting.
		chunkFilename: 'chunk.[name].js',
		// Add /* filename */ comments to generated require()s in the output.
		pathinfo: true
	},
	resolve: {
		// These are the reasonable defaults supported by the React/ES6 ecosystem.
		extensions: ['.js', '.jsx', '.json'],
		// Allows us to specify paths to check for module resolving.
		modules: ['node_modules', path.resolve('./node_modules')],
		alias: {
			// @remove-on-eject-begin
			'promise/lib/rejection-tracking': require.resolve('promise/lib/rejection-tracking'),
			'promise/lib/es6-extensions': require.resolve('promise/lib/es6-extensions'),
			'whatwg-fetch': require.resolve('whatwg-fetch'),
			'object-assign': require.resolve('object-assign'),
			// @remove-on-eject-end
			// Support ilib shorthand alias for ilib modules
			'ilib':'@enact/i18n/ilib/lib'
		}
	},
	// @remove-on-eject-begin
	// Resolve loaders (webpack plugins for CSS, images, transpilation) from the
	// directory of `enact-dev` itself rather than the project directory.
	resolveLoader: {
		modules: [
			path.resolve(__dirname, '../node_modules'),
			path.resolve('./node_modules')
		]
	},
	// @remove-on-eject-end
	module: {
		rules: [
			// First, run the linter.
			// It's important to do this before Babel processes the JS.
			{
				test: /\.(js|jsx)$/,
				enforce: 'pre',
				// @remove-on-eject-begin
				// Point ESLint to our predefined config.
				options: {
					configFile: require.resolve('eslint-config-enact'),
					cache: true,
					useEslintrc: false,
					failOnError: true
				},
				// @remove-on-eject-end
				loader: 'eslint-loader',
				include: process.cwd(),
				exclude: /node_modules/
			},
			// "file" loader makes sure those assets get copied during build
			// When you `import` an asset, you get its output filename.
			// Image filetypes get excluded to be handled by the url-loader later.
			{
				exclude: /\.(html|js|jsx|css|less|ejs|json|bmp|gif|jpe?g|png|svg)$/,
				loader: 'file-loader',
				options: {
					name: '[path][name].[ext]'
				}
			},
			// "url" loader works just like "file" loader but it also embeds
			// assets smaller than specified size as data URLs to avoid requests.
			// Assets bigger than the limit will fallback to the file-loader.
			{
				test: /\.(bmp|gif|jpe?g|png|svg)$/,
				loader: 'url-loader',
				options: {
					limit: 10000,
					name: '[path][name].[ext]'
				}
			},
			// Process JS with Babel.
			{
				test: /\.(js|jsx)$/,
				exclude: /node_modules.(?!@enact)/,
				loader: 'babel-loader',
				options: {
					// @remove-on-eject-begin
					babelrc: false,
					extends: path.join(__dirname, '.babelrc'),
					// @remove-on-eject-end
					// This is a feature of `babel-loader` for webpack (not Babel itself).
					// It enables caching results in ./node_modules/.cache/babel-loader/
					// directory for faster rebuilds.
					cacheDirectory: true
				}
			},
			// Multiple styling-support features are used together.
			// "less" loader compiles any LESS-formatted syntax into standard CSS.
			// "postcss" loader applies autoprefixer to our CSS.
			// "css" loader resolves paths in CSS and adds assets as dependencies.
			// `ExtractTextPlugin` applies the "less", "postcss" and "css" loaders,
			// then grabs the result CSS and puts it into a separate file in our
			// build process. If you use code splitting, any async bundles will still
			// use the "style" loader inside the async code so CSS from them won't be
			// in the main CSS file.
			{
				test: /\.(c|le)ss$/,
				// Note: this won't work without `new ExtractTextPlugin()` in `plugins`.
				loader: ExtractTextPlugin.extract({
					fallback: 'style-loader',
					use: [
						{
							loader: 'css-loader',
							options: {
								importLoaders: 2,
								modules: true,
								sourceMap: true,
								localIdentName: '[name]__[local]___[hash:base64:5]'
							}
						},
						{
							loader: 'postcss-loader',
							options: {
								ident: 'postcss', // https://webpack.js.org/guides/migrating/#complex-options
								plugins: () => [
									// We use PostCSS for autoprefixing only, but others could be added.
									autoprefixer({
										browsers: [
											'>1%',
											'last 4 versions',
											'Firefox ESR',
											'not ie < 9' // React doesn't support IE8 anyway.
										]
									})
								]
							}
						},
						{
							loader: 'less-loader',
							options: {
								sourceMap: true,
								// If resolution independence options are specified, use the LESS plugin.
								plugins: ((enact.ri) ? [new LessPluginRi(enact.ri)] : [])
							}
						}
					]
				})
			},
			// Expose the 'react-addons-perf' on a global context for debugging.
			// Currently maps the toolset to window.ReactPerf.
			{
				test: require.resolve('react-addons-perf'),
				loader: 'expose-loader',
				options: 'ReactPerf'
			}
		]
	},
	// Specific webpack-dev-server options
	devServer: {
		// Broadcast http server on the localhost, port 8080
		host: '0.0.0.0',
		port: 8080
	},
	// Optional configuration for polyfilling NodeJS built-ins.
	node: enact.node,
	performance: {
		hints: false
	},
	plugins: [
		// Partially evaluates the built javascript and then optimizes the code.
		// See https://prepack.io for more details.
		new PrepackWebpackPlugin({}),
		// Generates an `index.html` file with the js and css tags injected.
		new HtmlWebpackPlugin({
			// Title can be specified in the package.json enact options or will
			// be determined automatically from any appinfo.json files discovered.
			title: enact.title || '',
			inject: 'body',
			template: enact.template || path.join(__dirname, 'html-template.ejs'),
			xhtml: true
		}),
		// Make NODE_ENV environment variable available to the JS code, for example:
		// if (process.env.NODE_ENV === 'development') { ... }.
		new webpack.DefinePlugin({
			'process.env': {
				'NODE_ENV': '"development"'
			}
		}),
		// Note: this won't work without ExtractTextPlugin.extract(..) in `loaders`.
		new ExtractTextPlugin('[name].css'),
		// Watcher doesn't work well if you mistype casing in a path so this is
		// a plugin that prints an error when you attempt to do this.
		// See https://github.com/facebookincubator/create-react-app/issues/240
		new CaseSensitivePathsPlugin(),
		// If you require a missing module and then `npm install` it, you still have
		// to restart the development server for Webpack to discover it. This plugin
		// makes the discovery automatic so you don't have to restart.
		// See https://github.com/facebookincubator/create-react-app/issues/186
		new WatchMissingNodeModulesPlugin('./node_modules'),
		// Switch the internal NodeOutputFilesystem to use graceful-fs to avoid
		// EMFILE errors when hanndling mass amounts of files at once, such as
		// what happens when using ilib bundles/resources.
		new GracefulFsPlugin(),
		// Automatically configure iLib library within @enact/i18n. Additionally,
		// ensure the locale data files and the resource files are copied during
		// the build to the output directory.
		new ILibPlugin(),
		// Automatically detect ./appinfo.json and ./webos-meta/appinfo.json files,
		// and parses any to copy over any webOS meta assets at build time.
		new WebOSMetaPlugin()
	]
};
