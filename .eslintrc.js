module.exports = {
  parser: 'vue-eslint-parser',
  extends: [
    'eslint:recommended', // ESLintの推奨設定を適用する
    'plugin:@typescript-eslint/recommended', // TypeScriptの推奨ルールを適用する
    'plugin:prettier/recommended', // prettier.config.jsに沿わないコードをエラーにする
    'plugin:vue/recommended', // Vue.jsの推奨ルールを適用する
    'prettier/@typescript-eslint', // Prettierとのルール衝突の防止する
  ],
  parserOptions: {
    parser: '@typescript-eslint/parser',
  },
  rules: {
    '@typescript-eslint/camelcase': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-object-literal-type-assertion': 'off',
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/prefer-interface': 'off',
    'no-console': 'warn',
    'no-extra-semi': 'off',
    'vue/html-self-closing': ['error', { html: { void: 'always' } }],
    'vue/max-attributes-per-line': 'off',
  },
  globals: {
    __filename: true,
    google: true,
    require: true,
  },
  plugins: ['only-warn'],
}
