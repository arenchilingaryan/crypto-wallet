const path = require('path');

const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
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
  {
    files: ['src/core/**/*.ts', 'src/core/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react-native',
                'react-native/*',
                'react-native-*',
                'expo',
                'expo-*',
                '@expo/*',
                '@react-native*',
                '@react-navigation/*',
                'react',
                'react-dom',
                '../platform/*',
                '../../platform/*',
              ],
              message:
                'src/core must stay platform-free: depend on a port from src/core/ports instead.',
            },
            {
              group: [
                '@/app/**',
                '@/components/**',
                '@/platform/**',
                '@/storage/**',
                '@/hooks/**',
                '@/utils/**',
                '@/features/**',
                '@/shared/**',
                '@/constants/**',
                '!@/constants/networks',
                '@/constants/theme',
              ],
              message:
                'src/core may only import @/core/** (and @/constants/networks): everything else belongs to a platform or the UI.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'window',
          message: 'src/core must stay platform-free.',
        },
        {
          name: 'document',
          message: 'src/core must stay platform-free.',
        },
        {
          name: 'localStorage',
          message: 'src/core must stay platform-free: use the WalletStorage port.',
        },
        {
          name: 'chrome',
          message: 'src/core must stay platform-free: use a port.',
        },
        {
          name: 'process',
          message:
            'src/core must stay platform-free: pass configuration through configureCore().',
        },
        {
          name: 'globalThis',
          message: 'src/core must stay platform-free: use a port.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ImportExpression > Literal[value=/^(react-native|expo|expo-|@expo\\/|@react-native|@react-navigation\\/|@\\/(app|components|platform|storage|hooks|utils|features|shared)\\/|@\\/constants\\/theme)/]',
          message:
            'src/core must stay platform-free, including dynamic imports: use a port from src/core/ports.',
        },
        {
          selector:
            'CallExpression[callee.name="require"] > Literal[value=/^(react-native|expo|expo-|@expo\\/|@react-native|@\\/(app|components|platform|storage|hooks|utils|features|shared)\\/)/]',
          message:
            'src/core must stay platform-free: use a port from src/core/ports.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'src/core must stay platform-free: pass configuration through configureCore().',
        },
      ],
    },
  },
]);
