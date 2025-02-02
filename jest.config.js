const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

module.exports = {
  ...jestConfig,
  collectCoverageFrom: ["force-app/main/default/lwc/**/*.js"],
};
