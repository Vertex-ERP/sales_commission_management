// Function to fetch and update commission details
function update_commission_details(frm, scheduling_name) {
    if (!frm.is_new()) {
        console.log("Fetching commission details for Sales Invoice:", frm.doc.name);
        frappe.call({
            method: "sales_commission_management.sales_commission_management.doctype.api.get_commission_details",
            args: {
                sales_invoice_name: frm.doc.name,
                scheduling_name: scheduling_name || frm.doc.yf_scheduling_name,
            }
        }).then(response => {
            console.log("Commission details fetch response:", response);
            if (response.message) {
                console.log("Commission details response:", response.message);
                const commission_details = response.message.commission_details;
                const opportunity = response.message.opportunity;

                frm.clear_table("yf_commission_details");

                const promises = commission_details.map(record => {
                    const { field, value, yf_added_by_id, custom_item } = record;
                    if (!value) return Promise.resolve();

                    let row = frm.add_child("yf_commission_details", {
                        sales_partner: value,
                        type: field
                    });

                    let method;
                    let args = {
                        scheduling_name: scheduling_name || frm.doc.yf_scheduling_name,
                        value: value,
                        type: undefined,
                        yf_added_by_id: yf_added_by_id
                    };

                    if (field === "opportunity_owners") {
                        method = "sales_commission_management.sales_commission_management.doctype.api.get_opportunity_rate";
                    } else if (field === "yf_researcher") {
                        method = "sales_commission_management.sales_commission_management.doctype.api.get_researcher_commission";
                        return frappe.call({
                            method: method,
                            args: { ...args, opportunity: opportunity }
                        }).then(rate_response => {
                            if (rate_response.message) {
                                const commission_rate = rate_response.message;

                                frappe.model.set_value(row.doctype, row.name, 'commission_rate', commission_rate);

                                let total_commission = 0;
                                frm.doc.items.forEach(item_row => {
                                    if (item_row.item_code === custom_item) {
                                        total_commission += (commission_rate / 100) * item_row.amount;
                                    }
                                });

                                frappe.model.set_value(row.doctype, row.name, 'total_commission', total_commission);
                            }
                        });
                    } else {
                        method = "sales_commission_management.sales_commission_management.doctype.api.get_rate";
                        args.type = field;
                    }

                    return frappe.call({
                        method: method,
                        args: args
                    }).then(rate_response => {
                        if (rate_response.message) {
                            const commission_rate = rate_response.message;

                            frappe.model.set_value(row.doctype, row.name, 'commission_rate', commission_rate);

                            let total_commission = 0;
                            if (field !== "yf_researcher") {
                                total_commission = (commission_rate / 100) * frm.doc.total;
                            }

                            frappe.model.set_value(row.doctype, row.name, 'total_commission', total_commission);
                        }
                    });
                });

                Promise.all(promises).then(() => {
                    frm.refresh_field("yf_commission_details");
                    console.log("Commission details updated successfully");
                });
            } else {
                console.log("No commission data found for Sales Invoice:", frm.doc.name);
            }
        });
    }
}

frappe.ui.form.on("Sales Invoice", {
    refresh: function(frm) {
        frm.fields_dict.yf_commission_details.grid.refresh();
    },
    yf_scheduling_name: function(frm) {
        update_commission_details(frm);
    },
    after_save: function(frm) {
        if (!frm.doc.yf_scheduling_name) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Commission Structure",
                    filters: { "default_structure": 1 },
                    fields: ["name"]
                }
            }).then(r => {
                if (r.message && r.message.length > 0) {
                    const default_scheduling_name = r.message[0].name;
                    frm.set_value("yf_scheduling_name", default_scheduling_name);
                    update_commission_details(frm, default_scheduling_name);
                }
            });
        }
    }
});

    
    // frappe.ui.form.on('Commission Table', {
    //     commission_rate: function(frm, cdt, cdn) {
    //         const row = frappe.get_doc(cdt, cdn);
    
    //         const total = frm.doc.total || 0;
    
    //         if (row.commission_rate) {
    //             const total_commission = (total * row.commission_rate) / 100;
    
    //             frappe.model.set_value(cdt, cdn, 'total_commission', total_commission);
    //             console.log('Total Commission:', total_commission);
    //         } else {
    //             frappe.model.set_value(cdt, cdn, 'total_commission', 0);
    //         }
    
    //         frm.refresh_field('Commission Table');
    //     }
    // });