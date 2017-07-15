/**
 * Created by Dukei on 03.07.2017.
 */

const Wallet = require('./Wallet');
const c = require('./Connection');

const TABLE_NAME = 'ties_user';

class User {


    constructor() {
        this.wallet = null;
        this.user = null;
    }

    static async createNew(){
        const user = new User();
        await user.initializeNew();
        return user;
    }

    static createFromData(row){
        const user = new User();
        user.initializeFromData(row);
        return user;
    }

    initializeNew(){
        this.wallet = Wallet.createNew();
        this.user = null;
    }

    async loadFromDB(){
        let users = await c.DB.instance.User.findAsync({__address: this.wallet.address}, {raw: true});
        this.user = users[0];
    }

    static async createDecrypt(encrypted_json_str, password){
        const user = new User();
        await user.initializeDecrypt(encrypted_json_str, password);
        return user;
    }

    async initializeDecrypt(encrypted_json_str, password){
        this.wallet = Wallet.createDecrypt(encrypted_json_str, password);
        await this.loadFromDB();
    }

    static async createFromPrivateKey(phraseOrHexpk){
        const user = new User();
        await user.initializeFromPrivateKey(phraseOrHexpk);
        return user;
    }

    async initializeFromPrivateKey(phraseOrHexpk){
        this.wallet = Wallet.createFrom(phraseOrHexpk);
        await this.loadFromDB();
    }

    static async createFromDB(address){
        const user = new User();
        await user.initializeFromDB(address);
        return user;
    }

    async initializeFromDB(address){
        this.wallet = Wallet.createFromAddress(address);
        await this.loadFromDB();
    }

    initializeFromData(row){
        this.wallet = Wallet.createFromAddress(row.__address);
        this.user = row;
    }

    async getDeposit() {
        return await c.UserRegistry.getDeposit(this.wallet.address);
    }

    async getBalance() {
        return await c.TieToken.balanceOf(this.wallet.address);
    }

    async getNativeBalance() {
        return await c.web3.eth.getBalancePromise(this.wallet.address);
    }

    async hasDeposit() {
        let val = await this.getDeposit();
        return val.gt(0);
    }

    async register() {
        const sum = 10 * Math.pow(10, 18);
        let self = this;
        await c.makeTransactions(async () => {
            console.log('Approving token transfer');
            await c.TieToken.approve(c.UserRegistryContract.address, sum, {from: self.wallet.address});
            console.log('Transferring deposit');
            await c.UserRegistry.addDeposit(sum, {from: self.wallet.address});
            console.log('Registration done');
        }, "Registration in the Ties.Network (depositing 10 TIEs)");
    }

    async saveToDB(){
        return await c.saveObject(TABLE_NAME, this.user);
    }

    async deleteFromDB(){
        return await c.saveObject(TABLE_NAME, {__address: this.wallet.address}, true);
    }

    /**
     * Checks if data from database is loaded
     * @returns {boolean}
     */
    isLoaded() {
        return !!this.user;
    }

    static async search(keyword) {
        let objects = await c.searchObjects(TABLE_NAME, {
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": keyword,
                                "type": "best_fields",
                                "fields": [
                                    "keywords",
                                    "name",
                                    "surname",
                                    "description",
                                    "country",
                                    "position",
                                    "company"
                                ]
                            }
                        }
                    ]
                }
            }
        });

        return objects.map(o => User.createFromData(o));
    }

}

module.exports = User;