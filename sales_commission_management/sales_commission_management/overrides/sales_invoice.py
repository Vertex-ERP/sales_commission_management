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
		is_on_change_in_progress = False  # علم لمنع التكرار اللانهائي


		
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
			msgprint("hi")
			

			stack = traceback.extract_stack()
			for entry in stack:
				if "on_change" in entry.name:
					return 
			try:
				gl_entries = []
				self.make_crm_commission_gl_entries(gl_entries)
				self.make_gl_entries(gl_entries)
			except Exception as e:
				print(f"Error occurred: {str(e)}")	
			
			
			
			
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

	
    		
	# def make_crm_commission_gl_entries(self, gl_entries):
	# 	# الحصول على إعدادات العمولة
	# 	try:
	# 		commission_settings = frappe.get_cached_doc('Commission Settings', 'Commission Settings')
	# 	except frappe.DoesNotExistError:
	# 		frappe.throw(_("Commission Settings document is missing. Please configure it."))
	# 		return

	# 	# التحقق من تفعيل القيود المحاسبية للعمولة
	# 	if not commission_settings.make_gl:
	# 		return

	# 	for custom_commission_details in self.get("custom_commission_details"):
	# 		sales_person = custom_commission_details.sales_partner
	# 		commission_rate = custom_commission_details.commission_rate
	# 		commission_amount = custom_commission_details.total_commission

	# 		# جلب party_type و party من Sales Partner إذا كانت العمولة أكبر من صفر
	# 		if commission_amount > 0:
	# 			if not commission_settings.commission_account:
	# 					frappe.throw(_("Please define a commission account in Commission Settings."))
	# 			sales_partner_doc = frappe.get_all("Sales Partner", filters={"custom_user": sales_person}, fields=["name", "custom_party_type","custom_party"])
				
	# 			if not sales_partner_doc:
	# 					frappe.throw(_("Sales Partner details are missing for user ID {0}.").format(sales_person))
					
	# 			party_type = sales_partner_doc[0]["custom_party_type"]
	# 			party = sales_partner_doc[0]["custom_party"]	

	# 			account_currency = get_account_currency(commission_settings.commission_account)
					
	# 			# تقسيم العمولة بين حسابات المبيعات الخاصة بكل عنصر في الفاتورة
	# 			total_invoice_amount = sum(item.base_net_amount for item in self.get("items"))  # مجموع مبالغ العناصر
	# 			for item in self.get("items"):
	# 				income_account = item.income_account  # حساب المبيعات الخاص بالعنصر
	# 				item_commission_amount = (item.base_net_amount / total_invoice_amount) * commission_amount  # حساب نسبة العمولة لهذا العنصر
					
	# 				if item_commission_amount > 0:
	# 					account_currency = get_account_currency(income_account)
						
	# 					# إنشاء قيد دائن لحساب المبيعات الخاص بالعنصر
	# 					gl_entries.append(
	# 						self.get_gl_dict(
	# 							{
	# 								"account": income_account,
	# 								"credit": flt(commission_amount),
	# 								"credit_in_account_currency": flt(commission_amount),
	# 								"against": commission_settings.sales_team_account,
	# 								"user_remark": _("Commission deducted from Sales for {0}: {1}").format(sales_person, item_commission_amount),
	# 							},
	# 							account_currency,
	# 							item=self,
	# 						)
	# 					)

	# 			# إضافة القيد المدين لحساب العميل بنفس إجمالي قيمة العمولة
	# 			account_currency = get_account_currency(commission_settings.sales_team_account)
	# 			gl_entries.append(
	# 				self.get_gl_dict(
	# 					{
	# 						"account": commission_settings.sales_team_account,  # حساب العميل أو فريق المبيعات
	# 						"debit": flt(commission_amount),
	# 						"debit_in_account_currency": flt(commission_amount),
	# 						"against": income_account,
	# 						# "party_type": party_type,
	# 						# "party": party,
	# 						"user_remark": _("Commission for {0}: {1}").format(sales_person, commission_amount),
	# 					},
	# 					account_currency,
	# 					item=self,
	# 				)
	# 			)

			
					

			
		

	# def make_item_gl_entries(self, gl_entries):
	# 	# income account gl entries
	# 	enable_discount_accounting = cint(
	# 		frappe.db.get_single_value("Selling Settings", "enable_discount_accounting")
	# 	)
	# 	commission_settings = frappe.get_cached_doc('Commission Settings', 'Commission Settings')
	# 	if  commission_settings.make_gl == 1:
	# 		total_commission=self.get("total_commission" ,0 )
	# 		frappe.msgprint(f"commision (After Commission): {total_commission}")

	# 	for team_member in self.get("sales_team"):
			
	# 		commission_amount  = team_member.incentives
			
		
	# 	total_commissions=commission_amount 
	# 	for crm_team in self.get("custom_commission_details"):
			
	# 		commission_amount = crm_team.total_commission
	# 	total_commissionss=	commission_amount

	# 	frappe.msgprint(f"commision : {total_commissions}")
		
	# 	for item in self.get("items"):
	# 		if flt(item.base_net_amount, item.precision("base_net_amount")):
	# 			# Do not book income for transfer within same company
	# 			if self.is_internal_transfer():
	# 				continue

	# 			if item.is_fixed_asset:
	# 				asset = self.get_asset(item)

	# 				if self.is_return:
	# 					fixed_asset_gl_entries = get_gl_entries_on_asset_regain(
	# 						asset,
	# 						item.base_net_amount,
	# 						item.finance_book,
	# 						self.get("doctype"),
	# 						self.get("name"),
	# 						self.get("posting_date"),
	# 					)
	# 					asset.db_set("disposal_date", None)
	# 					add_asset_activity(asset.name, _("Asset returned"))

	# 					if asset.calculate_depreciation:
	# 						posting_date = frappe.db.get_value(
	# 							"Sales Invoice", self.return_against, "posting_date"
	# 						)
	# 						reverse_depreciation_entry_made_after_disposal(asset, posting_date)
	# 						notes = _(
	# 							"This schedule was created when Asset {0} was returned through Sales Invoice {1}."
	# 						).format(
	# 							get_link_to_form(asset.doctype, asset.name),
	# 							get_link_to_form(self.doctype, self.get("name")),
	# 						)
	# 						reset_depreciation_schedule(asset, self.posting_date, notes)
	# 						asset.reload()

	# 				else:
	# 					if asset.calculate_depreciation:
	# 						notes = _(
	# 							"This schedule was created when Asset {0} was sold through Sales Invoice {1}."
	# 						).format(
	# 							get_link_to_form(asset.doctype, asset.name),
	# 							get_link_to_form(self.doctype, self.get("name")),
	# 						)
	# 						depreciate_asset(asset, self.posting_date, notes)
	# 						asset.reload()

	# 					fixed_asset_gl_entries = get_gl_entries_on_asset_disposal(
	# 						asset,
	# 						item.base_net_amount,
	# 						item.finance_book,
	# 						self.get("doctype"),
	# 						self.get("name"),
	# 						self.get("posting_date"),
	# 					)
	# 					asset.db_set("disposal_date", self.posting_date)
	# 					add_asset_activity(asset.name, _("Asset sold"))

	# 				for gle in fixed_asset_gl_entries:
	# 					gle["against"] = self.customer
	# 					gl_entries.append(self.get_gl_dict(gle, item=item))

	# 				self.set_asset_status(asset)

	# 			else:
	# 				income_account = (
	# 					item.income_account
	# 					if (not item.enable_deferred_revenue or self.is_return)
	# 					else item.deferred_revenue_account
	# 				)

	# 				amount, base_amount = self.get_amount_and_base_amount(item, enable_discount_accounting)
	# 				##################
	# 			# if  commission_settings.make_gl == 1:	
	# 				# if total_commission:
	# 				# 			base_amount -= total_commission / len(self.get("items"))  
	# 				# if total_commissions:
	# 				# 			base_amount -= total_commissions / len(self.get("items"))  
	# 				if total_commissionss:
	# 							base_amount -= total_commissionss / len(self.get("items"))			
					

	# 				account_currency = get_account_currency(income_account)
	# 				gl_entries.append(
	# 						self.get_gl_dict(
	# 							{
	# 								"account": income_account,
	# 								"against": self.customer,
	# 								"credit": flt(base_amount, item.precision("base_net_amount")),
	# 								"credit_in_account_currency": (
	# 									flt(base_amount, item.precision("base_net_amount"))
	# 									if account_currency == self.company_currency
	# 									else flt(amount, item.precision("net_amount"))
	# 								),
	# 								"cost_center": item.cost_center,
	# 								"project": item.project or self.project,
	# 							},
	# 							account_currency,
	# 							item=item,
	# 						)
	# 					)

	# 	# expense account gl entries
	# 	if cint(self.update_stock) and erpnext.is_perpetual_inventory_enabled(self.company):
	# 		gl_entries += super().get_gl_entries()

