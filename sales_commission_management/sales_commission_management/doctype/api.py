# sales_commission_management/.../doctype/api.py
import frappe
from frappe import _
from typing import List, Dict, Any, Optional

# ---------------------------
# Helpers & Notices
# ---------------------------

def _append_notice(notices: List[Dict[str, Any]], severity: str, message: str, **context):
    payload = {"severity": severity, "message": message, "context": context or {}}
    notices.append(payload)
    if severity in {"error", "warning"}:
        frappe.logger("commission").info(f"{severity.upper()}: {message} | {context}")


def _field_exists(doctype: str, fieldname: str) -> bool:
    try:
        meta = frappe.get_meta(doctype)
        return any(df.fieldname == fieldname for df in meta.fields)
    except Exception:
        return False


# ---------------------------
# Plan A (header chain) & Plan B (item-level guess)
# ---------------------------

def _resolve_links_from_sales_invoice(si_name, notices):
    si = frappe.get_doc("Sales Invoice", si_name)

    sales_order = None
    quotation = None
    opportunity = None
    lead_name = None

    # 1) gather SOs from SI items
    so_names = {row.sales_order for row in si.items if getattr(row, "sales_order", None)}
    if so_names:
        # prefer a single SO; adjust if you support mixed
        sales_order = next(iter(so_names))

        # 2) inspect SO items to discover possible quotation/opportunity links
        # read ONLY columns that certainly exist
        so_items = frappe.get_all(
            "Sales Order Item",
            filters={"parent": sales_order},
            fields=["name", "parent", "item_code"]  # safe baseline
        )

        # try common modern fields if present
        # (works whether columns exist or not)
        def pick_optional_fields(doctype, names, wanted):
            have = [f for f in wanted if frappe.db.has_column(doctype, f)]
            return frappe.get_all(doctype, filters={"name": ["in", names]}, fields=["name"] + have) if have else []

        # attempt to fetch quotation references directly from SO (parent)
        if frappe.db.has_column("Sales Order", "opportunity"):
            opp = frappe.db.get_value("Sales Order", sales_order, "opportunity")
            opportunity = opp or opportunity
        if frappe.db.has_column("Sales Order", "quotation"):
            quotation = quotation or frappe.db.get_value("Sales Order", sales_order, "quotation")

        # 3) if quotation still unknown, try to infer via SO Item optional fields
        so_item_names = [r["name"] for r in so_items]
        extra = pick_optional_fields(
            "Sales Order Item",
            so_item_names,
            ["quotation", "quotation_item", "reference_doctype", "reference_docname"]
        )
        for r in extra:
            if r.get("quotation"):
                quotation = r["quotation"]; break
            if r.get("reference_doctype") == "Quotation" and r.get("reference_docname"):
                quotation = r["reference_docname"]; break

    # 4) backfill lead from Quotation or Sales Order if available
    if quotation and frappe.db.has_column("Quotation", "party_name"):
        # party_name holds Customer/Lead depending on quotation_to
        q = frappe.get_doc("Quotation", quotation)
        if getattr(q, "quotation_to", None) == "Lead":
            lead_name = getattr(q, "party_name", None)
        opportunity = opportunity or getattr(q, "opportunity", None)

    if not sales_order:
        notices.append("No Sales Order linked on Sales Invoice items.")

    return sales_order, quotation, opportunity, lead_name


def _guess_opportunity_by_item(item_code: str, customer: Optional[str] = None, posting_date: Optional[str] = None):
    candidates = []
    # Quotation Item -> Quotation -> Opportunity
    q_sql = """
        SELECT qi.parent AS quotation, q.opportunity, q.transaction_date, q.party_name
        FROM `tabQuotation Item` qi
        JOIN `tabQuotation` q ON q.name = qi.parent
        WHERE qi.item_code = %s
          AND q.docstatus < 2
          {customer_filter}
          AND q.opportunity IS NOT NULL
        ORDER BY q.modified DESC
        LIMIT 50
    """
    customer_filter = "AND q.party_name = %s" if customer else ""
    params = [item_code] + ([customer] if customer else [])
    for row in frappe.db.sql(q_sql.format(customer_filter=customer_filter), params, as_dict=True):
        candidates.append({"opportunity": row.get("opportunity"), "via": "quotation_item", "party_name": row.get("party_name"), "date": row.get("transaction_date")})

    # Opportunity Item -> Opportunity (if exists)
    try:
        oi_sql = """
            SELECT oi.parent AS opportunity, o.party_name, o.transaction_date
            FROM `tabOpportunity Item` oi
            JOIN `tabOpportunity` o ON o.name = oi.parent
            WHERE oi.item_code = %s
              AND o.docstatus < 2
            ORDER BY o.modified DESC
            LIMIT 50
        """
        for row in frappe.db.sql(oi_sql, (item_code,), as_dict=True):
            if customer and row.get("party_name") and row["party_name"] != customer:
                continue
            candidates.append({"opportunity": row.get("opportunity"), "via": "opportunity_item", "party_name": row.get("party_name"), "date": row.get("transaction_date")})
    except Exception:
        pass

    if not candidates:
        return None

    from datetime import datetime
    def score_fn(c):
        score = 0.0
        if customer and c.get("party_name") == customer:
            score += 2.0
        if posting_date and c.get("date"):
            try:
                inv = datetime.fromisoformat(str(posting_date))
                dt = datetime.fromisoformat(str(c["date"]))
                delta_days = abs((inv - dt).days)
                score += max(0, 1.5 - (delta_days / 30.0))
            except Exception:
                pass
        if c.get("via") == "quotation_item":
            score += 0.2
        return score
    best = max(candidates, key=score_fn)
    best["score"] = score_fn(best)
    return best


def _resolve_links_per_item(si_name: str, notices: Optional[List[Dict[str, Any]]] = None):
    notices = notices or []
    results = []
    inv = frappe.get_doc("Sales Invoice", si_name)
    customer = getattr(inv, "customer", None)
    posting_date = getattr(inv, "posting_date", None)

    # Determine available SI Item fields dynamically
    si_item_fields = ["name", "item_code", "sales_order", "so_detail"]
    if _field_exists("Sales Invoice Item", "quotation"):
        si_item_fields.append("quotation")
    if _field_exists("Sales Invoice Item", "quotation_item"):
        si_item_fields.append("quotation_item")

    si_items = frappe.get_all("Sales Invoice Item", filters={"parent": si_name}, fields=si_item_fields)
    so_item_has_qtn_detail = _field_exists("Sales Order Item", "prevdoc_detail_docname")

    for it in si_items:
        so = it.get("sales_order")
        so_item = it.get("so_detail")
        quotation = it.get("quotation") if "quotation" in si_item_fields else None
        quotation_item = it.get("quotation_item") if "quotation_item" in si_item_fields else None

        if so_item and not quotation:
            try:
                quotation = frappe.get_value("Sales Order Item", so_item, "prevdoc_docname")
            except Exception:
                pass
            if so_item_has_qtn_detail and not quotation_item:
                try:
                    quotation_item = frappe.get_value("Sales Order Item", so_item, "prevdoc_detail_docname")
                except Exception:
                    pass

        opportunity = None
        if quotation:
            try:
                opportunity = frappe.get_value("Quotation", quotation, "opportunity")
            except Exception:
                _append_notice(notices, "error", _("Failed to read opportunity from Quotation."), quotation=quotation)

        via = None
        if not opportunity and it.get("item_code"):
            guess = _guess_opportunity_by_item(it["item_code"], customer=customer, posting_date=str(posting_date) if posting_date else None)
            if guess:
                opportunity = guess["opportunity"]
                via = guess["via"]
                notices.append({"severity": "info", "message": _("Item-level fallback used to resolve Opportunity."), "context": {"item_code": it["item_code"], "via": via, "opportunity": opportunity}})

        lead_name = None
        if opportunity:
            try:
                lead_name = frappe.get_value("Opportunity", opportunity, "party_name")
            except Exception:
                _append_notice(notices, "error", _("Failed to read lead from Opportunity."), opportunity=opportunity)

        results.append({
            "si_item_name": it.get("name"),
            "item_code": it.get("item_code"),
            "so": so,
            "so_item": so_item,
            "quotation": quotation,
            "quotation_item": quotation_item,
            "opportunity": opportunity,
            "lead": lead_name,
            "resolved_via": via or ("chain" if opportunity and quotation else None),
        })
    return results


# ---------------------------
# Dedupe utilities
# ---------------------------

def _dedupe_notices(notices: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out = []
    for n in notices or []:
        key = (n.get("severity"), n.get("message"), frappe.as_json(n.get("context", {}), indent=0, separators=(",", ":")))
        if key not in seen:
            seen.add(key)
            out.append(n)
    return out


def _dedupe_commission_values(values: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out = []
    for v in values or []:
        custom = v.get("custom_item")
        if isinstance(custom, list):
            custom_key = tuple(sorted([str(x) for x in custom]))
        else:
            custom_key = tuple([str(custom)]) if custom else tuple()
        key = (v.get("field"), str(v.get("value")), v.get("source") or "", v.get("si_item") or "", v.get("item_code") or "", custom_key)
        if key not in seen:
            seen.add(key)
            out.append(v)
    return out


# ---------------------------
# Main API: get_commission_details
# ---------------------------

@frappe.whitelist()
def get_commission_details(sales_invoice_name: str, scheduling_name: str = None):
    notices = []
    all_values = []

    # Plan A (header)
    sales_order, quotation, opportunity, lead_name = _resolve_links_from_sales_invoice(sales_invoice_name, notices)

    # Plan B (per-item links)
    item_links = _resolve_links_per_item(sales_invoice_name, notices)

    # If header missing opp, try set from first item-level opp (compat)
    if not opportunity:
        header_opp = next((x["opportunity"] for x in item_links if x.get("opportunity")), None)
        if header_opp:
            opportunity = header_opp
            lead_name = frappe.get_value("Opportunity", {"name": opportunity}, "party_name")
            _append_notice(notices, "info", _("Header-level Opportunity was set from item-level fallback."), opportunity=opportunity)

    if not sales_order and not opportunity:
        _append_notice(notices, "error", _("Commission could not be computed: no SO and no item-level Opportunity candidates."), sales_invoice=sales_invoice_name)
        return {"commission_details": [], "custom_item": [], "opportunity": None, "notices": _dedupe_notices(notices), "item_links": item_links}

    if not scheduling_name:
        _append_notice(notices, "warning", _("No Commission Structure selected; rates may be missing."), sales_invoice=sales_invoice_name)

    scheduling_records = frappe.get_all("Structure Field", filters={"parent": scheduling_name} if scheduling_name else {}, fields=["doctype_name", "doctype_field", "earn_commission"])
    if not scheduling_records:
        _append_notice(notices, "warning", _("No Structure Fields found for this Commission Structure."), scheduling_name=scheduling_name)

    # Header owners
    contains_lead = any(r["doctype_name"] == "Lead" for r in scheduling_records)
    contains_opportunity = any(r["doctype_name"] == "Opportunity" for r in scheduling_records)

    lead_owner = opp_owner = None
    if contains_lead and lead_name:
        lead_owner = frappe.get_value("Lead", {"name": lead_name}, "lead_owner")
        if not lead_owner:
            _append_notice(notices, "info", _("Lead has no owner set."), lead=lead_name)
    if contains_opportunity and opportunity:
        opp_owner = frappe.get_value("Opportunity", {"name": opportunity}, "opportunity_owner")
        if not opp_owner:
            _append_notice(notices, "info", _("Opportunity has no owner set."), opportunity=opportunity)

    owners_seen = set()
    for fld, val in (("opportunity_owner", opp_owner), ("lead_owner", lead_owner)):
        if val and val not in owners_seen:
            all_values.append({"field": fld, "value": val, "source": "header"})
            owners_seen.add(val)

    # --- Main: build from header records first (use commission_rate if present on notes) ---
    custom_item = []
    last_yf_added_by_id = None

    for record in scheduling_records:
        doctype = record.get("doctype_name")
        field = record.get("doctype_field")
        earn_commission = record.get("earn_commission")

        # header-level fetch
        field_value = None
        try:
            if doctype == "Lead" and lead_name:
                field_value = frappe.get_value("Lead", {"name": lead_name}, field)
            elif doctype == "Opportunity" and opportunity:
                field_value = frappe.get_value("Opportunity", {"name": opportunity}, field)
            elif doctype == "Sales Order" and sales_order:
                field_value = frappe.get_value("Sales Order", {"name": sales_order}, field)
            elif doctype == "Quotation" and quotation:
                field_value = frappe.get_value("Quotation", {"name": quotation}, field)
        except Exception as e:
            _append_notice(notices, "error", _("Failed to fetch field from {0}: {1}").format(doctype, field), error=str(e))

        # Researchers: Prefer commission_rate from CRM Note.custom_commission_rate if present
        if field == "yf_researcher":
            # Header-level researcher (from header opportunity)
            if opportunity:
                notes = frappe.get_all("CRM Note", filters={"parent": opportunity, "custom_approved": 1}, fields=["added_by", "yf_custom_item", "yf_added_by_id", "custom_commission_rate"])
                if not notes:
                    _append_notice(notices, "info", _("No approved CRM Notes found for researchers."), opportunity=opportunity)
                for note in notes or []:
                    email = note.get("added_by")
                    last_yf_added_by_id = note.get("yf_added_by_id")
                    custom_item = note.get("yf_custom_item") or []
                    crm_rate = note.get("custom_commission_rate")
                    # If CRM note contains rate, use it directly
                    all_values.append({
                        "field": "yf_researcher",
                        "value": email,
                        "commission_rate": crm_rate if crm_rate is not None else None,
                        "yf_added_by_id": last_yf_added_by_id,
                        "custom_item": custom_item,
                        "source": "header"
                    })

        # Opportunity owners (header)
        if field == "opportunity_owner" and opportunity:
            extra_owners = frappe.get_all("Opportunity Owners", filters={"parent": opportunity}, pluck="owner_name")
            if extra_owners:
                for owner_name in extra_owners:
                    all_values.append({"field": "opportunity_owners", "value": owner_name, "earn_commission": earn_commission, "source": "header"})
            else:
                _append_notice(notices, "info", _("No additional Opportunity Owners."), opportunity=opportunity)

        # add fetched generic field value if present
        if field_value:
            all_values.append({"field": field, "value": field_value, "earn_commission": earn_commission, "source": "header"})

    # --- Plan B: item-level values (if header didn't produce owners/better granularity)
    # Also: if Structure includes a field that requests item-based lookup, query Researchers Table per item
    # We'll determine if the structure expects item-screen lookup by checking records where doctype_name == "Item" or similar.
    wants_item_screen_lookup = any(r["doctype_name"] in ("Item", "Item Master", "Item") for r in scheduling_records)

    # Add per-item owners/researchers using item_links
    for link in item_links:
        opp = link.get("opportunity")
        lead_nm = link.get("lead")
        si_item = link.get("si_item_name")
        item_code = link.get("item_code")
        resolved_via = link.get("resolved_via")

        # opportunity_owner per item
        if contains_opportunity and opp:
            opp_owner_item = frappe.get_value("Opportunity", opp, "opportunity_owner")
            if opp_owner_item:
                all_values.append({"field": "opportunity_owner", "value": opp_owner_item, "source": "item", "si_item": si_item, "item_code": item_code, "resolved_via": resolved_via})
            extra_owners = frappe.get_all("Opportunity Owners", filters={"parent": opp}, pluck="owner_name")
            for owner_name in extra_owners or []:
                all_values.append({"field": "opportunity_owners", "value": owner_name, "source": "item", "si_item": si_item, "item_code": item_code, "resolved_via": resolved_via})

        # lead_owner per item
        if contains_lead and lead_nm:
            lead_owner_item = frappe.get_value("Lead", lead_nm, "lead_owner")
            if lead_owner_item:
                all_values.append({"field": "lead_owner", "value": lead_owner_item, "source": "item", "si_item": si_item, "item_code": item_code, "resolved_via": resolved_via})

        # item-level researcher: check CRM Notes on opp
        if any(r["doctype_field"] == "yf_researcher" for r in scheduling_records) and opp:
            notes = frappe.get_all("CRM Note", filters={"parent": opp, "custom_approved": 1}, fields=["added_by", "yf_custom_item", "yf_added_by_id", "custom_commission_rate"])
            for note in notes or []:
                email = note.get("added_by")
                crm_rate = note.get("custom_commission_rate")
                custom_item = note.get("yf_custom_item") or []
                all_values.append({
                    "field": "yf_researcher",
                    "value": email,
                    "commission_rate": crm_rate if crm_rate is not None else None,
                    "yf_added_by_id": note.get("yf_added_by_id"),
                    "custom_item": custom_item,
                    "source": "item",
                    "si_item": si_item,
                    "item_code": item_code,
                    "resolved_via": resolved_via
                })

        # item-screen lookup: search Researchers Table for the item_code as parent or yf_researchers field
        if wants_item_screen_lookup and item_code:
            # First: records where parent == item_code (Researchers Table rows under the Item)
            recs = frappe.get_all("Researchers Table", filters={"parent": item_code}, fields=["researchers", "commission_rate"])
            for r in recs or []:
                all_values.append({
                    "field": "yf_researcher",
                    "value": r.get("researchers"),
                    "commission_rate": r.get("commission_rate"),
                    "source": "item_screen",
                    "si_item": si_item,
                    "item_code": item_code
                })
            # Second: records where yf_researchers field contains the item_code (if your custom table uses that pattern)
            # (This is optional and depends on your custom schema — keep it if relevant)
            try:
                extra = frappe.get_all("Researchers Table", filters=[["yf_researchers", "=", item_code]], fields=["researchers", "commission_rate", "parent"])
                for r in extra or []:
                    all_values.append({
                        "field": "yf_researcher",
                        "value": r.get("researchers"),
                        "commission_rate": r.get("commission_rate"),
                        "source": "item_screen_field",
                        "si_item": si_item,
                        "item_code": item_code,
                        "parent_doc": r.get("parent")
                    })
            except Exception:
                # silent if field doesn't exist or filter not supported
                pass

    # Deduplicate and return
    all_values = _dedupe_commission_values(all_values)
    notices = _dedupe_notices(notices)

    return {
        "commission_details": all_values,
        "custom_item": custom_item,
        "opportunity": opportunity,
        "notices": notices,
        "item_links": item_links,
    }


# --- Rates APIs (compat layers left intact) ---

@frappe.whitelist()
def get_rate(scheduling_name: str = None, field_name: str = None, type: str = None):
    field = field_name or type
    if not scheduling_name or not field:
        return None
    rows = frappe.db.sql("""
        SELECT sf.rate
        FROM `tabCommission Structure` s
        JOIN `tabStructure Field` sf ON sf.parent = s.name
        WHERE s.name = %s AND sf.doctype_field = %s
    """, (scheduling_name, field), as_dict=True)
    rate = rows[0]["rate"] if rows and rows[0].get("rate") is not None else None
    if rate is None:
        frappe.logger("commission").info(f"RATE NOT FOUND | scheduling={scheduling_name} field={field}")
    return rate


@frappe.whitelist()
def get_opportunity_rate(value: str = None, scheduling_name: str = None, type: str = None):
    if not value:
        return None
    rows = frappe.db.sql("SELECT s.commission_rate FROM `tabOpportunity Owners` s WHERE s.owner_name = %s", (value,), as_dict=True)
    rate = rows[0]["commission_rate"] if rows and rows[0].get("commission_rate") is not None else None
    if rate is None:
        frappe.logger("commission").info(f"OPP OWNER RATE NOT FOUND | owner={value}")
    return rate


@frappe.whitelist()
def get_researcher_commission(yf_added_by_id: str = None, value: str = None, opportunity: str = None):
    if not (yf_added_by_id and value and opportunity):
        return None
    notes = frappe.get_all("CRM Note", filters={"parent": opportunity, "yf_added_by_id": yf_added_by_id}, pluck="yf_custom_item")
    if not notes:
        frappe.logger("commission").info(f"NO CRM NOTE FOR RESEARCHER | opp={opportunity} by_id={yf_added_by_id}")
        return None
    commission_rate = None
    for custom_item_name in notes:
        recs = frappe.get_all("Researchers Table", filters={"researchers": value, "parent": custom_item_name}, pluck="commission_rate")
        if recs:
            commission_rate = recs[-1]
    if commission_rate is None:
        frappe.logger("commission").info(f"RESEARCHER RATE NOT FOUND | opp={opportunity} researcher={value} by_id={yf_added_by_id}")
    return commission_rate


@frappe.whitelist()
def calculate_total_commission(commission_rate, total):
    try:
        commission_rate = float(commission_rate or 0)
        total = float(total or 0)
        return (commission_rate / 100.0) * total
    except Exception as e:
        frappe.log_error(message=f"Error calculating total commission: {e}", title="Commission Calculation Error")
        return 0.0


@frappe.whitelist()
def get_sales_man_details(user: str = None) -> list:
    if not user:
        user = frappe.session.user
    employee = frappe.db.get_value("Employee", {"user_id": user}, "name")
    if not employee:
        return []
    sales_man = frappe.db.get_value("Sales Man", {"employee": employee}, "name")
    if not sales_man:
        return []
    return frappe.db.get_all("Sales Man Mangers", {"parent": sales_man}, ["sales_man", "sales_manager", "department_manger", "branch_supervisor"])
