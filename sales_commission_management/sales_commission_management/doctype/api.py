
import frappe

@frappe.whitelist()
def get_commission_details(sales_invoice_name, scheduling_name):
    
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

        # if field == "yf_researcher" and opportunity:
        #     child_table_data = frappe.get_all(
        #         "CRM Note",
        #         filters={"parent": opportunity, "approve": 1},
        #         fields=["added_by"]
        #     )
        #     if child_table_data:
        #         for note in child_table_data:
        #             email = note.get('added_by')
        #             if email:
        #                 all_values.append({"field": "yf_researcher", "value": email, "earn_commission": earn_commission})  # إضافة اسم الحقل مع القيمة
        if field == "yf_researcher" and opportunity:
            child_table_data = frappe.get_all(
                "Opportunity Item",
                filters={"parent": opportunity},
                fields=["yf_custom_researcher"]
            )
            if child_table_data:
                for note in child_table_data:
                    email = note.get('yf_custom_researcher')
                    if email:
                        all_values.append({"field": "yf_researcher", "value": email, "earn_commission": earn_commission})  # إضافة اسم الحقل مع القيمة
        if field == "opportunity_owner" and opportunity:
            custom_owners = frappe.get_all(
                "Opportunity Owners",
                filters={"parent": opportunity},
                fields=["owner_name"]
            )
            if custom_owners:
                for owner in custom_owners:
                    owner_name = owner.get('owner_name')
                    if owner_name:
                        all_values.append({"field": "opportunity_owner", "value": owner_name, "earn_commission": earn_commission})

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

  

