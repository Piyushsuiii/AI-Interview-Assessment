const nodeExternals = require('webpack-node-externals');
const path = require('node:path');

module.exports = (options) => ({
  ...options,
  externals: [
    nodeExternals({
      allowlist: [/^@ai-hiring-platform\//],
      modulesDir: path.resolve(__dirname, '../../node_modules'),
    }),
  ],
});
