// Recursively attempt to find a module up a parent-chain.

module.exports = function parentRequire(request) {
	var parent = module.parent;
	while(parent) {
		try {
			return parent.require(request);
		} catch(e) {
			parent = parent.parent;
		}
	}
};
