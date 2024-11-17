frappe.ui.form.on('CRM Note', {
    approve: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);

        if (row.approve === 1) {

            frm.set_value('yf_researcher', row.added_by);
            frm.refresh_field('yf_researcher');
            

            frm.doc.notes.forEach((item) => {
                if (item.name !== row.name && item.approve === 1) {
                    item.approve = 0;
                }
            });

            frm.refresh_field('notes');

        } else {

            frm.set_value('yf_researcher', null); 
            frm.refresh_field('yf_researcher');
        }
    }
});
