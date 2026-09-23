const Module = require('module');
const orig = Module.prototype.require;
Module.prototype.require = function (id) {
  if (typeof id === 'string' && (id === 'server-only' || id.includes('server-only'))) return {};
  return orig.apply(this, arguments);
};
