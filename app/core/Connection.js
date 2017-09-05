/**
 * Created by Dukei on 03.07.2017.
 */

const models = require("express-cassandra");
const config = require('../../config');
const EC = require("@ties-network/db-sign");
const EUtils = EC.EU;
const rp = require('request-promise-native');

let transactionData; //Info about outgoing transaction
let connection; //The connection
let blockchain; //connection to blockchain

//Tell express-cassandra to use the models-directory, and
//use bind() to load the models using cassandra configurations.
async function connectToDataBase() {
    return await new Promise(function(resolve, reject){
        models.setDirectory(__dirname + '/../../models').bind(
            {
                clientOptions: {
                    contactPoints: [config.connection.address],
                    protocolOptions: {port: config.connection.port},
                    keyspace: config.connection.keyspace,
                    queryOptions: {consistency: models.consistencies.one},
                    authProvider: new models.driver.auth.DsePlainTextAuthProvider(config.connection.login, config.connection.password)
                },
/*                ormOptions: {
                    defaultReplicationStrategy: {
                        class: 'NetworkTopologyStrategy',
                        DC1: '1'
                    },
                    migration: 'safe',
                    createKeyspace: false
                }*/
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

async function connectToBlockchain(){
    const sign = require('ethjs-signer').sign;
    const SignerProvider = require('ethjs-provider-signer');

    const provider = new SignerProvider(config.blockchain.host, {
        signTransaction: async (rawTx, cb) => {
            if(!transactionData)
                return cb('You should perform transactions in connection.makeTransactions block!');

            try {
                let gas = await blockchain.web3.eth.estimateGasPromise(rawTx);
                rawTx.gas = gas;
            }catch(e){
                cb("Could not estimate gas: not enough funds or transaction will fail with the current parameters");
                return;
            }

            try {
                let secret = await (connection.callback)(transactionData.description);
                if(secret) {
                    cb(null, sign(rawTx, EUtils.bufferToHex(secret)));
                }else{
                    cb('User cancelled entering the password');
                }
            }catch(e){
                cb(e && (e.message || e));
                return;
            }
        },
        accounts: (cb) => cb(null, [connection.wallet.address]),
    });

    blockchain = new EC.BlockChain(provider);
    await blockchain.connect();
}

class Connection {
    constructor() {
        if (connection)
            throw new Error('The connection should be created only once!');
        connection = this; //The sort of singleton
    }

    async connect() {
        this.connectionPromises = [];
        this.connectionPromises[0] = connectToDataBase();
        this.connectionPromises[1] = connectToBlockchain();
        await Promise.all(this.connectionPromises);
    }

    get DB() {
        return models;
    }

    get BC() {
        return blockchain;
    }

    get User() {
        return require('./User');
    }

    get Project() {
        return require('./Project');
    }

    get Wallet() {
        return require('./Wallet');
    }

    get Invoice() {
        return require('./Invoice');
    }

    set signingWallet(wallet) {
        this.wallet = wallet;
    }

    /**
     * @param cb - async function confirmCallback(description) returns string password
     */
    set confirmCallback(cb) {
    	let self = this;
        self.callback = async function (description) {
            if (transactionData.secret)
                return transactionData.secret;

            let pass = await cb(description);
            if(pass) {
                if (self.wallet.password !== pass)
                    throw new Error('Invalid password');

                transactionData.secret = self.wallet.secret;
                return transactionData.secret;
            }else{
                //Cancelled entering the password
                return null;
            }
        }
    }

    setConfig(_config) {
        config.setConfig(_config);
    }

    setUser(user){
        this.user = user;
        this.signingWallet = user.wallet;
        return user;
    }

    async createUserNew(){
        let user = await this.User.createNew();
        return this.setUser(user);
    }

    async createUserDecrypt(encrypted_json_str, password){
        let user = await this.User.createDecrypt(encrypted_json_str, password);
        return this.setUser(user);
    }

    async createUserFromPrivateKey(phraseOrHexpk){
        let user = await this.User.createFromPrivateKey(phraseOrHexpk);
        return this.setUser(user);
    }

    /**
     *
     * @param payload - async function payload()
     * @param description - string description of the transaction to be shown to user when prompting for confirmation
     * @returns [  {tx => transaction hash, string,
     *              logs => array of trigger events,
     *              receipt => receipt object}
     *          ]
     */
    async makeTransactions(payload, description) {
        if (transactionData)
            throw new Error('There is already transaction in progress: ' + transactionData.description);
        if (!this.wallet)
            throw new Error('Set signingWallet first');
        if (!this.callback)
            throw new Error('Set confirmCallback first');

        transactionData = {
            description: description,
            secret: null
        };

        try {
            let transactions = await payload();
            return transactions;
        }finally{
            transactionData = null;
        }
    }

    async saveObject(table, object, del) {
        if (!this.wallet)
            throw new Error("Set signingWallet first");
        if (!object.__address)
            throw new Error("object should contain at least __address property!");

        EC.signMessage(object, this.wallet.secret);

        let result = await rp({
            method: del ? 'DELETE' : 'POST',
            uri: config.tiesdb.host + 'db/' + table,
            body: JSON.parse(EC.messageToJson(object)),
            json: true // Automatically parses the JSON string in the response
        });

        if(!result.ok) {
            console.log("Error saving object: ", result);
            throw new Error(result.error || 'Unknown error');
        }

        return result;
    }

    async saveModel(model, del) {
        let table = model.table_name;
        if (!table)
            throw new Error('The first parameter should be a model object!');
        return this.saveObject(table, model, del);
    }

    async _searchObjects(table, query) {
        if (!this.wallet)
            throw new Error("Set signingWallet first");

        query.__address = this.wallet.address;
        EC.signMessage(query, this.wallet.secret);

        let result = await rp({
            method: 'POST',
            uri: config.tiesdb.host + 'search/' + table,
            body: query,
            json: true // Automatically parses the JSON string in the response
        });

        if(!result.ok)
            throw new Error(result.error || 'Unknown error querying DB');

        return result.result;
    }

    static getModels() {
        if (Connection.getModels.models)
            return Connection.getModels.models;

        let glob = require('glob')
            , path = require('path');
        let models = [];

        glob.sync(path.join(__dirname, '../../models/*Model.js')).forEach(function (file) {
            let model = require(path.resolve(file));
            let name = path.basename(file, '.js');
            model.name = name.substr(0, name.length-5);
            if (!model.table_name) {
                model.table_name = model.name.toLowerCase();
            }
            models.push(model);
        });
        return Connection.getModels.models = models;
    }

    static getModel(table) {
        return Connection.getModels().filter(m => m.table_name === table)[0];
    }

    async searchObjects(table, query) {
        let model = Connection.getModel(table);
        if (!model)
            throw new Error('Can not find model for table ' + table);
        let key = model.key[0];

        let result = await this._searchObjects(table, query);
        if (result.ok === false) {
            let body = JSON.stringify(result._body);
            let e = new Error();
            e.body = body;
            e.message = body.error.root_cause[0].reason;
            throw e;
        }

        let promises = [];
        for (let i = 0; i < result.hits.hits.length; ++i) {
            let hit = result.hits.hits[i], keyvals;
            if (Array.isArray(key)) {
                let values = JSON.parse(hit._id);
                keyvals = _.object(key, values)
            } else {
                keyvals = {[key]: hit._id};
            }
            promises.push(models.instance[model.name].findOneAsync(keyvals, {raw: true}));
        }

        let rows = promises.length ? await Promise.all(promises) : promises;
        return rows;
    }

    async invitationRedeem(code, address){
        let result = await rp({
            method: 'POST',
            uri: config.tiesdb.host + 'invite/redeem',
            body: {code: code, address: address},
            json: true // Automatically parses the JSON string in the response
        });

        if(!result.ok) {
            throw new Error(result.error || 'Unknown error');
        }

        return result.status;
    }

    get Chat() {
        return require('../chat');
    }

    getTxUrl(txhash){
        return `https://kovan.etherscan.io/tx/${txhash}`;
    }

    getAddressUrl(address){
        return `https://kovan.etherscan.io/address/${address}`;
    }

    get utils() {
        return require('../util');
    }
}

module.exports = new Connection();
