/**
 * @see https://prettier.io/docs/configuration
 * @typedef {import('prettier').Config} Config
 */

/** @type {Config} */
export default {
  plugins: [
    // Order of plugins is important!
    // See https://github.com/electrovir/prettier-plugin-multiline-arrays?tab=readme-ov-file#compatibility
    'prettier-plugin-packagejson',
    'prettier-plugin-multiline-arrays',
  ],
  multilineArraysWrapThreshold: 1,
  semi: false,
  singleQuote: true,
}
