var _ = require("lodash");
var defaults = require("./default.js");

module.exports = _.merge({}, defaults);

module.exports.setConfig = function (config){
    if(typeof(config) == 'string'){
        config = require("./config_" + config + ".js");
    }
    _.merge(module.exports, config);
}