// Copyright (c) 2024, YemenFrappe and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Commission Structure", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("Commission Structure", {
    
    refresh: function(frm) {
        console.log("Refreshing the form...");

        frm.fields_dict["structure_field"].grid.get_field("doctype_name").get_query = function() {
            return {
                filters: {
                    istable: 0 
                },
               
                
            };
        };
    }
});
 
frappe.ui.form.on("Structure Field", {


    doctype_name: function(frm, cdt, cdn) {

        let row = locals[cdt][cdn];

        if (row.doctype_name) {

            frappe.model.with_doctype(row.doctype_name, function() {

                let fields = frappe.get_doc("DocType", row.doctype_name).fields;

                let options = $.map(fields, function(d) {
                    if (d.fieldtype === "Link" && d.options === "User") {
                        return d.fieldname; 
                    }
                    return null;
                });


                if (options && options.length > 0) {
                    let option_values = [""].concat(options); 

                    frm.fields_dict.structure_field.grid.update_docfield_property(
                        "doctype_field",
                        "options",
                        option_values
                        );

                    frm.refresh_field("structure_field"); 
                } else {
                    console.log("لم يتم العثور على خيارات صالحة للتعيين.");
                }
            });
        } else {
            console.log("لم يتم تحديد اسم Doctype");
        }
    }
});

