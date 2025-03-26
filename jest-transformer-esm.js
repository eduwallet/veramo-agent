export default {
    process(src, filename) {
      if (filename.endsWith('crypto-ld/lib/index.js')) {
        // Return the source wrapped as an ES Module
        return {
          code: `export * from '${filename}';`,
        };
      }
      return src;  // Return the original source for all other files
    },
  };
  