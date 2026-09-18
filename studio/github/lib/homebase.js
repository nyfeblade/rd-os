"use strict";

const { CONNECTOR_IDS } = require("./connectors");

const HOMEBASE = {
  audience: "any-ai-developer",
  cold_open: true,
  multi_provider: true,
  first_connector: "github",
  providers: CONNECTOR_IDS.slice(),
};

function homebaseContract() {
  return {
    audience: HOMEBASE.audience,
    cold_open: HOMEBASE.cold_open,
    multi_provider: HOMEBASE.multi_provider,
    first_connector: HOMEBASE.first_connector,
    providers: HOMEBASE.providers.slice(),
  };
}

module.exports = {
  HOMEBASE,
  homebaseContract,
};
