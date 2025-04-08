/**
 * @typedef {import('prettier').Config} Config
 * @see https://prettier.io/docs/configuration
 */

/** @type {Config} */
export default {
  plugins: [
    // Order of plugins is important!
    // See https://github.com/electrovir/prettier-plugin-multiline-arrays?tab=readme-ov-file#compatibility
    'prettier-plugin-packagejson',
    'prettier-plugin-jsdoc',
  ],

  // built-in options
  semi: false,
  singleQuote: true,

  // prettier-plugin-jsdoc
  tsdoc: true,
}
