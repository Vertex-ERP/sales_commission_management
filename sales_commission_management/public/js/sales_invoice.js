// === sales_invoice_commission.js (FULL, updated) ===

function show_notice(n) {
    const text = n?.message || __("Unknown notice");
    const indicator =
        n?.severity === "error" ? "red" :
        n?.severity === "warning" ? "orange" :
        "blue";
    frappe.show_alert({ message: text, indicator }, 8);
    if (n?.context) console.log(`[Commission][${n.severity}]`, text, n.context);
}

// احضر هيكل العمولة الإفتراضي إن لم يُحدد
function get_default_structure() {
    return frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Commission Structure",
            filters: { "default_structure": 1 },
            fields: ["name"],
            limit_page_length: 1
        }
    }).then(r => (r.message && r.message.length ? r.message[0].name : null))
      .catch(() => null);
}

/**
 * إزالة أي صفوف مكررة من جدول العمولة
 * المفتاح: sales_partner + type + si_item + item_code (+ source, commission_rate عند strict)
 */
function dedupe_commission_table(frm, opts) {
    const strict = opts && opts.strict;
    const rows = frm.doc.yf_commission_details || [];
    const seen = new Set();
    const to_delete = [];

    for (const r of rows) {
        const keyParts = [
            r.sales_partner || "",
            r.type || "",
            r.commission_rate || "",
            r.total_commission || ""
        ];
        if (strict) keyParts.push(r.source || "", String(r.commission_rate ?? ""));
        const key = keyParts.join("||");

        if (seen.has(key)) to_delete.push(r);
        else seen.add(key);
    }

    to_delete.forEach(r => frappe.model.clear_doc(r.doctype, r.name));

    if (to_delete.length) {
        frm.refresh_field("yf_commission_details");
        frappe.show_alert({
            message: __("Removed {0} duplicated commission row(s).", [to_delete.length]),
            indicator: "orange"
        }, 6);
    }
}

// بصمة للصفوف لمنع حفظ تلقائي بلا تغيير
function _commission_signature(rows) {
    return (rows || []).map(r => [
        r.sales_partner || "",
        r.type || "",
        r.si_item || "",
        r.item_code || "",
        String(r.commission_rate ?? ""),
        String(r.total_commission ?? "")
    ].join("|")).join("##");
}

/**
 * ملء جدول العمولة + (اختياري) حفظ تلقائي لمنع بقاء المستند Dirty
 * @param {Frm} frm
 * @param {{autosave?: boolean}=} opts
 */
function update_commission_details(frm, opts) {
    if (frm.is_new()) return;
    const options = opts || {};

    // Debounce لمنع نداءات متقاربة
    clearTimeout(frm.__commission_timer);
    frm.__commission_timer = setTimeout(async () => {
        if (frm.__commission_inflight) return;
        frm.__commission_inflight = true;

        try {
            // إن لم يوجد هيكل، حاول جلب الديفولت وضبطه (مع كتم الحدث)
            let sched = frm.doc.yf_scheduling_name;
            if (!sched) {
                const def = await get_default_structure();
                if (def) {
                    frm.__commission_setting_sched = true;   // كتم حدث تغيير الهيكل
                    await frm.set_value("yf_scheduling_name", def);
                    frm.__commission_setting_sched = false;
                    sched = def;
                    show_notice({ severity: "info", message: __("Default Commission Structure applied: {0}", [def]) });
                } else {
                    show_notice({ severity: "warning", message: __("No default Commission Structure found; rates may be missing.") });
                }
            }

            console.log("Fetching commission details for Sales Invoice:", frm.doc.name);

            const beforeSig = _commission_signature(frm.doc.yf_commission_details);

            const resp = await frappe.call({
                method: "sales_commission_management.sales_commission_management.doctype.api.get_commission_details",
                args: {
                    sales_invoice_name: frm.doc.name,
                    scheduling_name: sched || ""
                }
            });

            if (!resp.message) return;

            const { commission_details = [], opportunity = null, notices = [] } = resp.message;

            // اعرض إشعارات السيرفر
            (notices || []).forEach(show_notice);

            // تفريد على مستوى العميل
            const seen = new Set();
            const unique = [];
            for (const r of (commission_details || [])) {
                const custom = Array.isArray(r.custom_item) ? r.custom_item.slice().sort().join("|") : (r.custom_item || "");
                const key = [r.field, r.value, r.source || "", r.si_item || "", r.item_code || "", custom].join("||");
                if (!seen.has(key)) { seen.add(key); unique.push(r); }
            }

            // امسح الجدول ثم املأه
            frm.clear_table("yf_commission_details");

            const promises = unique.map(async (record) => {
                const {
                    field, value, yf_added_by_id, custom_item,
                    source, si_item, item_code, commission_rate
                } = record || {};
                if (!value) return;

                // لا تضف صف مكرر (نفس partner/type/si_item)
                const already = (frm.doc.yf_commission_details || []).some(r =>
                    r.sales_partner === value &&
                    r.type === field &&
                    ((si_item && r.si_item === si_item) || !si_item)
                );
                if (already) return;

                const row = frm.add_child("yf_commission_details", {
                    sales_partner: value,
                    type: field,
                    // لو الجدول يحوي هذه الأعمدة ستُخزن؛ وإلا تتجاهل UI ذلك بدون خطأ
                    source: source || null,
                    si_item: si_item || null,
                    item_code: item_code || null,
                });

                // (1) إن وصل معدل العمولة مباشرة من السيرفر، استخدمه فورًا
                if (commission_rate !== undefined && commission_rate !== null) {
                    const rate = Number(commission_rate) || 0;
                    frappe.model.set_value(row.doctype, row.name, 'commission_rate', rate);

                    let total_commission = 0;
                    const list = Array.isArray(custom_item) ? custom_item
                                : (custom_item ? [custom_item] : (item_code ? [item_code] : []));
                    if (list.length) {
                        (frm.doc.items || []).forEach(item_row => {
                            if (list.includes(item_row.item_code)) {
                                total_commission += (rate / 100) * (item_row.amount || 0);
                            }
                        });
                        if (rate > 0 && total_commission === 0) {
                            show_notice({
                                severity: "info",
                                message: __("Rate found for {0} but no matching items on invoice.", [value]),
                                context: { field, value, items: list }
                            });
                        }
                    } else if ((source === "item") && (si_item || item_code)) {
                        const rowItem = (frm.doc.items || []).find(x => x.name === si_item || x.item_code === item_code);
                        total_commission = (rate / 100) * (rowItem ? (rowItem.amount || 0) : (frm.doc.total || 0));
                    } else {
                        total_commission = (rate / 100) * (frm.doc.total || 0);
                    }

                    frappe.model.set_value(row.doctype, row.name, 'total_commission', total_commission);
                    return;
                }

                // (2) وإلا: الميثودات التقليدية
                let method = "";
                let args = { value };

                if (field === "opportunity_owners") {
                    method = "sales_commission_management.sales_commission_management.doctype.api.get_opportunity_rate";
                } else if (field === "yf_researcher") {
                    method = "sales_commission_management.sales_commission_management.doctype.api.get_researcher_commission";
                    args.yf_added_by_id = yf_added_by_id;
                    args.opportunity = opportunity;
                } else {
                    if (!sched) {
                        show_notice({
                            severity: "warning",
                            message: __("No Commission Structure selected; rate lookup skipped for {0}.", [field]),
                            context: { field }
                        });
                        frappe.model.set_value(row.doctype, row.name, 'commission_rate', 0);
                        frappe.model.set_value(row.doctype, row.name, 'total_commission', 0);
                        return;
                    }
                    method = "sales_commission_management.sales_commission_management.doctype.api.get_rate";
                    args.scheduling_name = sched;
                    args.field_name = field; // (compat)
                }

                try {
                    const rr = await frappe.call({ method, args });
                    const rcv = rr && rr.message;
                    const rate = Number(rcv) || 0;

                    if (rcv === null || rcv === undefined) {
                        show_notice({
                            severity: "warning",
                            message: __("No commission rate found for {0}. Row set to 0.", [field]),
                            context: { field, value }
                        });
                    }

                    frappe.model.set_value(row.doctype, row.name, 'commission_rate', rate);

                    let total_commission = 0;
                    if (field === "yf_researcher") {
                        const list = Array.isArray(custom_item) ? custom_item : (custom_item ? [custom_item] : []);
                        if (!list.length) {
                            show_notice({
                                severity: "info",
                                message: __("No linked items found for researcher {0}; total set to 0.", [value]),
                                context: { researcher: value }
                            });
                        }
                        (frm.doc.items || []).forEach(item_row => {
                            if (list.includes(item_row.item_code)) {
                                total_commission += (rate / 100) * (item_row.amount || 0);
                            }
                        });
                        if (total_commission === 0 && rate > 0 && list.length) {
                            show_notice({
                                severity: "info",
                                message: __("Researcher {0} has a rate but matching items not found on invoice.", [value]),
                                context: { researcher: value, items: list }
                            });
                        }
                    } else if ((source === "item") && (si_item || item_code)) {
                        const rowItem = (frm.doc.items || []).find(x => x.name === si_item || x.item_code === item_code);
                        if (rowItem) {
                            total_commission = (rate / 100) * (rowItem.amount || 0);
                        } else {
                            total_commission = (rate / 100) * (frm.doc.total || 0);
                            show_notice({
                                severity: "info",
                                message: __("Item link missing in UI for {0}; fell back to invoice total.", [field]),
                                context: { field }
                            });
                        }
                    } else {
                        total_commission = (rate / 100) * (frm.doc.total || 0);
                        if (rate === 0) {
                            show_notice({
                                severity: "info",
                                message: __("Rate is 0% for {0}; total commission is 0.", [field]),
                                context: { field, value }
                            });
                        }
                    }

                    frappe.model.set_value(row.doctype, row.name, 'total_commission', total_commission);
                } catch (err) {
                    show_notice({
                        severity: "error",
                        message: __("Failed to fetch rate for {0}. Set to 0.", [field]),
                        context: { error: err }
                    });
                    frappe.model.set_value(row.doctype, row.name, 'commission_rate', 0);
                    frappe.model.set_value(row.doctype, row.name, 'total_commission', 0);
                }
            });

            await Promise.all(promises);
            frm.refresh_field("yf_commission_details");

            // إزالة أي تكرار بالجدول بعد التعبئة
            dedupe_commission_table(frm, { strict: false }); // أو true لو تبغى تشدد المفتاح

            const anyRows = (frm.doc.yf_commission_details || []).length > 0;
            if (!anyRows) {
                show_notice({
                    severity: "warning",
                    message: __("No commission rows were added. Check sales links and structure fields."),
                    context: { sales_invoice: frm.doc.name }
                });
            } else {
                frappe.show_alert({ message: __("Commission details updated."), indicator: "green" }, 5);
            }

            // حفظ تلقائي ذكي: فقط عند الطلب، و فقط لو تغيرت البيانات فعلاً
            const afterSig = _commission_signature(frm.doc.yf_commission_details);
            const no_changes = (beforeSig === afterSig);

            if (options.autosave && !no_changes && frm.is_dirty && frm.is_dirty()) {
                if (!frm.__commission_autosave_inflight) {
                    frm.__commission_autosave_inflight = true;
                    try {
                        await frm.save('Update'); // حفظ واحد وآمن
                    } catch (e) {
                        show_notice({ severity: "error", message: __("Auto-save failed after commission update."), context: { error: e } });
                    } finally {
                        frm.__commission_autosave_inflight = false;
                    }
                }
            }

            console.log("Commission details updated successfully");
        } catch (e) {
            show_notice({ severity: "error", message: __("Failed to load commission details."), context: { error: e } });
        } finally {
            frm.__commission_inflight = false;
        }
    }, 250);
}

frappe.ui.form.on("Sales Invoice", {
    // onload_post_render: function(frm) {
    //     // تشغيل أولي عند فتح المستند (بدون autosave لتجنب Save مزدوج بعد الإنشاء)
    //     if (frm.__commission_boot_for !== frm.doc.name) {
    //         frm.__commission_boot_for = frm.doc.name;
    //         update_commission_details(frm, { autosave: false });
    //     }
    // },

    // refresh: function(frm) {
    //     // لا نطلق API هنا (يُستدعى كثيرًا). فقط حدّث الجريد إن رغبت.
    //     if (frm.fields_dict?.yf_commission_details?.grid) {
    //         frm.fields_dict.yf_commission_details.grid.refresh();
    //     }
    // },

    yf_scheduling_name: function(frm) {
        // تجاهل التغيير إن كان سببه ضبط الديفولت من داخل الدالة
        if (frm.__commission_setting_sched) return;
        // هذا هو السيناريو الوحيد الذي نفعل فيه autosave
        update_commission_details(frm, { autosave: true });
    },

    after_save: function(frm) {
        if (frm.doc.yf_scheduling_name) return;  // حماية إضافية

        // بعد الحفظ (خصوصًا لأول مرة)، أعد الملء بدون autosave لتجنب Save مزدوج
        if (frm.__commission_autosave_inflight) return;  // حماية إضافية
        update_commission_details(frm, { autosave: false });
    }
});
