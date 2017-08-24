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
        comment: {
        	type: "text"
        },
        amount: {
        	type: "decimal"
        },
        currency: {
        	type: "ascii"
        },
        recepient: {
        	type: "ascii"
        },
    },
    key : [["__address"], "id"],
    clustering_order: { id: 'ASC' },
    indexes: [ 'recepient' ],
    table_name: "ties_invoice",
}