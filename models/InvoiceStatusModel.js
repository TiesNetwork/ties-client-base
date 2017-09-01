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
        invoice_signature: {
        	type: "ascii"
        },
        transaction: {
        	type: "ascii"
        },
        viewed: {
            type: "boolean"
        },
    },
    key : [["__address"], "id"],
    clustering_order: { id: 'ASC' },
    indexes: [ ],
    table_name: "ties_invoice_status",
}