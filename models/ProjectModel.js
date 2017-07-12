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
        id: {
        	type: "uuid"
        },
        name: {
        	type: "text"
        },
        date_start: {
        	type: "date"
        },
        date_end: {
        	type: "date"
        },
        description: {
        	type: "text"
        },
    },
    key : [["__address", "id"]],
    indexes: [ 'name' ],
    table_name: "ties_project",
}