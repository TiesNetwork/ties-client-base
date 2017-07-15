/**
 * Created by Dukei on 03.07.2017.
 */

let models = require("express-cassandra");
let EUtils = require("ethereumjs-util");
let config = require('../../config');
const Web3 = require('web3');
const web3 = new Web3();
let EC = require("@ties-network/db-sign");
let rp = require('request-promise-native');

const PromisifyWeb3 = require("../misc/promisifyWeb3.js");
PromisifyWeb3.promisify(web3);

let UserRegistryContract, TieTokenContract, UserRegistry, TieToken; //Contracts
const SignerProvider = require('ethjs-provider-signer');

let transactionData; //Info about outgoing transaction
let connection; //The connection

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

    const provider = new SignerProvider(config.blockchain.host, {
        signTransaction: (rawTx, cb) => {
            if(!transactionData)
                return cb('You should perform transactions in connection.makeTransactions block!');

            let confirmPromise = (connection.callback)(transactionData.description);
            web3.eth.estimateGas(rawTx, (error, result) => {
                if(error) {
                    cb(error);
                }else{
                    rawTx.gas = result;
                    confirmPromise.then(
                        secret => cb(null, sign(rawTx, EUtils.bufferToHex(secret))),
                        error => cb(error)
                    );
                }
            })
        },
        accounts: (cb) => cb(null, [connection.wallet.address]),
    });
    web3.setProvider(provider);

    const Contract = require('../../contracts');
    UserRegistryContract = Contract('UserRegistry', web3.currentProvider);
    TieTokenContract = Contract('TieToken', web3.currentProvider);
    [UserRegistry, TieToken] = await Promise.all([UserRegistryContract.deployed(), TieTokenContract.deployed()]);
}

class Connection{
    constructor(){
        if(connection)
            throw new Error('The connection should be created only once!');
        connection = this; //The sort of singleton
    }

    async connect(){
        this.connectionPromises = [];
        this.connectionPromises[0] = connectToDataBase();
        this.connectionPromises[1] = connectToBlockchain();
        await Promise.all(this.connectionPromises);
    }

    get DB() {
        return models;
    }

    get BC() {
        return web3;
    }

    get UserRegistry(){
        return UserRegistry;
    }

    get UserRegistryContract(){
        return UserRegistryContract;
    }

    get TieToken(){
        return TieToken;
    }

    get TieTokenContract(){
        return UserRegistryContract;
    }

    get User(){
        return require('./User');
    }

    get Wallet(){
        return require('./Wallet');
    }

    set signingWallet(wallet){
        this.wallet = wallet;
    }

    /**
     * @param cb - async function confirmCallback(description) returns string password
     */
    set confirmCallback(cb){
        this.callback = async function(description) {
            if(transactionData.secret)
                return transactionData.secret;

            let pass = await cb(description);
            if(this.wallet.password !== pass)
                throw new Error('Invalid password');

            transactionData.secret = this.wallet.secret;
            return transactionData.secret;
        }
    }

    setConfig(_config){
        config.setConfig(_config);
    }

    /**
     *
     * @param payload - async function payload()
     * @param description - string description of the transaction to be shown to user when prompting for confirmation
     * @returns {Promise.<void>}
     */
    async makeTransactions(payload, description){
        if(transactionData)
            throw new Error('There is already transaction in progress: ' + transactionData.description);
        if(!this.wallet)
            throw new Error('Set signingWallet first');
        if(!this.callback)
            throw new Error('Set confirmCallback first');

        transactionData = {
            description: description,
            secret: null
        };

        await payload();

        transactionData = null;
    }

    async saveObject(table, object, del) {
        if (!this.wallet)
            throw new Error("Set confirmCallback first");
        if (!object.__address)
            throw new Error("object should contain at least __address property!");

        EC.signMessage(object, this.wallet.secret);

        let result = await rp({
            method: del ? 'DELETE' : 'POST',
            uri: config.tiesdb.host + table,
            body: object,
            json: true // Automatically parses the JSON string in the response
        });

        return result;
    }

    async saveModel(model, del) {
        let table = model.table_name;
        if(!table)
            throw new Error('The first parameter should be a model object!');
        return this.saveObject(table, model, del);
    }

}

module.exports = new Connection();
