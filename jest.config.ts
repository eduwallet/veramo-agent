module.exports =  {
  preset: 'ts-jest',
  testEnvironment: "node",
//  setupFiles: ['./src/jest.setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  transform: {
    "^.+\.(ts|tsx)?$": ["ts-jest",{
      tsconfig: 'tsconfig.test.json',
      useESM: true 
    }],
    //'crypto-ld/lib/index\\.js$': '<rootDir>/jest-transformer-esm.js',  // Use the custom transformer for all JS files
  },
  transformIgnorePatterns: [
    "/node_modules/(?!crypto-ld|json-ld-signatures)" // Transform 'crypto-ld'
  ],
  moduleDirectories: ['node_modules', 'src'],
  moduleNameMapper: {
//    '^@(.*)/dist/(.*)$': '<rootDir>/node_modules/$1/dist/$2', // Match specific dist paths for packages
//    '^@(.*)/(.*)$': '<rootDir>/node_modules/$1/$2', // Handle other package imports
    '^ipaddr.js$': 'ipaddr.js',
    '^asn1.js$': 'asn1.js',
    '^bn.js$': 'bn.js',
    '^hash.js$': 'hash.js',
    '^sha.js$': 'sha.js',
    '^factory.ts$': '<rootDir>/node_modules/factory.ts',
    '^./CryptoLD.js$': '<rootDir>/node_modules/crypto-ld/lib/CryptoLD.js',
    '^crypto-ld$': 'crypto-ld', //<rootDir>/node_modules/crypto-ld/lib/index.js',
    '^jsonld-signatures$': 'jsonld-signatures',
    '^@transmute/did-key.js$': '<rootDir>/node_modules/@transmute/did-key.js',
    '^(.*)\\.(js|jsx|ts|tsx)$': '$1', // Ensure that .js, .jsx, .ts, .tsx are handled correctly
  },
};
