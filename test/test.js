/**
 * Created by Dukei on 14.06.2017.
 */

var assert = require('assert');
var Client = require('../index.js');

async function sleep(tm) {
    return new Promise(resolve => setTimeout(resolve, tm));
}

describe('Ties Client Basic functions', function() {
    before(async function(){
        this.timeout(5000);
        Client.setConfig('test');
        await Client.connect();
    });

    describe('cryptography', function() {
        let user;
        before(async function(){
            user = await Client.User.createFromPrivateKey('crunchy protozoan magazine punctured unicycle overrate antacid jokester salami platypus fracture mute');
            user.wallet.setPassword('123456');
            Client.signingWallet = user.wallet;
            Client.confirmCallback = async function(description) {
                console.log("Confirming transaction: " + description);
                await sleep(5000);
                console.log("User confirmed with password: 123456");
                return "123456";
            }
        });

        it('should user restore from phrase', async function() {
            assert.ok(user.wallet.address == '0x00dbD017A900258A242599624781f7423969c671'.toLowerCase());
        });

        it('can check user balance', async function() {
            let val = await user.getBalance();
            assert.ok(val.gt(0));
        });

        it('can check user deposit', async function() {
            this.timeout(60000); //Waiting a minute for a transaction confirmation
            let prevval = await user.getDeposit();
            await user.register();
            let val = await user.getDeposit();
            assert.ok(val.gt(prevval));
        });

        it('should delete user', async function() {
            await user.deleteFromDB();
            let _user = await Client.User.createFromDB(user.wallet.address);
            assert.ok(!_user.isLoaded());
        });

        it('should create user', async function() {
            user.user = {
                __address: user.wallet.address,
                name: 'Test Dmitry Kochin',
                description: "The CTO of Ties.Network",
                keywords: ['blockchain', 'network', 'smart contract', 'cryptocurrency', 'token', 'programming']
            };
            await user.saveToDB();
            let _user = await Client.User.createFromDB(user.wallet.address);
            assert.ok(_user.isLoaded() && _user.user.name == 'Test Dmitry Kochin');
        });
    });
});
