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
        return Project.createFromData(raw);
    }

    initializeFromData(raw){
        this.raw = raw;
    }

    async saveToDB(){
        if(!this.raw.id)
            this.raw.id = c.DB.uuid().toString();
        return await c.saveObject(TABLE_NAME, this.toJson());
    }

    async deleteFromDB(){
        let uuid = typeof this.raw.id == 'string' ? c.DB.uuidFromString(this.raw.id) : this.raw.id;
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
        if(typeof this.raw.id == 'string'){
            return this.raw;
        }else {
            return {
                __address: this.raw.__address,
                id: this.raw.id.toString(),
                __timestamp: this.raw.__timestamp,
                __signature: this.raw.__signature,
                name: this.raw.name,
                description: this.raw.description,
                date_start: this.raw.date_start && this.raw.date_start.toString(),
                date_end: this.raw.date_end && this.raw.date_end.toString()
            };
        }
    }

    static fromJson(json){
        return Project.createFromData(json);
    }

    static async getProjects(address){
        let projects = await c.DB.instance.Project.findAsync({__address: address}, {raw: true});
        return projects.map(p => Project.createFromData(p));
    }
}

module.exports = Project;