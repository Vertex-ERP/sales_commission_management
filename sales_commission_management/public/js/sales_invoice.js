

frappe.ui.form.on("Sales Invoice", {
    yf_scheduling_name: function(frm) {
        if (!frm.is_new()) {
            frappe.call({
                method: "sales_commission_management.sales_commission_management.doctype.api.get_commission_details",
                args: {
                    sales_invoice_name: frm.doc.name,
                    scheduling_name: frm.doc.yf_scheduling_name
                }
            }).then(r => {
                if (r.message) {
                    const commission_details = r.message;
                    frm.clear_table("yf_commission_details");

                    const promises = commission_details.map(record => {
                        const { field, value } = record;

                        if (value) {
                            console.log(`Adding row for ${field}: ${value}`);

                            let row = frm.add_child("yf_commission_details", {
                                sales_partner: value, 
                                type: field          
                            });

                            return frappe.call({
                                method: "sales_commission_management.sales_commission_management.doctype.api.get_rate",
                                args: {
                                    scheduling_name: frm.doc.yf_scheduling_name,
                                    type: field
                                }
                            }).then(rate_response => {
                                if (rate_response.message) {
                                    frappe.model.set_value(row.doctype, row.name, 'commission_rate', rate_response.message);

                                    let total_commission = 0;

                                    if (field === "yf_researcher") {
                                        frm.doc.items.forEach(item => {
                                            if (item.yf_custom_researcher === value) {
                                                total_commission += (rate_response.message / 100) * item.amount;
                                                console.log(`Matched item with custom_researcher: ${item.custom_researcher}, Amount: ${item.amount}`);
                                                frappe.msgprint(`Matched item for ${value}: ${item.amount}`);
                                            }
                                        });
                                    } else if (frm.doc.total) {
                                        total_commission = (rate_response.message / 100) * frm.doc.total;
                                        console.log(`Calculating total commission for type: ${field}, Total: ${frm.doc.total}`);

                                    }

                                    // تعيين إجمالي العمولة في الجدول
                                    frappe.model.set_value(row.doctype, row.name, 'total_commission', total_commission);
                                } else {
                                    console.log(`No matching rate found for type: ${field}`);
                                }
                            });
                        }
                    });

                    // بعد الانتهاء من كل العمليات، نقوم بتحديث الجدول
                    Promise.all(promises).then(() => {
                        frm.refresh_field("yf_commission_details");
                        console.log("Commission details updated successfully");
                    });

                } else {
                    console.log("No commission data found for Sales Invoice:", frm.doc.name);
                }
            });
        }
    },


        after_save: function(frm) {
            // تحقق إذا لم يكن هناك قيمة ل yf_scheduling_name
            if (!frm.doc.yf_scheduling_name) {
                // استرجاع هيكل العمولة الافتراضي
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
                            // تعيين القيمة الافتراضية ل yf_scheduling_name
                            frm.set_value("yf_scheduling_name", default_scheduling_name);
    
                            // استرجاع تفاصيل العمولة بناءً على الاسم المحدد
                            frappe.call({
                                method: "sales_commission_management.sales_commission_management.doctype.api.get_commission_details",
                                args: {
                                    sales_invoice_name: frm.doc.name,
                                    scheduling_name: frm.doc.yf_scheduling_name
                                }
                            }).then(r => {
                                if (r.message) {
                                    const commission_details = r.message;
    
                                    frm.clear_table("yf_commission_details");
    
                                    // إنشاء الوعود (Promises) لمعالجة كل التفاصيل
                                    const promises = Object.keys(commission_details).map(key => {
                                        const value = commission_details[key];
                                        if (value) {
                                            let row = frm.add_child("yf_commission_details", {
                                                sales_partner: value,  // تعيين قيمة الشريك
                                                type: key              // تعيين نوع العمولة
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
    
                                                    // حساب العمولة الإجمالية
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
    
                                    // بعد اكتمال جميع العمليات، نقوم بتحديث الحقل
                                    Promise.all(promises).then(() => {
                                        frm.refresh_field("yf_commission_details");
                                        console.log("Commission details updated successfully");
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

        let row = locals[cdt][cdn];
       
        if (row.type && frm.doc.yf_scheduling_name) {
            
            frappe.call({
                method: "sales_commission.sales_commission.doctype.api.get_rate", // استبدل `sales_commission` باسم التطبيق الخاص بك
                args: {
                    scheduling_name: frm.doc.yf_scheduling_name,
                    type: row.type
                },
                callback: function(r) {
                    if (r.message) {
                        frappe.model.set_value(cdt, cdn, 'commission_rate', r.message);
                    } else {
                        console.log("لم يتم العثور على معدل مطابق.");
                    }
                }
            });
        } else {
            console.log("لم يتم تعيين ");
        }
    },
  
});
