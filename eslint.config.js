// https://docs.expo.dev/guides/using-eslint/
const path = require('path');

const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // eslint-config-expo ships a node-only import resolver, which cannot see
    // the `@/*` -> `src/*` alias from tsconfig. Route resolution through the
    // typescript resolver (absolute path, so editor cwd doesn't matter) and
    // turn import path validation on.
    settings: {
      'import/resolver': {
        typescript: {
          project: path.join(__dirname, 'tsconfig.json'),
        },
        node: true,
      },
    },
    rules: {
      'import/no-unresolved': 'error',
    },
  },
]);
