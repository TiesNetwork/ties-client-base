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
        target: {
            type: "ascii"
        },
        contract: {
            type: "ascii"
        },
        comment: {
        	type: "text"
        },
        rating: {
        	type: "int"
        },
    },
    key : [["target", "__address", "contract"]],
    table_name: "ties_rating",
}