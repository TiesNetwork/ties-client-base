/**
 * Created by Dukei on 03.07.2017.
 */
let EC = require("@ties-network/db-sign");

class Wallet {

    constructor(_wallet) {
        if(_wallet) {
            this.phrase = _wallet.phrase;
            this.secret = _wallet.secret;
            this.public = _wallet.public;
            this.address = _wallet.address;
            this.password = _wallet.password;
        }
    }

    static createFrom(phraseOrHexpk) {
        if(/\s+/.test(phraseOrHexpk)){
            //It is a phrase containing spaces
            return new Wallet(EC.recoverWallet(phraseOrHexpk));
        }else if(/^0x[\da-f]$/i.test(phraseOrHexpk)){
            //It is a raw private key
            return new Wallet(EC.recoverWalletFromPrivateKey(phraseOrHexpk));
        }else{
            throw new Error('Can not recover wallet from specified string. It can either be parity mnemonic phrase or raw hex-encoded private key');
        }
    }

    static createDecrypt(encrypted_json_str, password) {
        return new Wallet(EC.recoverWalletFromEncryptedPrivateKey(encrypted_json_str, password));
    }

    static createNew() {
        return new Wallet(EC.generateNewWallet());
    }

    static createFromAddress(address){
        return new Wallet({address: address});
    }

    isPrivate() {
        return !!this.secret;
    }

    hasPassword() {
        return !!this.password;
    }

    setPassword(newPassword, oldPassword) {
        if (this.password !== oldPassword)
            throw new Error('Invalid old password!');

        this.password = newPassword;
    }

    encrypt() {
        if(!this.hasPassword())
            throw new Error('You should setPassword first!');
        return EC.encryptPrivateKey(this.secret, this.password);
    }


}

module.exports = Wallet;
