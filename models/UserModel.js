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
        	type: "varchar"
        },
        description: {
        	type: "text"
        },
        keywords: {
        	type: "set",
        	typeDef: "<varchar>"
        },
        photo: {
        	type: "blob"
        },
    },
    key : ["__address"],
    table_name: "ties_user",
}