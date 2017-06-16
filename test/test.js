/**
 * Created by Dukei on 14.06.2017.
 */

var assert = require('assert');
var Client = require('../index.js');

describe('Ties Client Basic functions', function() {
    describe('cryptography', function() {
        it('should user restore from phrase', async function() {
            this.timeout(5000);
            await Client.models.pendingConnect;
            let wallet = await Client.currentUserFromRecoveryPhrase('crunchy protozoan magazine punctured unicycle overrate antacid jokester salami platypus fracture mute');
            assert.ok(Client.currentUserWallet.address == '0x00dbD017A900258A242599624781f7423969c671'.toLowerCase());
        });

        it('should delete user', async function() {
            await Client.saveObject('ties_user', {__address: Client.currentUserWallet.address}, true);
            let users = await Client.models.instance.User.findAsync({__address: Client.currentUserWallet.address}, {raw: true});
            assert.ok(!users[0]);
        });

        it('should create user', async function() {
            await Client.saveObject('ties_user', {
                __address: Client.currentUserWallet.address,
                name: 'Test Dmitry Kochin',
                description: "The CTO of Ties.Network",
                keywords: ['blockchain', 'network', 'smart contract', 'cryptocurrency', 'token', 'programming']
            });
            let users = await Client.models.instance.User.findAsync({__address: Client.currentUserWallet.address}, {raw: true});
            let user = users[0];
            assert.ok(user && user.name == 'Test Dmitry Kochin');
        });

    });
});
