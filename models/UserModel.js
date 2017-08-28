module.exports = {
    fields: {
        __address: {
            type: "ascii"
        },
        __signature: {
            type: "ascii"
        },
        __timestamp: {
        	type: "bigint"
        },
        name: {
        	type: "text"
        },
        surname: {
        	type: "text"
        },
        company: {
        	type: "text"
        },
        position: {
        	type: "text"
        },
        country: {
        	type: "text"
        },
        description: {
        	type: "text"
        },
        contacts: {
            type: "list",
            typeDef: "<ascii>"
        },
        keywords: {
        	type: "list",
        	typeDef: "<text>"
        },
        photo: {
        	type: "blob"
        },
    },
    key : ["__address"],
    indexes: [ 'company', 'country', 'keywords', 'name', 'position', 'surname' ],
    table_name: "ties_user",
}