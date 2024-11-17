


frappe.ui.form.on("Sales Invoice", {
   
      yf_scheduling_name: function(frm) {
            if (!frm.is_new()) {
                console.log("Starting commission details retrieval for Sales Invoice:", frm.doc.name);
    
                frappe.call({
                    method: "sales_commission_management.sales_commission_management.doctype.api.get_commission_details",
                    args: {
                        sales_invoice_name: frm.doc.name,
                        scheduling_name: frm.doc.yf_scheduling_name
                    }
                }).then(r => {
                    console.log("Response from get_commission_details:", r);
    
                    if (r.message) {
                        const commission_details = r.message;
    
                        frm.clear_table("yf_commission_details");
    
                        const promises = Object.keys(commission_details).map(key => {
                            const value = commission_details[key];
                            if (value) {
                                console.log(`Adding row for ${key}: ${value}`);
    
                                let row = frm.add_child("yf_commission_details", {
                                    sales_partner: value,  
                                    type: key              
                                });
    
                                return frappe.call({
                                    method: "sales_commission_management.sales_commission_management.doctype.api.get_rate",
                                    args: {
                                        scheduling_name: frm.doc.yf_scheduling_name,
                                        type: key
                                    }
                                }).then(rate_response => {
                                    if (rate_response.message) {
                                        console.log("Setting commission_rate for", key, ":", rate_response.message);
    
                                        frappe.model.set_value(row.doctype, row.name, 'commission_rate', rate_response.message);
    
                                        if (frm.doc.total) {
                                            let total_commission = (rate_response.message / 100) * frm.doc.total;
                                            frappe.model.set_value(row.doctype, row.name, 'total_commission', total_commission);
                                        }
                                    } else {
                                        console.log("No matching rate found for type:", key);
                                    }
                                });
                            }
                        });
    
                        Promise.all(promises).then(() => {
                            frm.refresh_field("yf_commission_details");
                        });
                    } else {
                        console.log("No commission data found for Sales Invoice:", frm.doc.name);
                    }
                });
            }
        },
        after_save:function(frm) {
        if (!frm.doc.yf_scheduling_name) {
            frappe.call({
                method: "frappe.client.get_list",
                args: {
                    doctype: "Commission Structure",
                    filters: { "default_structure": 1 },
                    fields: ["name"]
                },
                callback: function(r) {
                    if (r.message && r.message.length > 0) {
                        const default_scheduling_name = r.message[0].name;
                        console.log("Setting default scheduling name:", default_scheduling_name);
                        frm.set_value("yf_scheduling_name", default_scheduling_name);

                        frappe.call({
                            method: "sales_commission_management.sales_commission_management.doctype.api.get_commission_details",
                            args: {
                                sales_invoice_name: frm.doc.name,
                                scheduling_name: frm.doc.yf_scheduling_name
                            }
                        }).then(r => {
                            console.log("Response from get_commission_details:", r);

                            if (r.message) {
                                const commission_details = r.message;

                                frm.clear_table("yf_commission_details");

                                const promises = Object.keys(commission_details).map(key => {
                                    const value = commission_details[key];
                                    if (value) {
                                        console.log(`Adding row for ${key}: ${value}`);

                                        let row = frm.add_child("yf_commission_details", {
                                            sales_partner: value,  
                                            type: key              
                                        });

                                        return frappe.call({
                                            method: "sales_commission_management.sales_commission_management.doctype.api.get_rate",
                                            args: {
                                                scheduling_name: frm.doc.yf_scheduling_name,
                                                type: key
                                            }
                                        }).then(rate_response => {
                                            if (rate_response.message) {
                                                console.log("Setting commission_rate for", key, ":", rate_response.message);

                                                frappe.model.set_value(row.doctype, row.name, 'commission_rate', rate_response.message);

                                                if (frm.doc.total) {
                                                    let total_commission = (rate_response.message / 100) * frm.doc.total;
                                                    frappe.model.set_value(row.doctype, row.name, 'total_commission', total_commission);
                                                }
                                            } else {
                                                console.log("No matching rate found for type:", key);
                                            }
                                        });
                                    }
                                });

                                Promise.all(promises).then(() => {
                                    frm.refresh_field("yf_commission_details");
                                });
                            } else {
                                console.log("No commission data found for Sales Invoice:", frm.doc.name);
                            }
                        });
                    } else {
                        console.log("No default scheduling name found");
                    }
                }
            });
        }
    }
});
frappe.ui.form.on('Commission Table', {
    type: function(frm, cdt, cdn) {
        // عرض رسالة Console عند بدء استدعاء الدالة
        console.log("تم تغيير الحقل `type` في جدول `yf_commission_details`");

        let row = locals[cdt][cdn];
        console.log("القيمة المحددة لـ type:", row.type);
        console.log("القيمة المحددة لـ yf_scheduling_name:", frm.doc.yf_scheduling_name);

        if (row.type && frm.doc.yf_scheduling_name) {
            console.log("بدء استدعاء `get_rate` من الخادم مع المعلمات:");
            console.log("scheduling_name:", frm.doc.yf_scheduling_name);
            console.log("type:", row.type);

            frappe.call({
                method: "sales_commission.sales_commission.doctype.api.get_rate", // استبدل `sales_commission` باسم التطبيق الخاص بك
                args: {
                    scheduling_name: frm.doc.yf_scheduling_name,
                    type: row.type
                },
                callback: function(r) {
                    console.log("تم استلام الرد من الخادم:", r);
                    if (r.message) {
                        console.log("تم العثور على معدل العمولة:", r.message);
                        frappe.model.set_value(cdt, cdn, 'commission_rate', r.message);
                    } else {
                        console.log("لم يتم العثور على معدل مطابق.");
                        frappe.msgprint(__('No matching rate found.'));
                    }
                }
            });
        } else {
            console.log("لم يتم تعيين `type` أو `yf_scheduling_name`. لم يتم استدعاء الخادم.");
        }
    },
  
});
