const findings = require('./helpers/findings');
const { prepareToolkitStaticData } = require('./helpers/prepare-toolkit-static');

module.exports = async function globalSetup() {
  findings.reset();
  prepareToolkitStaticData();
};
