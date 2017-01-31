var
	path = require('path'),
	fs = require('fs'),
	helper = require('./util/config-helper'),
	SnapshotPlugin = require('./util/SnapshotPlugin');

module.exports = function(config, opts) {
	if(!opts.framework) {
		// Update HTML webpack plugin to mark it as snapshot mode for the isomorphic template
		var htmlPlugin = helper.getPluginByName(config, 'HtmlWebpackPlugin');
		if(htmlPlugin) {
			htmlPlugin.options.snapshot = true;
		}
	}

	// Include plugin to attempt generation of v8 snapshot binary if V8_MKSNAPSHOT env var is set
	config.plugins.push(new SnapshotPlugin({
		target: (opts.framework ? 'enact.js' : 'main.js')
		// Disabled temporarily until effectiveness is proven
		//append: (opts.framework ? '\nenact_framework.load();\n' : undefined)
	}));
};
