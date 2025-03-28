export default {
    process(src, filename) {
      //if (filename.endsWith('crypto-ld/lib/index.js')) {
        // Return the source wrapped as an ES Module
        return {
          code: `import * as mod from '${filename}'; export default mod;`,
        };
      //}
      //return src;  // Return the original source for all other files
    },
  };
  