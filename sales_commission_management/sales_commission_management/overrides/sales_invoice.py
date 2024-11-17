# Copyright (c) 2024, alaalsalam Pvt. Ltd. and Contributors
# License: GNU General Public License v3. See license.txt

import frappe
from frappe.utils import  cint,flt, get_link_to_form
from frappe import _, msgprint, throw
import erpnext
import traceback


from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice,make_regional_gl_entries
from erpnext.accounts.utils import  get_account_currency
from erpnext.assets.doctype.asset.depreciation import (
	depreciate_asset,
	get_disposal_account_and_cost_center,
	get_gl_entries_on_asset_disposal,
	get_gl_entries_on_asset_regain,
	reset_depreciation_schedule,
	reverse_depreciation_entry_made_after_disposal,
)
from erpnext.assets.doctype.asset_activity.asset_activity import add_asset_activity
from erpnext.accounts.general_ledger import (
    make_gl_entries,
    merge_similar_entries,
)
from erpnext.accounts.party import get_party_account

class CustomSalesInvoice(SalesInvoice):
		is_on_change_in_progress = 10  # علم لمنع التكرار اللانهائي


		
		def get_gl_entries(self, warehouse_account=None):
			from erpnext.accounts.general_ledger import merge_similar_entries

			gl_entries = []

			self.make_customer_gl_entry(gl_entries)

			self.make_tax_gl_entries(gl_entries)

			self.make_internal_transfer_gl_entries(gl_entries)

			self.make_item_gl_entries(gl_entries)
			self.make_precision_loss_gl_entry(gl_entries)
			self.make_discount_gl_entries(gl_entries)

			gl_entries = make_regional_gl_entries(gl_entries, self)

			# merge gl entries before adding pos entries
			gl_entries = merge_similar_entries(gl_entries)

			self.make_loyalty_point_redemption_gle(gl_entries)
			self.make_pos_gl_entries(gl_entries)

			self.make_write_off_gl_entry(gl_entries)
			self.make_gle_for_rounding_adjustment(gl_entries)
			self.make_crm_commission_gl_entries(gl_entries)
			return gl_entries


		

		def on_change(self):

			
			

			# stack = traceback.extract_stack()
			# for entry in stack:
			# 	if "on_change" in entry.name:
			# 		return 
			if self.is_on_change_in_progress==10:
				
				
				self.is_on_change_in_progress==0
				msgprint(self.is_on_change_in_progress)
				
			else:
				return	

		
				
			
			
		def make_crm_commission_gl_entries(self, gl_entries):
			try:
				commission_settings = frappe.get_cached_doc('Commission Settings', 'Commission Settings')
			except frappe.DoesNotExistError:
				return

			if not commission_settings.make_gl:
				return
			
			if self.outstanding_amount != 0:
				
				return

			for yf_commission_details in self.get("yf_commission_details"):
				sales_person = yf_commission_details.sales_partner
				commission_rate = yf_commission_details.commission_rate
				commission_amount = yf_commission_details.total_commission

				if commission_amount > 0:
					if not commission_settings.commission_account:
						frappe.throw(_("Please define a commission account in Commission Settings."))
				sales_partner_doc = frappe.get_all("Sales Partner", filters={"yf_user": sales_person}, fields=["name", "yf_party_type","yf_party"])
				
				if not sales_partner_doc:
					frappe.throw(_("Sales Partner details are missing for user ID {0}.").format(sales_person))
					
				party_type = sales_partner_doc[0]["yf_party_type"]
				party = sales_partner_doc[0]["yf_party"]	

				# account_currency = get_account_currency(commission_settings.commission_account)
							
				gl_entries.append(
					self.get_gl_dict(
						{
							"account": commission_settings.sales_account,
							"credit": flt(commission_amount),
							"credit_in_account_currency": flt(commission_amount),
							"against": commission_settings.sales_team_account,
						},
						# account_currency,
						item=self,
					)
				)

					
				gl_entries.append(
					self.get_gl_dict(
						{
							"account": commission_settings.sales_team_account,
							"cost_center": commission_settings.cost_center,
							"debit": flt(commission_amount),
							"debit_in_account_currency": flt(commission_amount),
							"against": commission_settings.sales_account,
							"party_type": party_type,
							"party": party,
							# "user_remark": _("Commission for {0}: {1}").format(sales_person, commission_amount),
						},
						# account_currency,
						item=self,
					)
				)

	
   