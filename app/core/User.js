/**
 * Created by Dukei on 03.07.2017.
 */

const Wallet = require('./Wallet');
const c = require('./Connection');
const Project = require('./Project');
const EC = require("@ties-network/db-sign");

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

    async getTieDeposit() {
        return await c.BC.Registry.getDeposit(this.wallet.address);
    }

    async getTieBalance() {
        return await c.BC.TieToken.balanceOf(this.wallet.address);
    }

    async getNativeBalance() {
        return await c.BC.web3.eth.getBalancePromise(this.wallet.address);
    }

    async hasTieDeposit() {
        let val = await this.getTieDeposit();
        return val.gt(0);
    }

    async register() {
        const sum = 10 * Math.pow(10, 18);
        let self = this;
        return await c.makeTransactions(async () => {
            console.log('Transferring deposit');
            let tx = await c.BC.TieToken.transfer(c.BC.RegistryContract.address, sum, {from: self.wallet.address});
            console.log('Registration done');
            return [tx];
        }, "Registration in the Ties.Network (depositing 10 TIEs)");
    }

    async invitationCreate() {
        if(!this.wallet.isPrivate())
            throw new Error('You can only create invites for the session user');

        const sum = 10 * Math.pow(10, 18);
        const ether = c.BC.web3.toWei(0.20, "ether");
        let  self = this;
        await c.makeTransactions(async () => {
            console.log('Issuing invitation');
            let tx = await c.BC.TieToken.transferAndPay(c.BC.InvitationContract.address, sum, "0x", {from: self.wallet.address, value: ether});
            console.log('Invitation done');
            return [tx];
        }, "Issuing invitation code (depositing 10 TIEs and 0.2 Ether for invittee)");

        return await this.invitationGetLast();
    }

    async invitationGetLast() {
        if(!this.wallet.isPrivate())
            throw new Error('You can only create invites for the session user');

        let lastInvite = await c.BC.Invitation.getLastInvite(this.wallet.address);
        lastInvite = lastInvite.toNumber();
        if(!lastInvite)
            return null;
        return EC.encodeInvitation(lastInvite, this.wallet.secret);
    }

    async invitationCheck(code){
        let invite = EC.decodeInvitation(code);
        return await c.BC.Invitation.isInvitationAvailable(invite.address, invite.index);
    }

    /**
     *
     * @param code
     * @returns {Promise.<string>} Invited or InviteDeleted
     */
    async invitationRedeem(code){
        if(!this.wallet.isPrivate())
            throw new Error('You can only redeem invites for the session user');

        let balance = await c.BC.web3.eth.getBalancePromise(this.wallet.address);
        if(balance.gte(c.BC.web3.toWei(0.02, 'ether'))){
            //Balance is enough to conduct operation from current user
            let self = this, status;
            await c.makeTransactions(async () => {
                status = await c.BC.invitationRedeem(code, self.wallet.address, self.wallet.address);
            }, "Redeem invitation code");
            return status;
        }else{
            //User does not have ether. Sponsor him
            return await c.invitationRedeem(code, this.wallet.address);
        }
    }

    async transfer(to, ties, native){
        let self = this;
        let u = await User.createFromDB(to.toLowerCase());
        let name = u ? `${u.user.name} ${u.user.surname}` : to;
        return await c.makeTransactions(async () => {
            let tx = await c.BC.TieToken.transferAndPay(to, ties, null, {from: self.wallet.address, value: native});
            return [tx];
        }, `Transferring ${ties} TIE and ${native || 0} ETH to ${name}`);
    }

    async saveToDB(){
    	if(!this.user)
    		throw new AnyBalance.Error('There is no user data set! Nothing to save!');
   		if(!this.user.__address)
   			this.user.__address = this.wallet.address;
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

    toJson(){
        return {
            user: this.user,
            projects: this.projects && this.projects.map(p => p.toJson()),
            wallet: this.wallet.toJson()
        }
    }

    static fromJson(json){
        let u = new User();
        u.user = json.user;
        u.projects = json.projects && json.projects.map(p => Project.fromJson(p));
        u.wallet = Wallet.fromJson(json.wallet);
        return u;
    }

    async getProjects(){
        if(this.projects)
            return this.projects;

        this.projects = await c.DB.instance.Project.findAsync({__address: this.wallet.address}, {raw: true});
        return this.projects.map(p => Project.createFromData(p));
    }

    /**
     *
     * @param object raw
     * @returns Project
     */
    newProject(raw){
        raw.__address = this.wallet.address;
        if(!raw.id)
            raw.id = c.DB.uuid().toString();
        return Project.createFromData(raw);
    }

    hasContact(address){
        return this.getContactsRaw().indexOf(address) >= 0;
    }

    addContact(address){
        if(!this.hasContact(address)) {
            if(!this.user.contacts)
                this.user.contacts = [];
            this.user.contacts.push(address);
        }
    }

    removeContact(address){
        const _ = require('lodash');
        _.pull(this.getContactsRaw(), address);
    }

    getContactsRaw(){
        return (this.user.contacts || []);
    }

    /**
     *
     * @returns {Promise.<User[]>}
     */
    async getContacts(){
        let promises = this.getContactsRaw().map(address => User.createFromDB(address));
        if(promises.length)
            return await Promise.all(promises);
        else
            return promises;
    }

    /**
     * Returns demo rating - not real rating
     * returns value between 0 and 100
     */
    getRating(){
        if(!this.user)
            return 0;
        const CRC32 = require('crc-32');
        let crc = CRC32.str(this.user.name + ' ' + this.user.surname);
        if(crc < 0)
            crc = -(crc+1);
        let r = crc%35;
        return 65 + r;
    }


}

module.exports = User;