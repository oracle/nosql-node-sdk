module.exports = {
    "env": {
        "es2020": true,
        "node": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:require-path-exists/recommended"
    ],
    "parserOptions": {
        "ecmaVersion": 2018,
        "sourceType": "module"
    },
    "rules": {
        "indent": [
            "error",
            4
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ],
        "no-fallthrough": "off",
        "no-console": "off"
    },
    plugins: [
        "require-path-exists"
    ]
};
