var _ = require("lodash");
var defaults = require("./default.js");
var config = require("./config_" + (process.env.NODE_ENV || "production") + ".js");
module.exports = _.merge({}, defaults, config);