import frappe
from frappe import _
from frappe.utils import flt
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice, make_regional_gl_entries
from erpnext.accounts.general_ledger import make_gl_entries as post_gl_entries
from erpnext.accounts.party import get_party_account

class CustomSalesInvoice(SalesInvoice):
	def on_change(self):
		# رحّل عمولة مرة واحدة فقط بعد تمام السداد (اختياري؛ يمكنك حذف on_change والاعتماد على هوك الدفع)
		try:
			if flt(self.outstanding_amount) == 0 and not self.get("custom_make_jl"):
				if self.post_commission_gl_entries():
					self.db_set("custom_make_jl", 1)
					frappe.msgprint(_("Commission GL Entries created successfully."))
		except Exception:
			frappe.log_error(frappe.get_traceback(), "CustomSalesInvoice.on_change")

	# def on_submit(self):
	# 	super().on_submit()

	def get_gl_entries(self, warehouse_account=None):
		gl_entries = []
		self.make_customer_gl_entry(gl_entries)
		self.make_tax_gl_entries(gl_entries)
		self.make_internal_transfer_gl_entries(gl_entries)
		self.make_item_gl_entries(gl_entries)
		self.make_precision_loss_gl_entry(gl_entries)
		self.make_discount_gl_entries(gl_entries)

		gl_entries = make_regional_gl_entries(gl_entries, self)

		from erpnext.accounts.general_ledger import merge_similar_entries
		gl_entries = merge_similar_entries(gl_entries)

		self.make_loyalty_point_redemption_gle(gl_entries)
		self.make_pos_gl_entries(gl_entries)
		self.make_write_off_gl_entry(gl_entries)
		self.make_gle_for_rounding_adjustment(gl_entries)

		# إن كانت الفاتورة مسددة بالكامل لحظيًا، أضف قيود العمولة ضمن نفس الدفعة
		if flt(self.outstanding_amount) == 0:
			self._append_commission_gl_entries(gl_entries)

		return gl_entries

	def make_gl_entries(self, gl_entries=None, from_repost=False):
		if not gl_entries:
			gl_entries = self.get_gl_entries()
		if not gl_entries:
			return
		post_gl_entries(gl_entries, merge_entries=False, from_repost=from_repost)

	def _append_commission_gl_entries(self, gl_entries: list) -> None:
		"""يُضيف قيود العمولة باتجاه صحيح: مدين مصروف، دائن طرف/التزام."""
		try:
			cs = frappe.get_cached_doc("Commission Settings", "Commission Settings")
		except frappe.DoesNotExistError:
			return
		if not cs.make_gl:
			return
		if not cs.get("sales_team_account"):
			frappe.throw(_("Please set Commission Expense (sales_team_account) in Commission Settings."))
		# ملاحظة: sales_account يُستخدم كـ fallback دائن لو لم نجد حساب طرف
		# (يفضّل استخدام حساب طرف ذمم عبر get_party_account)

		for row in (self.get("yf_commission_details") or []):
			amount = flt(row.total_commission)
			if amount <= 0:
				continue

			# حدّد الطرف من Sales Partner
			party_type = party = None
			partner = frappe.get_all(
				"Sales Partner",
				filters={"yf_user": row.sales_partner},
				fields=["name", "yf_party_type", "yf_party"],
				limit=1,
			)
			if partner:
				party_type = partner[0].get("yf_party_type")
				party = partner[0].get("yf_party")

			# حاول استعمال حساب طرف آليًا؛ وإلا استخدم حساب التزام عام من الإعدادات (sales_account)
			credit_account = None
			credit_party_type = None
			credit_party = None

			if party_type and party:
				try:
					credit_account = get_party_account(party_type, party, self.company)
					credit_party_type = party_type
					credit_party = party
				except Exception:
					credit_account = None

			if not credit_account:
				if not cs.get("sales_account"):
					frappe.throw(_("Please set Commission Liability (sales_account) in Commission Settings."))
				credit_account = cs.sales_account  # حساب التزام/ذمم عامة بدون party

			# (1) مدين: مصروف عمولة
			gl_entries.append(
				self.get_gl_dict(
					{
						"account": cs.sales_team_account,     # مصروف العمولة
						"cost_center": cs.cost_center,
						"debit": amount,
						"debit_in_account_currency": amount,
						"against": credit_account,
					},
					item=self,
				)
			)

			# (2) دائن: حساب الطرف (إن وُجد) أو حساب التزام عام
			credit_line = {
				"account": credit_account,
				"credit": amount,
				"credit_in_account_currency": amount,
				"against": cs.sales_team_account,
			}
			# اربط الطرف فقط إذا كان القيد على حساب ذمم طرف
			if credit_party_type and credit_party:
				credit_line.update({
					"party_type": credit_party_type,
					"party": credit_party,
				})

			gl_entries.append(self.get_gl_dict(credit_line, item=self))

	def post_commission_gl_entries(self) -> bool:
		"""ترحيل قيود العمولة فقط بعد السداد (بدون إعادة قيود الفاتورة)."""
		try:
			cs = frappe.get_cached_doc("Commission Settings", "Commission Settings")
		except frappe.DoesNotExistError:
			return False
		if not cs.make_gl or flt(self.outstanding_amount) != 0:
			return False

		gl_entries = []
		self._append_commission_gl_entries(gl_entries)
		if not gl_entries:
			return False

		post_gl_entries(gl_entries, merge_entries=False, from_repost=False)
		return True


@frappe.whitelist()
def payment_entry_on_submit(doc, method):
	"""بعد اعتماد سند الدفع: إذا أصبح الـ Sales Invoice مسددًا بالكامل ولم تُرحّل عمولته، رحّل عمولته الآن جهة الذمم/الالتزام."""
	try:
		for ref in (doc.references or []):
			if ref.reference_doctype != "Sales Invoice" or flt(ref.allocated_amount) <= 0:
				continue

			sinv = frappe.get_doc("Sales Invoice", ref.reference_name)

			# أعد تحميل آخر حالة رصيد للتأكد
			sinv.reload()

			if flt(sinv.outstanding_amount) == 0 and not sinv.get("custom_make_jl"):
				if sinv.post_commission_gl_entries():
					sinv.db_set("custom_make_jl", 1)
	except Exception:
		frappe.log_error(frappe.get_traceback(), "payment_entry_on_submit")
