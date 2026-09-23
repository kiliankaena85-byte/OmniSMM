process.stdout.isTTY = true;
process.stderr.isTTY = true;
process.stdin.isTTY = true;
process.stdin.isRaw = false;
process.stdin.setRawMode = function(val) { return this; };

const fs = require('fs');
const path = require('path');
const Module = require('module');
const prismaPath = require.resolve('prisma/build/index.js');

process.argv = [
  process.argv[0],
  prismaPath,
  ...process.argv.slice(2)
];

const content = fs.readFileSync(prismaPath, 'utf8');
const code = content.replace(/^#!.*/, '');

const prismaModule = new Module(prismaPath, module.parent);
prismaModule.filename = prismaPath;
prismaModule.paths = Module._nodeModulePaths(path.dirname(prismaPath));

// Set require.main and process.mainModule to the compiled module
require.main = prismaModule;
process.mainModule = prismaModule;

prismaModule._compile(code, prismaPath);
