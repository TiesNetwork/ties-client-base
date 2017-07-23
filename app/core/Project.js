const c = require('./Connection');

const TABLE_NAME = 'ties_project';

class Project {
    constructor() {
        this.raw = null;
    }

    static createFromData(raw){
        const o = new Project();
        o.initializeFromData(raw);
        return o;
    }

    static async createFromDB(address, id){
        let uuid = c.DB.uuidFromString(id);
        let raw = await c.DB.instance.Project.findOneAsync({__address: address, id: uuid}, {raw: true});
        if(!raw)
            return null;
        const o = Project.createFromData(raw);
    }

    initializeFromData(raw){
        this.raw = raw;
    }

    async saveToDB(){
        if(!this.raw.id)
            this.raw.id = c.DB.uuid().toString();
        return await c.saveObject(TABLE_NAME, this.raw);
    }

    async deleteFromDB(){
        let uuid = c.DB.uuidFromString(this.raw.id);
        return await c.saveObject(TABLE_NAME, {__address: this.raw.__address, id: uuid}, true);
    }

    /**
     * Checks if data from database is loaded
     * @returns {boolean}
     */
    isLoaded() {
        return !!this.raw;
    }

    toJson(){
        return this.raw;
    }

    static fromJson(json){
        return Project.createFromData(json);
    }

}

module.exports = Project;