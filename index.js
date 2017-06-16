let models = require("express-cassandra");
let EUtils = require("ethereumjs-util");
let EC = require("@ties-network/db-sign");
var rp = require('request-promise-native');
var config = require('./config');

//Tell express-cassandra to use the models-directory, and
//use bind() to load the models using cassandra configurations.
function connectToDataBase() {
	return new Promise(function(resolve, reject){
		models.setDirectory(__dirname + '/models').bind(
			{
				clientOptions: {
					contactPoints: [config.connection.address],
					protocolOptions: {port: config.connection.port},
					keyspace: config.connection.keyspace,
					queryOptions: {consistency: models.consistencies.one},
					authProvider: new models.driver.auth.DsePlainTextAuthProvider(config.connection.login, config.connection.password)
				},
				ormOptions: {
					//If your keyspace doesn't exist it will be created automatically
					//using the default replication strategy provided here.
					defaultReplicationStrategy: {
						class: 'SimpleStrategy',
						replication_factor: 1
					},
					migration: 'safe',
					createKeyspace: true
				}
			},
			function (err) {
				if (err)
					reject(err);
				else {
                    console.log(models.timeuuid());
					resolve();
                }
			}
		)
	});
}

models.pendingConnect = connectToDataBase();

function recoverWallet(phrase){
	//As in https://github.com/paritytech/parity/blob/master/js/src/api/local/ethkey/worker.js
	let hashed = EUtils.sha3(phrase);

	for(var i=0; i<16384; ++i)
	   hashed = EUtils.sha3(hashed);

    while(true){
	   	hashed = EUtils.sha3(hashed);
		if (EUtils.isValidPrivate(hashed)) {
			// No compression, slice out last 64 bytes
        	const publicBuf = EUtils.privateToPublic(hashed);
			const address = EUtils.publicToAddress(publicBuf);

			if (address[0] !== 0) {
 				continue;
        	}

        	const wallet = {
				secret: hashed,
  				public: publicBuf,
  				address: EUtils.bufferToHex(address)
			};

			return wallet;
		}
    }
}

const c_db_api = 'http://mock.db.ties.network/db/';
let currentUser = null;
let currentUserWallet = null;

async function currentUserFromRecoveryPhrase(recoveryPhrase){
	currentUserWallet = EC.recoverWallet(recoveryPhrase);
	currentUser = await models.instance.User.findAsync({__address: currentUserWallet.address}, {raw: true});
	return currentUser;
}

async function saveUser(){
	if(!currentUser)
		throw new Error("current user is not set!");

    return saveObject('ties_user', currentUser);
}

async function saveRating(rating){
	return saveObject('ties_rating', rating);
}

async function saveObject(table, object, del) {
    if(!currentUserWallet)
        throw new Error("current user is not set!");
    if(!object.__address)
    	throw new Error("object should contain at least __address property!");

    EC.signMessage(object, currentUserWallet.secret);

    let result = await rp({
        method: del ? 'DELETE' : 'POST',
        uri: c_db_api + table,
        body: object,
        json: true // Automatically parses the JSON string in the response
    });

    return result;
}

async function saveModel(model, del) {
	let table = model.table_name;
	if(!table)
		throw new Error('The first parameter should be a model object!');
	return saveObject(table, model, del);
}

module.exports = {
	models: models,
    connectToDataBase: connectToDataBase,
	currentUserFromRecoveryPhrase: currentUserFromRecoveryPhrase,
    saveObject: saveObject,
    saveModel: saveModel,
	saveUser: saveUser,
	saveRating: saveRating,

	get currentUser() {
		return currentUser;
	},

	set currentUser(cu){
		currentUser = cu;
	},

	get currentUserWallet() {
		return currentUserWallet;
	}
};

