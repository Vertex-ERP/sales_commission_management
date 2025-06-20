import frappe

@frappe.whitelist()
def get_item_data(custom_item_code):
    if not custom_item_code:
        return None

    item = frappe.get_value("Item", {"item_code": custom_item_code}, ["name", "item_code", "item_group", "standard_rate"], as_dict=True)

    if not item:
        return None

    researchers = frappe.get_all("Researchers Table", filters={"parent": item.get("name")}, fields=["researchers", "commission_rate"])

    return {
        "item": item,
        "researchers": researchers
    }
import frappe
from frappe.model.document import Document
from frappe.utils import now, cstr
   
@frappe.whitelist()
def add_note(note, custom_item_code, docname,custom_description=None):
    doc = frappe.get_doc("Opportunity", docname) 
    doc.append("notes", {
        "note": note,
        "added_by": frappe.session.user,
        "added_on": now(),
        "custom_item_code": custom_item_code,
        "custom_description": custom_description
    })
    doc.save()
@frappe.whitelist()
def edit_note(note, row_id, custom_item_code=None, custom_description=None):
    doc = frappe.get_doc("Opportunity", frappe.form_dict.get("docname"))
    for d in doc.notes:
        if cstr(d.name) == row_id:
            d.note = note
            d.custom_item_code = custom_item_code
            d.custom_description = custom_description
            d.db_update()
    doc.save()


import frappe

@frappe.whitelist()
def add_item_to_opportunity(opportunity_name, item_code):
    
    item = frappe.get_doc("Item", item_code)
    unique_id = frappe.generate_hash(length=10)
    item_data = {
        "item_code": item.item_code,
        "item_name": item.item_name,
        "rate": item.standard_rate or 0,
        "amount": item.standard_rate or 0,
        "qty": 1
    }

    return item_data
    
