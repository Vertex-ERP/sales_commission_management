// Copyright (c) 2024, YemenFrappe and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Commission Structure", {
// 	refresh(frm) {

// 	},
// });
frappe.ui.form.on("Commission Structure", {
    document_type: function(frm) {
        // Check if document_type is selected
        if (frm.doc.document_type) {
            // Load the Doctype and its fields
            frappe.model.with_doctype(frm.doc.document_type, function() {
                // Get all fields from the selected Doctype
                let fields = frappe.get_doc("DocType", frm.doc.document_type).fields;

                // Filter out fields based on no_value_type and prepare options
                let options = $.map(fields, function(d) {
                    return frappe.model.no_value_type.includes(d.fieldtype) ? null : get_select_options(d);
                });

                // Set options for Set Property After Alert field
                frm.set_df_property("set_property_after_alert", "options", [""].concat(options));
            });
        }
    }
});

// Helper function to format options
let get_select_options = function(df, parent_field) {
    // Append parent_field name along with fieldname for child table fields
    let select_value = parent_field ? df.fieldname + "," + parent_field : df.fieldname;

    return {
        value: select_value,
        label: __(df.label)
        };
};
//ssssssssssssssssssss
// frappe.ui.form.on("Scheduling", {
//     // Trigger when the form is loaded or refreshed
//     refresh: function(frm) {
//         console.log("Refreshing the form...");

//         frm.fields_dict["scheduling_field"].grid.get_field("doctype_name").get_query = function() {
//             console.log("Fetching Doctype filter...");
//             return {
//                 filters: {
//                     istable: 0  // Only fetch doctypes that are not child tables
//                 }
//             };
//         };
//     }
// });

// // Trigger event in the child table when Doctype Name is changed
// frappe.ui.form.on("Scheduling field", {
//     doctype_name: function(frm, cdt, cdn) {
//         console.log("Doctype Name field changed in Scheduling field");

//         // Get the row where the Doctype Name was changed
//         let row = locals[cdt][cdn];
//         console.log("Selected Doctype Name: ", row.doctype_name);

//         if (row.doctype_name) {
//             console.log("Fetching fields for Doctype: " + row.doctype_name);
            
//             // Load the selected Doctype and its fields
//             frappe.model.with_doctype(row.doctype_name, function() {
//                 console.log("Doctype loaded: " + row.doctype_name);

//                 let fields = frappe.get_doc("DocType", row.doctype_name).fields;
//                 console.log("Fields fetched: ", fields);

//                 // Filter fields and prepare options for Doctype Field dropdown
//                 let options = $.map(fields, function(d) {
//                     if (frappe.model.no_value_type.includes(d.fieldtype)) {
//                         console.log("Skipping field: ", d.fieldname);
//                         return null;
//                     } else {
//                         console.log("Adding field to options: ", d.fieldname);
//                         return get_select_options(d);
//                     }
//                 });

//                 console.log("Options generated: ", options);

//                 // Set the options for the Doctype Field in the specific row
//                 let df = frappe.meta.get_docfield("Scheduling field", "doctype_field", frm.doc.name);
//                 df.options = [""].concat(options);
//                 console.log("Setting options for Doctype Field");

//                 frm.refresh_field("scheduling_field");  // Refresh the child table to apply changes
//             });
//         } else {
//             console.log("No Doctype Name selected");
//         }
//     }
// });

// // Helper function to format select options
// let get_select_options = function(df) {
//     return {
//         value: df.fieldname,
//         label: df.fieldname + " (" + __(df.label) + ")"
//     };
// };
//nmnnnnnnnnnnnn
frappe.ui.form.on("Commission Structure", {
    onload: function(frm) {
        // تعيين الفلتر لحقل `doctype_name` في النموذج الرئيسي ليظهر فقط جداول `Lead` و `Opportunity`
        frm.set_query("document_type", function() {
            return {
                filters: {
                    name: ["in", ["Lead", "Opportunity"]]
                }
            };
        });
        console.log("تم تعيين الفلتر لحقل `doctype_name` ليظهر فقط جداول `Lead` و `Opportunity` في النموذج الرئيسي 'Scheduling'.");

        // تعيين الفلتر لحقل `doctype_name` في الجدول الفرعي `Scheduling field`
            // تعيين الفلتر مباشرة على الحقل `doctype_name` في الجدول الفرعي `Scheduling field`
            
    },
    // Trigger when the form is loaded or refreshed
    refresh: function(frm) {
        console.log("Refreshing the form...");

        frm.fields_dict["structure_field"].grid.get_field("doctype_name").get_query = function() {
            console.log("Fetching Doctype filter...");
            return {
                filters: {
                    istable: 0  // Only fetch doctypes that are not child tables
                },
               
                
            };
        };
    }
});
 
frappe.ui.form.on("Structure Field", {
//     refresh: function(frm) {
//         // تعيين الفلتر مباشرةً على الحقل `doctype_name` في الجدول الفرعي `Scheduling field`
//             cur_frm.fields_dict.doctype_name.get_query = function (doc) {
//             return {
//                 filters: {
//                     name: ["in", ["Lead", "Opportunity"]],  // تحديد الجداول المحددة فقط
//                 }
//             };
//         };
//     console.log("تم تعيين الفلتر لحقل `doctype_name` ليظهر فقط جداول `Lead` و `Opportunity` في الجدول الفرعي 'Scheduling field'.");
// },

   

//     doctype_name: function(frm, cdt, cdn) {
//         console.log("تم تغيير حقل اسم Doctype في حقل الجدول الفرعي");

//         let row = locals[cdt][cdn];
//         console.log("اسم الـ Doctype المحدد: ", row.doctype_name);
        
       

//         if (row.doctype_name) {
//             console.log("جلب الحقول لـ Doctype: " + row.doctype_name);

//             frappe.model.with_doctype(row.doctype_name, function() {
//                 console.log("تم تحميل Doctype: " + row.doctype_name);

//                 let fields = frappe.get_doc("DocType", row.doctype_name).fields;
//                 console.log("الحقول التي تم جلبها: ", fields);

//                 let options = $.map(fields, function(d) {
//                     if (!frappe.model.no_value_type.includes(d.fieldtype)) {
//                         console.log("إضافة الحقل للخيارات: ", d.fieldname);
//                         return get_select_options(d);
//                     }
//                     return null;
//                 });

//                 console.log("الخيارات التي تم توليدها: ", options);

//                 if (options && options.length > 0) {
//                     let option_values = [""].concat(options.map(o => o.value)); 
//                     console.log( " القيم: ", option_values);
                    
                    //  frm.fields_dict.scheduling_field.grid.update_docfield_property(
                    //         "doctype_field",
                    //         "options",
                    //         option_values
                    //         );
//                     // frm.fields_dict["scheduling_field"].grid.update_docfield_property(
//                     //     "doctype_field",
//                     //     "options",
//                     //     option_values
//                     // );
//                             console.log("تعيين الخيارات الجديدة للصف: ", row.name, " بالقيم: ", option_values);
                    
                    
                
//                     frm.refresh_field("scheduling_field"); 
//                     console.log("تم تحديث الجدول الفرعي بالخيارات الجديدة.");
//                 } else {
//                     console.log("لم يتم العثور على خيارات صالحة للتعيين.");
//                 }
//             });
//         } else {
//             console.log("لم يتم تحديد اسم Doctype");
//         }
//     }

    doctype_name: function(frm, cdt, cdn) {
        console.log("تم تغيير حقل اسم Doctype في حقل الجدول الفرعي");

        let row = locals[cdt][cdn];
        console.log("اسم الـ Doctype المحدد: ", row.doctype_name);

        if (row.doctype_name) {
            console.log("جلب الحقول لـ Doctype: " + row.doctype_name);

            frappe.model.with_doctype(row.doctype_name, function() {
                console.log("تم تحميل Doctype: " + row.doctype_name);

                let fields = frappe.get_doc("DocType", row.doctype_name).fields;
                console.log("الحقول التي تم جلبها: ", fields);

                let options = $.map(fields, function(d) {
                    if (d.fieldtype === "Link" && d.options === "User") {
                        console.log("إضافة الحقل للخيارات: ", d.fieldname);
                        return d.fieldname; 
                    }
                    return null;
                });

                console.log("الخيارات التي تم توليدها: ", options);

                if (options && options.length > 0) {
                    let option_values = [""].concat(options); 
                    console.log("القيم: ", option_values);

                    frm.fields_dict.structure_field.grid.update_docfield_property(
                        "doctype_field",
                        "options",
                        option_values
                        );
                    console.log("تم تعيين الخيارات الجديدة للصف: ", row.name, " بالقيم: ", option_values);

                    frm.refresh_field("structure_field"); 
                    console.log("تم تحديث الجدول الفرعي بالخيارات الجديدة.");
                } else {
                    console.log("لم يتم العثور على خيارات صالحة للتعيين.");
                }
            });
        } else {
            console.log("لم يتم تحديد اسم Doctype");
        }
    }
});

