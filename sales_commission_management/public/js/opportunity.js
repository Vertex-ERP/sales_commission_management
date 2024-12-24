
frappe.ui.form.on('Opportunity', {
    setup: function(frm) {
    frm.fields_dict["notes"].grid.get_field("yf_custom_item").get_query = function(doc, cdt, cdn) {
     let d = locals[cdt][cdn];
     return {
      query: "sales_commission_management.sales_commission_management.doctype.api.get_item",
      filters: {
        "added_by": d.added_by,
                                }
     };
    }
   }})
   frappe.ui.form.on('CRM Note', {
    added_by: function(frm, cdt, cdn) {
      var row = locals[cdt][cdn]; 
      if (row.added_by) {
            var unique_id = 'AD-' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
            console.log(unique_id)
            
            frappe.model.set_value(cdt, cdn, 'yf_added_by_id', unique_id);
        }
    }
});

