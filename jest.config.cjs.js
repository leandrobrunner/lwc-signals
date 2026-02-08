const baseConfig = require("./jest.config.js");

module.exports = {
  ...baseConfig,
  displayName: "CommonJS Build",
  collectCoverageFrom: ["dist/index.cjs"],
  moduleNameMapper: {
    "^c/signals$": "<rootDir>/dist/index.cjs",
  },
};
