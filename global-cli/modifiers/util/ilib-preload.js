/*
 *  ilib-preload.js
 *
 *  To be able to translate strings at prerendered-html load-time, we need to
 *  be able to preload some iLib functionality in an external chunk.
 *
 */

require('@enact/i18n/src/glue');
global.iLibLocale = require('@enact/i18n/src/locale');
global.$L = require('@enact/i18n/src/$L').default;
