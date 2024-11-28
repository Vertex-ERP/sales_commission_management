
import frappe
#     # بدء تتبع البيانات المدخلة
    
#     # جلب أمر البيع المرتبط بالفاتورة
#     sales_order = frappe.get_value("Sales Invoice Item", {"parent": sales_invoice_name}, "sales_order")
    
#     if not sales_order:
#         return {}

#     # جلب عرض السعر المرتبط بأمر البيع
#     quotation = frappe.get_value("Sales Order Item", {"parent": sales_order}, "prevdoc_docname")
    
#     if not quotation:
#         return {}

#     # جلب الفرصة المرتبطة بعرض السعر
#     opportunity = frappe.get_value("Quotation", {"name": quotation}, "opportunity")
    
#     if not opportunity:
#         return {}

#     # جلب اسم العميل المحتمل من الفرصة
#     lead_name = frappe.get_value("Opportunity", {"name": opportunity}, "party_name")
#     frappe.msgprint(f"Lead Name: {lead_name}", title="Lead Debugging")
    
#     # جلب سجلات الجدولة
#     scheduling_records = frappe.get_all(
#         "Structure Field",
#         filters={"parent": scheduling_name},
#         fields=["doctype_name", "doctype_field", "earn_commission"]
#     )
#     frappe.msgprint(f"Scheduling Records: {scheduling_records}", title="Scheduling Records Debugging")
    
#     dynamic_results = {}
#     duplicate_fields = {}
#     unique_fields = {}

#     for record in scheduling_records:
#         doctype = record.get("doctype_name")
#         field = record.get("doctype_field")
#         earn_commission = record.get("earn_commission")

#         frappe.msgprint(
#             f"Processing Record: Doctype={doctype}, Field={field}, Earn Commission={earn_commission}",
#             title="Record Debugging"
#         )

#         # جلب القيم بناءً على نوع السجل
#         if doctype == "Lead" and lead_name:
#             field_value = frappe.get_value(doctype, {"name": lead_name}, field)
#         elif doctype == "Opportunity" and opportunity:
#             field_value = frappe.get_value(doctype, {"name": opportunity}, field)
#         elif doctype == "Sales Order" and sales_order:
#             field_value = frappe.get_value(doctype, {"name": sales_order}, field)
#         elif doctype == "Quotation" and quotation:
#             field_value = frappe.get_value(doctype, {"name": quotation}, field)
#         else:
#             field_value = None

#         frappe.msgprint(f"Field Value: {field_value}", title="Field Value Debugging")

#         if field not in duplicate_fields:
#             duplicate_fields[field] = []
#         duplicate_fields[field].append(field_value)

#         if field_value not in duplicate_fields[field] or len(duplicate_fields[field]) == 1:
#             unique_fields[field] = field_value

#     for field, values in duplicate_fields.items():
#         for field_value in set(values):  # Use set to avoid duplicate values
#             earn_commission = next(
#                 (record["earn_commission"] for record in scheduling_records if record["doctype_field"] == field and record["earn_commission"] == 1),
#                 None
#             )
#             if earn_commission == 1:
#                 dynamic_results[field] = field_value
#                 frappe.msgprint(f"Dynamic Result: Field={field}, Value={field_value}", title="Dynamic Results Debugging")

#     frappe.msgprint(f"Final Dynamic Results: {dynamic_results}", title="Final Results")
#     return dynamic_results
# النسخه 1
# @frappe.whitelist()
# def get_commission_details(sales_invoice_name, scheduling_name):
#     sales_order = frappe.get_value("Sales Invoice Item", {"parent": sales_invoice_name}, "sales_order")
    
#     if not sales_order:
#         return []

#     quotation = frappe.get_value("Sales Order Item", {"parent": sales_order}, "prevdoc_docname")
    
#     if not quotation:
#         return []

#     opportunity = frappe.get_value("Quotation", {"name": quotation}, "opportunity")
    
#     if not opportunity:
#         return []

#     lead_name = frappe.get_value("Opportunity", {"name": opportunity}, "party_name")
#     frappe.msgprint(f"Lead Name: {lead_name}", title="Lead Debugging")
    
#     scheduling_records = frappe.get_all(
#         "Structure Field",
#         filters={"parent": scheduling_name},
#         fields=["doctype_name", "doctype_field", "earn_commission"]
#     )
#     frappe.msgprint(f"Scheduling Records: {scheduling_records}", title="Scheduling Records Debugging")
    
#     dynamic_results = []

#     for record in scheduling_records:
#         doctype = record.get("doctype_name")
#         field = record.get("doctype_field")
#         earn_commission = record.get("earn_commission")

#         frappe.msgprint(
#             f"Processing Record: Doctype={doctype}, Field={field}, Earn Commission={earn_commission}",
#             title="Record Debugging"
#         )

#         field_value = None
#         if doctype == "Lead" and lead_name:
#             field_value = frappe.get_value(doctype, {"name": lead_name}, field)
#         elif doctype == "Opportunity" and opportunity:
#             field_value = frappe.get_value(doctype, {"name": opportunity}, field)
#         elif doctype == "Sales Order" and sales_order:
#             field_value = frappe.get_value(doctype, {"name": sales_order}, field)
#         elif doctype == "Quotation" and quotation:
#             field_value = frappe.get_value(doctype, {"name": quotation}, field)
        
#         if field == "yf_researcher" and opportunity:
#             child_table_data = frappe.get_all(
#                 "CRM Note",
#                 filters={"parent": opportunity,
#                          "approve": 1},
#                 fields=["added_by"]
#             )
#             if child_table_data:
#                 for note in child_table_data:
#                     email = note.get('added_by')
#                     if email:
#                         dynamic_results.append({"field": "yf_researcher", "value": email})  

#         if field_value and earn_commission == 1:
#             dynamic_results.append({"field": field, "value": field_value})  

#     frappe.msgprint(f"Final Dynamic Results: {dynamic_results}", title="Final Results")
    
#     return dynamic_results
@frappe.whitelist()
def get_commission_details(sales_invoice_name, scheduling_name):
    frappe.msgprint("hi")
    frappe.msgprint("hi")

    sales_order = frappe.get_value("Sales Invoice Item", {"parent": sales_invoice_name}, "sales_order")
    
    if not sales_order:
        return []

    quotation = frappe.get_value("Sales Order Item", {"parent": sales_order}, "prevdoc_docname")
    
    if not quotation:
        return []

    opportunity = frappe.get_value("Quotation", {"name": quotation}, "opportunity")
    
    if not opportunity:
        return []

    lead_name = frappe.get_value("Opportunity", {"name": opportunity}, "party_name")
    
    scheduling_records = frappe.get_all(
        "Structure Field",
        filters={"parent": scheduling_name},
        fields=["doctype_name", "doctype_field", "earn_commission"]
    )
    
    all_values = [] 
    repeated_values = [] 
    unique_values = [] 

    for record in scheduling_records:
        doctype = record.get("doctype_name")
        field = record.get("doctype_field")
        earn_commission = record.get("earn_commission")

        field_value = None
        if doctype == "Lead" and lead_name:
            field_value = frappe.get_value(doctype, {"name": lead_name}, field)
        elif doctype == "Opportunity" and opportunity:
            field_value = frappe.get_value(doctype, {"name": opportunity}, field)
        elif doctype == "Sales Order" and sales_order:
            field_value = frappe.get_value(doctype, {"name": sales_order}, field)
        elif doctype == "Quotation" and quotation:
            field_value = frappe.get_value(doctype, {"name": quotation}, field)

        if field == "yf_researcher" and opportunity:
            child_table_data = frappe.get_all(
                "CRM Note",
                filters={"parent": opportunity, "approve": 1},
                fields=["added_by"]
            )
            if child_table_data:
                for note in child_table_data:
                    email = note.get('added_by')
                    if email:
                        all_values.append({"field": "yf_researcher", "value": email, "earn_commission": earn_commission})  # إضافة اسم الحقل مع القيمة

        if field_value:
            all_values.append({"field": field, "value": field_value, "earn_commission": earn_commission})

    seen_values = {}  
    for item in all_values:
        value = item["value"]
        earn_commission = item.get("earn_commission") 

        if value in seen_values:
            repeated_values.append({"field": item["field"], "value": value, "earn_commission": earn_commission})
        else:
            seen_values[value] = True
            unique_values.append({"field": item["field"], "value": value, "earn_commission": earn_commission})

    for unique_item in unique_values[:]:
        if any(item["value"] == unique_item["value"] for item in repeated_values):
            repeated_values.append(unique_item)
            unique_values.remove(unique_item)

    final_repeated_values = []
    for item in repeated_values:
        if item.get("earn_commission") :
            final_repeated_values.append(item)
    
    final_results = final_repeated_values + unique_values

    return final_results



@frappe.whitelist()
def get_sales_man_details(user:str = None ) -> list:
    """
        args User => Current User 
        
        Return List of Sales Man Details or []

    """
    if not user :
        user = frappe.session.user
        
    employee = frappe.db.get_value("Employee" , { "user_id" : user } , "name")
    sales_man = frappe.db.get_value("Sales Man" , { "employee" : employee } , "name")
    sales_man_managers = frappe.db.get_all("Sales Man Mangers" , { "parent" : sales_man } , ["sales_man" , "sales_manager" , "department_manger" , "branch_supervisor"])
    return sales_man_managers if employee and sales_man else []
# your_custom_app/api.py


@frappe.whitelist()
def get_rate(scheduling_name, type):
    result = frappe.db.sql("""
        SELECT sf.rate
        FROM `tabCommission Structure` s
        JOIN `tabStructure Field` sf ON sf.parent = s.name
        WHERE s.name = %s AND sf.doctype_field = %s
    """, (scheduling_name, type), as_dict=True)

    if result:
        rate = result[0].get("rate")
        if rate:
            
            return rate
        else:
            return None
    else:
        return None
@frappe.whitelist()
def calculate_total_commission(commission_rate, total):
    try:
        commission_rate = float(commission_rate) if commission_rate else 0
        total = float(total) if total else 0
        total_commission = (commission_rate / 100) * total 
        return total_commission
    except Exception as e:
        frappe.log_error(message=f"Error calculating total commission: {e}", title="Commission Calculation Error")
        return 0  

  

