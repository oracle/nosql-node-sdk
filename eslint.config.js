const {
    defineConfig,
} = require('eslint/config');

const globals = require('globals');
const _import = require('eslint-plugin-import');
const js = require('@eslint/js');

const config0 = {
    languageOptions: {
        globals: {
            ...globals.node,
        },
        'ecmaVersion': 2022,
        'sourceType': 'module',
        parserOptions: {},
    },
    extends: [ js.configs.recommended ],
    rules: {
        'indent': ['error', 4],
        'linebreak-style': ['error', 'unix'],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'no-fallthrough': 'off',
        'no-console': 'off',
        'import/no-unresolved': ['error', { commonjs: true }]
    },
    plugins: {
        import: _import,
    }
};

module.exports = defineConfig([{
    files : [ 'test/unit/**/*.js' ],
    ...config0,
    languageOptions: {
        ...config0.languageOptions,
        globals: {
            ...globals.node,
            ...globals.mocha
        }
    }
}, {
    files : [ 'lib/**/*.js', 'test/**/*.js'],
    ...config0
}]);
