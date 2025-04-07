/**
 * @see https://prettier.io/docs/configuration
 * @typedef {import('prettier').Config} Config
 */

/** @type {Config} */
export default {
  plugins: [
    'prettier-plugin-multiline-arrays',
    'prettier-plugin-packagejson',
  ],
  multilineArraysWrapThreshold: 1,
  semi: false,
  singleQuote: true,
}
