let BN = require('bignumber.js');

var zero = new BN(0);
var negative1 = new BN(-1);
var tenPower18 = new BN('1000000000000000000');

function formatEther(wei, options) {
    if(!(wei instanceof BN))
        wei = new BN(wei.toString());

    if (!options) { options = {}; }

    var negative = wei.lt(zero);
    if (negative) { wei = wei.mul(negative1); }

    let fractionBN = wei.mod(tenPower18);

    var fraction = fractionBN.toString(10);
    while (fraction.length < 18) { fraction = '0' + fraction; }

    if (!options.pad) {
        fraction = fraction.match(/^([0-9]*[1-9]|0)(0*)/)[1];
    }

    var whole = wei.sub(fractionBN).div(tenPower18).toString(10);

    if (options.commify) {
        whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    }

    var value = whole + '.' + fraction;

    if (negative) { value = '-' + value; }

    return value;
}

module.exports = {
    formatEther: formatEther
};