frappe.ui.form.on('Sales Partner', {
    onload: function(frm) {
        frm.set_query('yf_party_type', function() {
            return {
                filters: [
                    ['DocType', 'name', 'in', ['Employee', 'Supplier', 'Customer', 'Shareholder']]
                ]
            };
        });
    }
});