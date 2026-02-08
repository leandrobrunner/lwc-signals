const baseConfig = require("./jest.config.js");

module.exports = {
  ...baseConfig,
  displayName: "ESM Build",
  collectCoverageFrom: ["dist/index.js"],
  moduleNameMapper: {
    "^c/signals$": "<rootDir>/dist/index.js",
  },
};
