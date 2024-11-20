
import frappe

@frappe.whitelist()
def get_commission_details(sales_invoice_name, scheduling_name):
    sales_order = frappe.get_value("Sales Invoice Item", {"parent": sales_invoice_name}, "sales_order")
    if not sales_order:
        return {}
    
    quotation = frappe.get_value("Sales Order Item", {"parent": sales_order}, "prevdoc_docname")
    if not quotation:
        return {}
    
    opportunity = frappe.get_value("Quotation", {"name": quotation}, "opportunity")
    if not opportunity:
        return {}
    
    lead_name = frappe.get_value("Opportunity", {"name": opportunity}, "party_name")
    
    scheduling_records = frappe.get_all(
        "Structure Field",
        filters={"parent": scheduling_name},
        fields=["doctype_name", "doctype_field", "earn_commission"]
    )
    
    dynamic_results = {}
    field_values = {}
    duplicate_fields = {}
    unique_fields = {} 

    for record in scheduling_records:
        doctype = record.get("doctype_name")
        field = record.get("doctype_field")
        earn_commission = record.get("earn_commission")


        if doctype == "Lead" and lead_name:
            field_value = frappe.get_value(doctype, {"name": lead_name}, field)
        elif doctype == "Opportunity" and opportunity:
            field_value = frappe.get_value(doctype, {"name": opportunity}, field)
        elif doctype == "Sales Order" and sales_order:
            field_value = frappe.get_value(doctype, {"name": sales_order}, field)
        elif doctype == "Quotation" and quotation:
            field_value = frappe.get_value(doctype, {"name": quotation}, field)
        else:
            field_value = None

        if field not in duplicate_fields:
            duplicate_fields[field] = []
        duplicate_fields[field].append(field_value)

        if field_value not in duplicate_fields[field] or len(duplicate_fields[field]) == 1:
            unique_fields[field] = field_value

    for field, values in duplicate_fields.items():
        for field_value in set(values):  # Use set to avoid duplicate values
            earn_commission = next(
                (record["earn_commission"] for record in scheduling_records if record["doctype_field"] == field and record["earn_commission"] ==1 ),
                None
            )
         
            if earn_commission==1 :
                dynamic_results[field] = field_value



    return dynamic_results



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

  

