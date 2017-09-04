const c = require('./Connection');

const TABLE_NAME_INVOICE = 'ties_invoice';
const TABLE_NAME_INVOICE_STATUS = 'ties_invoice_status';

class Invoice {
    constructor() {
        this.invoice = null;
        this.status = null;
    }

    static createFromData(invoice, status){
        const o = new Invoice();
        o.initializeFromData(invoice, status);
        return o;
    }

    static async createFromDB(address, id){
        let uuid = c.DB.uuidFromString(id);
        let invoice = await c.DB.instance.Invoice.findOneAsync({__address: address, id: uuid}, {raw: true});
        if(!invoice)
            return null;
        let status = await c.DB.instance.InvoiceStatus.findOneAsync({__address: invoice.recepient, id: uuid}, {raw: true});
        return Invoice.createFromData(invoice, status);
    }

    initializeFromData(invoice, status){
        this.invoice = invoice;
        this.status = status;
    }

    async saveToDB(){
        let u = c.user.wallet.address; //Current user
        if(u == this.invoice.__address){
            if(!this.invoice.id)
                this.invoice.id = c.DB.uuid().toString();

            if(!this.invoice.recepient)
                throw new Error('Recepient should be set!');
            if(!this.invoice.amount)
                throw new Error('Amount should be set!');
            if(!this.invoice.currency)
                throw new Error('Currency should be set!');
            if(!/^tie|eth$/i.test(this.invoice.currency))
                throw new Error('Currency should be TIE or ETH!');

            return await c.saveObject(TABLE_NAME_INVOICE, this.toJson().invoice);
        }else if(this.status && this.invoice.recepient == u){
            if(!this.status.id)
                this.status.id = c.DB.uuid().toString();
            if(!this.status.invoice_signature)
                this.status.invoice_signature = this.invoice.__signature;
            if(!this.status.__address)
                this.status.__address = this.invoice.recepient;

            return await c.saveObject(TABLE_NAME_INVOICE_STATUS, this.toJson().status);
        }else{
            throw new Error('Current user can not modify this invoice')
        }
    }

    static toJson(obj){
        if(!obj || typeof obj.id == 'string'){
            return obj;
        }else {
            let ret = {};
            for(let prop in obj){
                if(prop == 'id')
                    ret[prop] = obj.id.toString();
                else
                    ret[prop] = obj[prop];
            }
            return ret;
        }
    }

    toJson(){
        return {
            invoice: Invoice.toJson(this.invoice),
            status: Invoice.toJson(this.status),
        }
    }

    static fromJson(json){
        Invoice.createFromData(json.invoice, json.status);
    }

    static async getOutgoing(address){
        let invoices = await c.DB.instance.Invoice.findAsync({__address: address}, {raw: true});
        let statusPromises = [], statuses = [];
        invoices.forEach(inv => {
            statusPromises.push(c.DB.instance.InvoiceStatus.findOneAsync({__address: inv.recepient, id: inv.id}, {raw: true}));
        });

        if(statusPromises.length)
            statuses = await Promise.all(statusPromises);

        let invs = [];
        invoices.sort((i1, i2) => -i1.__timestamp + i2.__timestamp);

        invoices.forEach(inv => {
            const id_str = inv.id.toString();
            const status = statuses.find(s => s && s.id.toString() == id_str);
            let i = Invoice.createFromData(inv, status);
            invs.push(i);
        });

        return invs;
    }

    static async getIncoming(address){
        let invoices = c.DB.instance.Invoice.findAsync({recepient: address}, {raw: true});
        let statuses = c.DB.instance.InvoiceStatus.findAsync({__address: address}, {raw: true});
        [invoices, statuses] = await Promise.all([invoices, statuses]);

        let invs = [];
        invoices.sort((i1, i2) => -i1.__timestamp + i2.__timestamp);

        invoices.forEach(inv => {
            const id_str = inv.id.toString();
            const status = statuses.find(s => s && s.id.toString() == id_str);
            let i = Invoice.createFromData(inv, status);
            invs.push(i);
        });

        return invs;
    }

    /**
     *  @param values {[__address], recepient, amount, currency, comment}
     */
    static createNew(values){
        if(!values.__address)
            values.__address = c.user.wallet.address;
        if(!values.id)
            values.id = c.DB.uuid();

        return Invoice.createFromData(values);
    }

    _ensureStatus(){
        if(this.invoice.recepient != c.user.wallet.address)
            throw new Error('Invoice status modification is available for current user only')
        if(!this.status){
            this.status = {
                __address: this.invoice.recepient,
                id: this.invoice.id,
                invoice_signature: this.invoice.__signature
            };
        }
    }

    getViewed(){
        return this.status && this.status.viewed;
    }

    getTransaction(){
        return this.status && this.status.transaction;
    }

    setViewed(val){
        if(typeof val == 'undefined')
            val = true;
        this._ensureStatus();
        this.status.viewed = val;
    }

    setTransaction(val){
        if(typeof val == 'undefined')
            val = true;
        this._ensureStatus();
        this.status.transaction = val;
    }

}

module.exports = Invoice;