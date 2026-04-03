module.exports = {
	hooks: {
		readPackage,
	},
};

function readPackage(pkg, _context) {
	if (pkg.dependencies) process(pkg.dependencies);
	if (pkg.devDependencies) process(pkg.devDependencies);

	return pkg;
}

const replaceScopes = ['@idlebox', '@build-script', '@mpis'];
const standalone = ['cjke-strings'];
const localPath = '/data/DevelopmentRoot/github.com/gongt/baobao';

function process(deps) {
	for (const name in deps) {
		if (replaceScopes.some((scope) => name.startsWith(`${scope}/`))) {
			deps[name] = `link:${localPath}/${name}`;
		} else if (standalone.includes(name)) {
			deps[name] = `link:${localPath}/standalone/${name}`;
		} else if (name.startsWith('@internal/')) {
			delete deps[name];
		}
	}
}
