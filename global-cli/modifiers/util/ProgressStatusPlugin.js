var
	readline = require('readline'),
	chalk = require('chalk'),
	webpack = require('webpack'),
	cliSpinner = require('cli-spinner');

function formatMessage(value, width, padding) {
	var end = width-padding;
	var out = ' '.repeat(padding) + chalk.bold('%s ' + Math.round(value.percent*100) + '%  ')
			+ value.message.charAt(0).toUpperCase() + value.message.substring(1);

	if(value.details) {
		out += ': ' + value.details;
	}

	if(out.length-1>end) {
		out = out.substring(0, end);
	}
	out += ' '.repeat(end-out.length-1) + '\n';
	return out;
}

function ProgressStatusPlugin(options) {
	this.options = options || {};
	this.options.throttle = this.options.throttle || 60;
	this.options.padding = this.options.padding || 8;
}

ProgressStatusPlugin.prototype.apply = function(compiler) {
	var opts = this.options;
	var width = process.stdout.columns;
	var spinner;

	if(!process.stdout.isTTY || process.env.CI) return;

	var update = function(value) {
		if(value.percent<1) {
			var msg = formatMessage(value, width, opts.padding);
			if(!spinner) {
				spinner = new cliSpinner.Spinner(msg);
				spinner.onTick = function(text) {
					readline.moveCursor(spinner.stream, 0, -1);
					readline.cursorTo(spinner.stream, 0, null);
					spinner.stream.write(text);
				}
				spinner.clearLine = function(stream) {
					readline.moveCursor(spinner.stream, 0, -1);
					readline.cursorTo(spinner.stream, 0, null);
					readline.clearScreenDown(stream);
				}
				spinner.setSpinnerString(7);
				spinner.setSpinnerDelay(opts.throttle);
				spinner.start();
			} else {
				spinner.setSpinnerTitle(msg);
			}
		} else if(spinner) {
			spinner.stop(true);
		}
	};

	compiler.apply(new webpack.ProgressPlugin(function(percent, message, extra1, extra2) {
		var details = extra1;
		if(extra1 && extra2) {
			details += ', ' + extra2;
		}
		update({
			percent: percent,
			message: message,
			details: details
		});
	}));

	compiler.plugin('compilation', function(compilation) {
		compilation.plugin('prerender-chunk', function() {
			update({
				percent: 0.885,
				message: 'Prerendering chunk to HTML'
			});
		});
		compilation.plugin('prerender-localized', function(prerender) {
			update({
				percent: 0.885,
				message: 'Prerendering chunk to HTML',
				details: prerender.locale + ' locale'
			});
		});
	});

	compiler.plugin('v8-snapshot', function() {
		update({
			percent: 0.97,
			message: 'Generating v8 snapshot blob'
		});
	});
};

module.exports = ProgressStatusPlugin;
