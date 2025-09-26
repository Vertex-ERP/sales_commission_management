erpnext.utils.CustomCRMNotes = class CustomCRMNotes extends erpnext.utils.CRMNotes {
    constructor(opts) {
        super(opts);
    }

    refresh() {
        var me = this;
        this.notes_wrapper.find(".notes-section").remove();

        let notes = this.frm.doc.notes || [];
        notes.sort((a, b) => new Date(b.added_on) - new Date(a.added_on));

        let notes_html = `
            <div class="notes-section col-xs-12">
                <div class="new-btn pb-3">
                    <button class="btn btn-sm small new-note-btn mr-1">
                        <svg class="icon icon-sm"><use href="#icon-add"></use></svg>
                        ${__("New Note")}
                    </button>
                </div>
                <div class="all-notes">
                    ${notes.length ? notes.map(note => `
                        <div class="comment-content p-3 row" name="${note.name}">
                            <div class="mb-2 head col-xs-3">
                                ${note.added_by && note.added_on ? `
                                <div class="row">
                                    <div class="col-xs-2">
                                        ${frappe.avatar(note.added_by)}
                                    </div>
                                    <div class="col-xs-10">
                                        <div class="mr-2 title font-weight-bold ellipsis" title="${note.added_by}">
                                            ${note.added_by}
                                        </div>
                                        <div class="time small text-muted">
                                            ${frappe.datetime.global_date_format(note.added_on)}
                                        </div>
                                    </div>
                                </div>
                                ` : ''}
                            </div>
                            <div class="content col-xs-4">${note.note}</div>
                            <div class="content col-xs-2">${note.custom_item_code || ''}</div>
                            <div class="content col-xs-2">${note.custom_description || ''}</div>
                            <div class="col-xs-1 text-right">
                                <span class="edit-note-btn btn btn-link">
                                    <svg class="icon icon-sm"><use xlink:href="#icon-edit"></use></svg>
                                </span>
                                <span class="delete-note-btn btn btn-link pl-2">
                                    <svg class="icon icon-xs"><use xlink:href="#icon-delete"></use></svg>
                                </span>
                            </div>
                        </div>
                    `).join('') : `<div class="no-activity text-muted pt-6">${__("No Notes")}</div>`}
                </div>
            </div>
            <style>
                .comment-content { border: 1px solid var(--border-color); border-bottom: none; }
                .comment-content:last-child { border-bottom: 1px solid var(--border-color); }
                .new-btn { text-align: right; }
                .notes-section .no-activity { min-height: 100px; text-align: center; }
                .notes-section .btn { padding: 0.2rem 0.2rem; }
            </style>
        `;

        $(notes_html).appendTo(this.notes_wrapper);
        this.add_note();

        $(".notes-section").find(".edit-note-btn").on("click", function () {
            me.edit_note(this);
        });

        $(".notes-section").find(".delete-note-btn").on("click", function () {
            me.delete_note(this);
        });
    }

    add_note() {
        let me = this;
        let _add_note = () => {
            var d = new frappe.ui.Dialog({
                title: __("Add a Note"),
                fields: [
                    {
                        label: "Item Code",
                        fieldname: "custom_item_code",
                        fieldtype: "Data",
                        reqd: 1,
                    },
                    {
                        label: "Note",
                        fieldname: "note",
                        fieldtype: "Text Editor",
                        reqd: 1,
                        enable_mentions: true,
                    },
                    {
                        label: "Description",
                        fieldname: "custom_description",
                        fieldtype: "Data",
                    },
                ],
                primary_action: function () {
                    var data = d.get_values();
                    frappe.call({
                        method: 'sales_commission_management.api.add_note',
                        args: {
                            note: data.note,
                            custom_item_code: data.custom_item_code,
                            custom_description: data.custom_description,
                            docname: me.frm.doc.name
                        },
                        freeze: true,
                        callback: function (r) {
                            if (!r.exc) {
                                me.frm.refresh_field("notes");
                                me.refresh();
                            }
                            d.hide();
                        },
                    });
                },
                primary_action_label: __("Add"),
            });
            d.show();
        };
        $(".new-note-btn").click(_add_note);
    }

edit_note(edit_btn) {
    var me = this;
    let row = $(edit_btn).closest(".comment-content");
    let row_id = row.attr("name");
    
    // البحث عن الملاحظة الحالية بطريقة أكثر دقة
    let current_note = null;
    if (this.frm.doc.notes && this.frm.doc.notes.length) {
        current_note = this.frm.doc.notes.find(note => {
            // تحويل كلا القيمتين إلى سلسلة نصية للمقارنة
            return String(note.name) === String(row_id);
        });
    }

    if (!current_note) {
        console.error("Note not found!", row_id, this.frm.doc.notes);
        frappe.msgprint(__("Note not found!"));
        return;
    }

    console.log("Found Note:", current_note);
    console.log("Row ID from HTML:", row_id, "Type:", typeof row_id);
    console.log("Note names:", this.frm.doc.notes.map(n => n.name));

    var d = new frappe.ui.Dialog({
        title: __("Edit Note"),
        fields: [
            {
                label: "Item Code",
                fieldname: "custom_item_code",
                fieldtype: "Data",
                reqd: 1,
                default: current_note.custom_item_code || ''
            },
            {
                label: "Note",
                fieldname: "note",
                fieldtype: "Text Editor",
                reqd: 1,
                enable_mentions: true,
                default: current_note.note || ''
            },
            {
                label: "Description",
                fieldname: "custom_description",
                fieldtype: "Data",
                default: current_note.custom_description || ''
            },
            {
                label: "Commission Rate",
                fieldname: "custom_commission_rate",
                fieldtype: "Float",
                default: current_note.custom_commission_rate || 0
            },
            {
                label: "Approved",
                fieldname: "custom_approved",
                fieldtype: "Check",
                default: current_note.custom_approved || 0
            }
        ],
primary_action: function() {
    var data = d.get_values();
    frappe.call({
        method: 'sales_commission_management.api.edit_note',
        args: {
            note: data.note,
            custom_item_code: data.custom_item_code,
            custom_description: data.custom_description,
            custom_commission_rate: data.custom_commission_rate,
            custom_approved: data.custom_approved,
            docname: me.frm.doc.name,
            row_id: row_id,
        },
        freeze: true,
        callback: function(r) {
            if (!r.exc) {
                me.frm.refresh_field("notes");
                me.refresh();
                d.hide();

                // ✅ التحقق من الموافقة، ثم فتح نافذة Item Details
                if (data.custom_approved === 1) {
                    // نحتاج تحويل row_id إلى اسم فعلي للـ child row من الفورم
                    const note_row = (me.frm.doc.notes || []).find(n => String(n.name) === String(row_id));
                    if (note_row) {
                        open_item_dialog1(me.frm, "CRM Note", note_row.name);
                    } else {
                        console.warn("Could not find row after update for open_item_dialog1");
                    }
                }
            }
        },
    });
},

        primary_action_label: __("Save"),
    });
    d.show();
}

    delete_note(delete_btn) {
        var me = this;
        let row_id = $(delete_btn).closest(".comment-content").attr("name");
        frappe.call({
            method: "delete_note",
            doc: me.frm.doc,
            args: {
                row_id: row_id,
            },
            freeze: true,
            callback: function (r) {
                if (!r.exc) {
                    me.frm.refresh_field("notes");
                    me.refresh();
                }
            },
        });
    }
};


class CustomOpportunity extends erpnext.crm.Opportunity {
        onload() {
        if (!this.frm.doc.status) {
            this.frm.set_value("status", "Open");
        }
        if (!this.frm.doc.company && frappe.defaults.get_user_default("Company")) {
            this.frm.set_value("company", frappe.defaults.get_user_default("Company"));
        }
        if (!this.frm.doc.currency) {
            this.frm.set_value("currency", frappe.defaults.get_user_default("Currency"));
        }

        this.setup_queries();
        this.frm.trigger("currency");
    }

    refresh() {
        this.show_notes();
        this.show_activities();
    }
    setup_queries() {
		var me = this;

		me.frm.set_query("customer_address", erpnext.queries.address_query);

		this.frm.set_query("item_code", "items", function () {
			return {
				query: "erpnext.controllers.queries.item_query",
				filters: { is_sales_item: 1 },
			};
		});

		me.frm.set_query("contact_person", erpnext.queries["contact_query"]);

		if (me.frm.doc.opportunity_from == "Lead") {
			me.frm.set_query("party_name", erpnext.queries["lead"]);
		} else if (me.frm.doc.opportunity_from == "Customer") {
			me.frm.set_query("party_name", erpnext.queries["customer"]);
		} else if (me.frm.doc.opportunity_from == "Prospect") {
			me.frm.set_query("party_name", function () {
				return {
					filters: {
						company: me.frm.doc.company,
					},
				};
			});
		}
	}


    show_notes() {
        const crm_notes = new erpnext.utils.CustomCRMNotes({
            frm: this.frm,
            notes_wrapper: $(this.frm.fields_dict.notes_html.wrapper),
        });
        crm_notes.refresh();
       
    }

    show_activities() {
        const crm_activities = new erpnext.utils.CRMActivities({
            frm: this.frm,
            open_activities_wrapper: $(this.frm.fields_dict.open_activities_html.wrapper),
            all_activities_wrapper: $(this.frm.fields_dict.all_activities_html.wrapper),
            form_wrapper: $(this.frm.wrapper),
        });
        crm_activities.refresh();
    }
};

extend_cscript(cur_frm.cscript, new CustomOpportunity({ frm: cur_frm }));
frappe.ui.form.on('CRM Note', {
    
    
   custom_approved: function (frm, cdt, cdn) {
    var row = locals[cdt][cdn];

    if (row.added_by) {
        var unique_id = 'AD-' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
        console.log(unique_id)
        
        frappe.model.set_value(cdt, cdn, 'yf_added_by_id', unique_id);
    }
    if ( row.custom_approved==1){
      open_item_dialog1(frm, cdt, cdn);
   }}
});






function open_item_dialog1(frm, cdt, cdn) { 
    console.log("Triggered open_item_dialog1 from edit_note");

    console.log("Triggered open_item_dialog1");

    const child_row = frappe.get_doc(cdt, cdn);
    const custom_item_code = child_row.custom_item_code || '';  
    const added_by = child_row.added_by || '';
    const custom_commission_rate = child_row.custom_commission_rate || 0;  

    frappe.call({
        method: 'sales_commission_management.api.get_item_data', 
        args: { custom_item_code: custom_item_code },
        callback(response) {
            let item_data = response.message ? response.message.item : null;
            let researchers_data = response.message ? response.message.researchers : [];

            if (!item_data) {
                item_data = { item_code: custom_item_code, item_group: '', standard_rate: 0 };
                researchers_data = [];
            }

            let researcher = researchers_data.find(r => r.researchers === added_by);

            if (researcher) {
                researcher.commission_rate = custom_commission_rate;
            } else if (added_by) {
                researchers_data.push({
                    researchers: added_by,
                    commission_rate: custom_commission_rate  
                });
            }

            show_item_dialog(frm, item_data, researchers_data, cdt, cdn);

        }

    });
    console.log("Calling show_item_dialog with:", item_data, researchers_data);

}

function show_item_dialog(frm, item_data, researchers_data, cdt, cdn) {
    console.log("Inside show_item_dialog");

    const dialog = new frappe.ui.Dialog({
        title: __('Item Details'),
        fields: [
            { fieldname: 'item_code', fieldtype: 'Data', label: __('Item Code'), reqd: 1, default: item_data.item_code },
            { fieldname: 'item_group', fieldtype: 'Link', options: 'Item Group', label: __('Item Group'), reqd: 1, default: item_data.item_group },
            { fieldname: 'standard_rate', fieldtype: 'Currency', label: __('Standard Rate'), reqd: 1, default: item_data.standard_rate },
            {
                fieldname: 'researchers',
                fieldtype: 'Table',
                label: __('Researchers'),
                cannot_add_rows: false,
                allow_bulk_edit: true,
                data: researchers_data,
                fields: [
                    { fieldname: 'researchers', fieldtype: 'Link', options: 'User', label: __('Researchers'), in_list_view: 1, reqd: 1 },
                    { fieldname: 'commission_rate', fieldtype: 'Float', label: __('Commission Rate'), in_list_view: 1, reqd: 1 }
                ]
            }
        ],
        primary_action_label: __('Save'),
        primary_action(values) {
            save_item_data(frm, values, dialog, cdt, cdn);
        }
    });

    dialog.show();
}

function save_item_data(frm, values, dialog, cdt, cdn) {
    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Item',
            filters: { item_code: values.item_code },
            fields: ['name']
        },
        callback(response) {
            if (response.message && response.message.length > 0) {
                update_existing_item(frm, values, response.message[0].name, dialog, cdt, cdn);
            } else {
                create_new_item(frm, values, dialog, cdt, cdn);
            }
        }
    });
}

function create_new_item(frm, values, dialog, cdt, cdn) {
    const item_doc = {
        doctype: 'Item',
        item_code: values.item_code,
        item_group: values.item_group,
        standard_rate: values.standard_rate,
        yf_researchers: (values.researchers || []).map(row => ({
            researchers: row.researchers,
            commission_rate: row.commission_rate,
            parentfield: 'yf_researchers',
            parenttype: 'Item'
        }))
    };

    frappe.call({
        method: 'frappe.client.insert',
        args: { doc: item_doc },
        callback(response) {
            if (response.message) {
                frappe.msgprint(__('Item Created Successfully: {0}', [response.message.name]));
                add_item_to_opportunity(frm, response.message.item_code);
                update_crm_note_item_code(frm, response.message.item_code, cdt, cdn);

                frm.refresh_field('yf_researchers');
            }
            dialog.hide();
        },
        error: (err) => {
            frappe.msgprint(__('An error occurred while saving the item.'));
            console.error(err);
        }
    });
}

function update_existing_item(frm, values, item_name, dialog, cdt, cdn) {
    frappe.call({
        method: 'frappe.client.get',
        args: { doctype: 'Item', name: item_name },
        callback(response) {
            if (response.message) {
                let item_doc = response.message;

                item_doc.item_group = values.item_group;
                item_doc.standard_rate = values.standard_rate;

                item_doc.yf_researchers = (values.researchers || []).map(row => ({
                    researchers: row.researchers,
                    commission_rate: row.commission_rate,
                    parent: item_name,
                    parentfield: 'yf_researchers',
                    parenttype: 'Item'
                }));

                frappe.call({
                    method: 'frappe.client.save',
                    args: { doc: item_doc },
                    callback(save_response) {
                        if (save_response.message) {
                            frappe.msgprint(__('Item updated successfully: {0}', [save_response.message.name]));
                            add_item_to_opportunity(frm, save_response.message.item_code);
                            update_crm_note_item_code(frm, save_response.message.item_code, cdt, cdn);
                        }
                        dialog.hide();
                    },
                    error: (err) => {
                        frappe.msgprint(__('An error occurred while updating the item.'));
                        console.error(err);
                    }
                });
            }
        }
    });
}

function add_item_to_opportunity(frm, item_code) {
    frappe.call({
        method: 'sales_commission_management.api.add_item_to_opportunity',
        args: { opportunity_name: frm.doc.name, item_code: item_code },
        callback(response) {
            if (response.message && !response.message.error) {
                let item_data = response.message;

                let existing_items = frm.doc.items || [];
                let existing_row = existing_items.find(row => row.item_code === item_code);

                if (existing_row) {
                    frm.doc.items = existing_items.filter(row => row.item_code !== item_code);
                }
                let child = frm.add_child("items");
                let cdt = child.doctype;
                let cdn = child.name;

                frappe.model.set_value(cdt, cdn, "item_code", item_data.item_code);
                frappe.model.set_value(cdt, cdn, "item_name", item_data.item_name);
                frappe.model.set_value(cdt, cdn, "description", item_data.description);
                frappe.model.set_value(cdt, cdn, "rate", item_data.rate || 0);
                frappe.model.set_value(cdt, cdn, "amount", item_data.amount || 0);
                frappe.model.set_value(cdt, cdn, "qty", item_data.qty || 1);

                frm.refresh_field("items");
            }
        }
    });
}

function update_crm_note_item_code(frm, item_code, cdt, cdn) {

    console.log("Updating CRM Note Item Code:", item_code, "CDT:", cdt, "CDN:", cdn);

    if (!cdt || !cdn) {
        console.error("CDT or CDN is undefined!");
        return;
    }

    frappe.model.set_value(cdt, cdn, "yf_custom_item", item_code);
    frm.refresh_field("crm_notes");
}  


function open_item_dialog2(frm, cdt, cdn) {
    const child_row = frappe.get_doc(cdt, cdn);
    const custom_item_code = child_row.custom_item_code || '';  
    const added_by = child_row.added_by || '';
    const custom_commission_rate = child_row.custom_commission_rate || 0;  

    frappe.call({
        method: 'sales_commission_management.api.get_item_data', 
        args: { custom_item_code: custom_item_code },
        callback(response) {
            let item_data = response.message ? response.message.item : null;
            let researchers_data = response.message ? response.message.researchers : [];

            if (!item_data) {
                item_data = { item_code: custom_item_code, item_group: '', standard_rate: 0 };
                researchers_data = [];
            }

            let researcher = researchers_data.find(r => r.researchers === added_by);

            if (researcher) {
                researcher.commission_rate = custom_commission_rate;
            } else if (added_by) {
                researchers_data.push({
                    researchers: added_by,
                    commission_rate: custom_commission_rate  
                });
            }

            show_item_dialog(frm, item_data, researchers_data);
        }
    });
}




//    frappe.ui.form.on('CRM Note', {
//     added_by: function(frm, cdt, cdn) {
//       var row = locals[cdt][cdn]; 
//       if (row.added_by) {
//             var unique_id = 'AD-' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
//             console.log(unique_id)
            
//             frappe.model.set_value(cdt, cdn, 'yf_added_by_id', unique_id);
//         }
//     },
//     custom_create_item: function (frm, cdt, cdn) {
       
//       open_item_dialog(frm, cdt, cdn);
//    },
//    custom_approved: function (frm, cdt, cdn) {
//     var row = locals[cdt][cdn];
//        if ( row.custom_approved==1){
//       open_item_dialog(frm, cdt, cdn);
//    }}
// });

// function show_item_dialog(frm, item_data, researchers_data) {
//   const dialog = new frappe.ui.Dialog({
//       title: __('Item Details'),
//       fields: [
//           { fieldname: 'item_code', fieldtype: 'Data', label: __('Item Code'), reqd: 1, default: item_data.item_code },
//           { fieldname: 'item_group', fieldtype: 'Link', options: 'Item Group', label: __('Item Group'), reqd: 1, default: item_data.item_group },
//           { fieldname: 'standard_rate', fieldtype: 'Currency', label: __('Standard Rate'), reqd: 1, default: item_data.standard_rate },
//           {
//               fieldname: 'researchers',
//               fieldtype: 'Table',
//               label: __('Researchers'),
//               cannot_add_rows: false,
//               allow_bulk_edit: true,
//               data: researchers_data,
//               fields: [
//                   { fieldname: 'researchers', fieldtype: 'Link', options: 'User', label: __('Researchers'), in_list_view: 1, reqd: 1 },
//                   { fieldname: 'commission_rate', fieldtype: 'Float', label: __('Commission Rate'), in_list_view: 1, reqd: 1 }
//               ]
//           }
//       ],
//       primary_action_label: __('Save'),
//       primary_action(values) {
//           save_item_data(frm, values, dialog);
//       }
//   });

//   dialog.show();
// }

// function save_item_data(frm, values, dialog) {
//   frappe.call({
//       method: 'frappe.client.get_list',
//       args: {
//           doctype: 'Item',
//           filters: { item_code: values.item_code },
//           fields: ['name']
//       },
//       callback(response) {
//           if (response.message && response.message.length > 0) {
//               update_existing_item(frm, values, response.message[0].name, dialog);
//           } else {
//               create_new_item(frm, values, dialog);
//           }
//       }
//   });
// }

// function create_new_item(frm, values, dialog) {
//   const item_doc = {
//       doctype: 'Item',
//       item_code: values.item_code,
//       item_group: values.item_group,
//       standard_rate: values.standard_rate,
//       yf_researchers: (values.researchers || []).map(row => ({
//           researchers: row.researchers,
//           commission_rate: row.commission_rate,
//           parentfield: 'yf_researchers',
//           parenttype: 'Item'
//       }))
//   };

//   frappe.call({
//       method: 'frappe.client.insert',
//       args: { doc: item_doc, ignore_permissions: 1 },
//       callback(response) {
//           if (response.message) {
//               frappe.msgprint(__('Item created successfully: {0}', [response.message.name]));
//               frm.reload_doc();
//           }
//           dialog.hide();
//       },
//       error: (err) => {
//           frappe.msgprint(__('An error occurred while saving the item.'));
//           console.error(err);
//       }
//   });
// }

// function update_existing_item(frm, values, item_name, dialog) {
//   frappe.call({
//       method: 'frappe.client.get',
//       args: {
//           doctype: 'Item',
//           name: item_name
//       },
//       callback(response) {
//           if (response.message) {
//               let item_doc = response.message;

//               item_doc.item_group = values.item_group;
//               item_doc.standard_rate = values.standard_rate;

//               item_doc.yf_researchers = (values.researchers || []).map(row => ({
//                   researchers: row.researchers,
//                   commission_rate: row.commission_rate,
//                   parent: item_name,
//                   parentfield: 'yf_researchers',
//                   parenttype: 'Item'
//               }));

//               frappe.call({
//                   method: 'frappe.client.save',
//                   args: { doc: item_doc },
//                   callback(save_response) {
//                       if (save_response.message) {
//                           frappe.msgprint(__('Item updated successfully: {0}', [save_response.message.name]));
//                           frm.reload_doc();
//                       }
//                       dialog.hide();
//                   },
//                   error: (err) => {
//                       frappe.msgprint(__('An error occurred while updating the item.'));
//                       console.error(err);
//                   }
//               });
//           }
//       }
//   });
// }




// erpnext.utils.CustomCRMNotes = class CustomCRMNotes extends erpnext.utils.CRMNotes {
//     constructor(opts) {
//         super(opts); 
//     }

//     refresh() {
//         var me = this;
//         this.notes_wrapper.find(".notes-section").remove();

//         let notes = this.frm.doc.notes || [];
//         notes.sort(function (a, b) {
//             return new Date(b.added_on) - new Date(a.added_on);
//         });

//         let notes_html = frappe.render_template("crm_notes", {
//             notes: notes,
//         });
//         $(notes_html).appendTo(this.notes_wrapper);

//         this.add_note();

//         $(".notes-section")
//             .find(".edit-note-btn")
//             .on("click", function () {
//                 me.edit_note(this);
//             });

//         $(".notes-section")
//             .find(".delete-note-btn")
//             .on("click", function () {
//                 me.delete_note(this);
//             });
//     }

//     add_note() {
//         let me = this;
//         let _add_note = () => {
//             var d = new frappe.ui.Dialog({
//                 title: __("Add a Note"),
//                 fields: [
//                     {
//                         label: "Item Code",
//                         fieldname: "custom_item_code",
//                         fieldtype: "Link",
//                         options: "Item",
//                         reqd: 1,
//                     },
//                     {
//                         label: "Note",
//                         fieldname: "note",
//                         fieldtype: "Text Editor",
//                         reqd: 1,
//                         enable_mentions: true,
//                     },
//                     {
//                         label: "Description",
//                         fieldname: "custom_description",
//                         fieldtype: "Data",
//                         reqd: 1,
//                     },
//                 ],
//                 primary_action: function () {
//                     var data = d.get_values();
//                     frappe.call({
//                         method: 'sales_commission_management.api.add_note',

//                         // doc: me.frm.doc,
//                         args: {
//                             note: data.note,
//                             custom_item_code: data.custom_item_code,
//                             custom_description: data.custom_description,
//                             docname: me.frm.doc.name
//                         },
//                         freeze: true,
//                         callback: function (r) {
//                             if (!r.exc) {
//                                 me.frm.refresh_field("notes");
//                                 me.refresh();
//                             }
//                             d.hide();
//                         },
//                     });
//                 },
//                 primary_action_label: __("Add"),
//             });
//             d.show();
//         };
//         $(".new-note-btn").click(_add_note);
//     }

//     edit_note(edit_btn) {
//         var me = this;
//         let row = $(edit_btn).closest(".comment-content");
//         let row_id = row.attr("name");
//         let row_content = $(row).find(".content").html();
//         if (row_content) {
//             var d = new frappe.ui.Dialog({
//                 title: __("Edit Note"),
//                 fields: [
//                     {
//                         label: "Note",
//                         fieldname: "note",
//                         fieldtype: "Text Editor",
//                         default: row_content,
//                     },
//                 ],
//                 primary_action: function () {
//                     var data = d.get_values();
//                     frappe.call({
//                         method: "edit_note",
//                         doc: me.frm.doc,
//                         args: {
//                             note: data.note,
//                             row_id: row_id,
//                         },
//                         freeze: true,
//                         callback: function (r) {
//                             if (!r.exc) {
//                                 me.frm.refresh_field("notes");
//                                 me.refresh();
//                                 d.hide();
//                             }
//                         },
//                     });
//                 },
//                 primary_action_label: __("Done"),
//             });
//             d.show();
//         }
//     }

//     delete_note(delete_btn) {
//         var me = this;
//         let row_id = $(delete_btn).closest(".comment-content").attr("name");
//         frappe.call({
//             method: "delete_note",
//             doc: me.frm.doc,
//             args: {
//                 row_id: row_id,
//             },
//             freeze: true,
//             callback: function (r) {
//                 if (!r.exc) {
//                     me.frm.refresh_field("notes");
//                     me.refresh();
//                 }
//             },
//         });
//     }
// };
// frappe.ui.form.on('Opportunity', {
//     // setup: function(frm) {
//     //     frm.fields_dict["notes"].grid.get_field("yf_custom_item").get_query = function(doc, cdt, cdn) {
//     //      let d = locals[cdt][cdn];
//     //      return {
//     //       query: "sales_commission_management.sales_commission_management.doctype.api.get_item",
//     //       filters: {
//     //         "added_by": d.added_by,
//     //                                 }
//     //      };
//     //     }
//     refresh(frm) {  
        
//         frm.trigger("show_notes");
//         frm.trigger("show_activities");    },

//     show_notes(frm) { 
//         const crm_notes = new erpnext.utils.CustomCRMNotes({
//             frm: frm,
//             notes_wrapper: $(frm.fields_dict.notes_html.wrapper),
//         });
//         crm_notes.refresh();
        
//     },
    
//     show_activities: function(frm) {
//         const crm_activities = new erpnext.utils.CRMActivities({
//             frm: frm,
//             open_activities_wrapper: $(frm.fields_dict.open_activities_html.wrapper),
//             all_activities_wrapper: $(frm.fields_dict.all_activities_html.wrapper),
//             form_wrapper: $(frm.wrapper),
//         });
//         crm_activities.refresh();
//     }
       

//     });
