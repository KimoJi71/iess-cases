/*
 * features/project/survey-form.js — 專案管理：現勘表（新增／編輯）
 * props: { cases, setCases, setView, showToast, targetCase, stores }
 */
(function () {
  'use strict';
  var h = IESS.h, Icons = IESS.Icons, stateful = IESS.stateful;

  function buildDefaultSurveyFileName(customerName, storeName) {
    if (!customerName || !storeName) return '';
    return customerName + '_' + storeName;
  }

  function resolveUniqueSurveyFileName(name, cases, excludeId) {
    var taken = cases.filter(function (c) { return c.id !== excludeId; }).map(function (c) { return c.fileName; });
    if (taken.indexOf(name) === -1) return name;
    var n = 1;
    while (taken.indexOf(name + '(' + n + ')') !== -1) n++;
    return name + '(' + n + ')';
  }

  function renderSurveyEquipSelect(label, name, options, equip, onChange, opts) {
    opts = opts || {};
    var disabled = !!opts.disabled;
    if (name === 'category') {
      disabled = disabled || options.length === 0;
    } else if (opts.waitFor) {
      disabled = disabled || !equip[opts.waitFor] || options.length === 0;
    } else {
      disabled = disabled || options.length === 0;
    }
    return h('div', null,
      h('label', { className: 'block text-sm font-bold text-gray-700 mb-1' }, label),
      h('select', {
        value: equip[name] || '',
        onChange: onChange,
        disabled: disabled,
        className: 'w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white' +
          (disabled ? ' bg-gray-100 text-gray-400 cursor-not-allowed' : '')
      },
        h('option', { value: '', disabled: true }, disabled ? (opts.emptyHint || '請先選擇上層欄位') : '請選擇'),
        options.map(function (opt) {
          return h('option', { key: opt, value: opt }, opt);
        })
      )
    );
  }

  function normalizeSurveyEquip(eq, deviceCategories) {
    var base = DeviceCategoryUtils.resolveProjectEquip(eq, deviceCategories);
    base.name = base.deviceName || eq.name || '';
    return base;
  }

  function SurveyForm(props) {
    var cases = props.cases;
    var setCases = props.setCases;
    var setView = props.setView;
    var showToast = props.showToast;
    var targetCase = props.targetCase;
    var stores = props.stores || [];
    var customers = props.customers || [];
    var deviceCategories = props.deviceCategories || [];

    var isCopy = !!(targetCase && targetCase._isCopy);
    var isEdit = !!targetCase && !isCopy && cases.some(function (c) { return c.id === targetCase.id; });
    var formData = targetCase
      ? Object.assign({}, targetCase)
      : {
          customerName: '',
          storeName: '',
          storeAddress: '',
          fillDate: todayDate,
          fileName: '',
          surveyData: {} // 儲存各類型動態題目答案
        };
    if (formData._isCopy) delete formData._isCopy;
    if (!isEdit && formData.customerName && formData.storeName && !formData.fileName) {
      formData.fileName = buildDefaultSurveyFileName(formData.customerName, formData.storeName);
    }
    var fileNameManuallyEdited = isEdit;
    if (!formData.surveyData || typeof formData.surveyData !== 'object') {
      formData.surveyData = {};
    }
    SurveyCheckQtyOthersUtils.migrateSurveyData(formData.surveyData);
    SurveyVentLinearSizesUtils.migrateSurveyData(formData.surveyData);
    // 室外機施工內容 - 可隱藏題目的顯示切換
    var showOutdoorHideable = true;
    // 沿用設備 - 可隱藏題目的顯示切換
    var showReuseEquipment = true;
    var activeSurveyTab = SURVEY_TYPES[0];

    return stateful(function (rerender) {
      var customerOptions = ScheduleUtils.getCustomerNamesFromStores(stores, customers, formData.customerName);
      var storeOptions = ScheduleUtils.getStoreNamesForCustomer(stores, formData.customerName, formData.storeName);

      function syncSurveyStoreFields() {
        var synced = ScheduleUtils.applyStoreSnapshot(formData, stores);
        formData.storeAddress = synced.storeAddress || '';
        formData.companyCity = synced.companyCity || '';
        formData.companyDistrict = synced.companyDistrict || '';
        formData.serviceLevel = synced.serviceLevel || formData.serviceLevel;
      }

      // ===== 事件處理器（對應原 useState/setFormData） =====
      function handleChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        if (name === 'fileName') {
          fileNameManuallyEdited = true;
          formData.fileName = value;
        } else {
          formData[name] = value;
          if (name === 'customerName') {
            formData.storeName = '';
            formData.storeAddress = '';
          }
          if (name === 'storeName') {
            syncSurveyStoreFields();
          }
          if (!isEdit && !fileNameManuallyEdited && (name === 'customerName' || name === 'storeName')) {
            formData.fileName = buildDefaultSurveyFileName(formData.customerName, formData.storeName);
          }
        }
        rerender();
      }
      // 專門處理動態問卷題目的輸入變更
      function handleSurveyChange(e) {
        var name = e.target.name;
        var value = e.target.value;
        var type = e.target.type;
        var checked = e.target.checked;
        var sd = formData.surveyData || (formData.surveyData = {});
        if (type === 'checkbox') {
          var currentArr = sd[name] || [];
          sd[name] = checked ? currentArr.concat([value]) : currentArr.filter(function (item) { return item !== value; });
          if (checked && value === '其他') {
            var isQtyOtherGroup = SurveyCheckQtyOthersUtils.GROUPS.some(function (g) {
              return g.checkName === name;
            });
            if (isQtyOtherGroup) {
              SurveyCheckQtyOthersUtils.ensureBlankIfChecked(sd, name);
            }
          }
          if (checked && name === 'ventOutlets' && value === '線型出風口') {
            SurveyVentLinearSizesUtils.ensureBlankIfChecked(sd);
          }
        } else {
          sd[name] = value;
        }
        rerender();
      }
      function handleSurveyRadioClick(e) {
        var t = e.target;
        if (t.type !== 'radio') return;
        var sd = formData.surveyData || (formData.surveyData = {});
        // 再點一次已選取的 radio 可清除
        if (sd[t.name] === t.value) {
          sd[t.name] = '';
          rerender();
        }
      }
      // 室內機洗孔需求動態清單處理 (可增加多筆)
      function handleHoleChange(index, value) {
        var sd = formData.surveyData || (formData.surveyData = {});
        var holes = (sd.indoorUnitHoles || []).slice();
        holes[index] = Object.assign({}, holes[index], { diameter: value });
        sd.indoorUnitHoles = holes;
        rerender();
      }
      function addHole() {
        var sd = formData.surveyData || (formData.surveyData = {});
        sd.indoorUnitHoles = (sd.indoorUnitHoles || []).concat([{ diameter: '' }]);
        rerender();
      }
      function removeHole(index) {
        var sd = formData.surveyData || (formData.surveyData = {});
        sd.indoorUnitHoles = (sd.indoorUnitHoles || []).filter(function (_, i) { return i !== index; });
        rerender();
      }
      // 設備清單動態處理 (可增加多筆設備)
      function handleEquipmentChange(index, field, value) {
        var sd = formData.surveyData || (formData.surveyData = {});
        var list = (sd.equipmentList || []).slice();
        var current = normalizeSurveyEquip(list[index] || {}, deviceCategories);
        if (['category', 'brand', 'deviceName', 'specification', 'model'].indexOf(field) >= 0) {
          current = DeviceCategoryUtils.applyEquipFieldChange(current, field, value);
          if (field === 'deviceName') {
            current.name = current.deviceName;
          }
        } else {
          current[field] = value;
        }
        list[index] = current;
        sd.equipmentList = list;
        rerender();
      }
      function addEquipment() {
        var sd = formData.surveyData || (formData.surveyData = {});
        sd.equipmentList = (sd.equipmentList || []).concat([{
          category: '',
          brand: '',
          deviceName: '',
          name: '',
          specification: '',
          model: '',
          area: ''
        }]);
        rerender();
      }
      function removeEquipment(index) {
        var sd = formData.surveyData || (formData.surveyData = {});
        sd.equipmentList = (sd.equipmentList || []).filter(function (_, i) { return i !== index; });
        rerender();
      }
      // 零配件數量處理
      function handlePartQtyChange(partKey, value) {
        var sd = formData.surveyData || (formData.surveyData = {});
        var qty = Object.assign({}, sd.partsQty || {});
        qty[partKey] = value;
        sd.partsQty = qty;
        rerender();
      }
      // 配管工程 各多選群組的數量／長度對照表處理（依 mapName 分開儲存）
      function handleQtyMapChange(mapName, key, value) {
        var sd = formData.surveyData || (formData.surveyData = {});
        var m = Object.assign({}, sd[mapName] || {});
        m[key] = value;
        sd[mapName] = m;
        rerender();
      }
      function ensureSd() {
        return formData.surveyData || (formData.surveyData = {});
      }
      function addCheckQtyOther(checkName) {
        SurveyCheckQtyOthersUtils.addOther(ensureSd(), checkName);
        rerender();
      }
      function updateCheckQtyOther(checkName, id, patch) {
        SurveyCheckQtyOthersUtils.updateOther(ensureSd(), checkName, id, patch);
        rerender();
      }
      function removeCheckQtyOther(checkName, id) {
        SurveyCheckQtyOthersUtils.removeOther(ensureSd(), checkName, id);
        rerender();
      }
      function addVentLinearSize() {
        SurveyVentLinearSizesUtils.addSize(ensureSd());
        rerender();
      }
      function updateVentLinearSize(id, patch) {
        SurveyVentLinearSizesUtils.updateSize(ensureSd(), id, patch);
        rerender();
      }
      function removeVentLinearSize(id) {
        SurveyVentLinearSizesUtils.removeSize(ensureSd(), id);
        rerender();
      }

        const renderPipingQtyRow = (checkName, mapName, opt) => {
          const selected = formData.surveyData?.[checkName] || [];
          const checked = selected.includes(opt.label);
          return h("div", {
            key: opt.label,
            className: "flex items-center justify-between bg-white p-3 rounded border border-gray-200"
          }, h("label", {
            className: "flex items-center gap-2 cursor-pointer"
          }, h("input", {
            type: "checkbox",
            name: checkName,
            value: opt.label,
            checked: checked,
            onChange: handleSurveyChange,
            className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          }), h("span", {
            className: "text-sm text-gray-700 font-medium"
          }, opt.label)), h("div", {
            className: "flex items-center gap-2"
          }, h("input", {
            type: "number",
            value: formData.surveyData?.[mapName]?.[opt.label] || '',
            onChange: e => handleQtyMapChange(mapName, opt.label, e.target.value),
            disabled: !checked,
            placeholder: opt.qtyLabel,
            className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
          }), h("span", {
            className: "text-sm text-gray-500 whitespace-nowrap"
          }, opt.unit)));
        };
        const renderCheckQtyOthersBlock = (checkName, unit, qtyLabel) => {
          const selected = formData.surveyData?.[checkName] || [];
          const checked = selected.includes('其他');
          const others = SurveyCheckQtyOthersUtils.getOthers(formData.surveyData, checkName);
          return h("div", {
            className: "space-y-2 mt-2"
          }, h("div", {
            className: "bg-white p-3 rounded border border-gray-200"
          }, h("label", {
            className: "flex items-center gap-2 cursor-pointer"
          }, h("input", {
            type: "checkbox",
            name: checkName,
            value: "其他",
            checked: checked,
            onChange: handleSurveyChange,
            className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          }), h("span", {
            className: "text-sm text-gray-700 font-medium"
          }, "其他")), checked ? others.map(row => h("div", {
            key: row.id,
            className: "flex items-center justify-between mt-3 ml-6 gap-2"
          }, h("div", {
            className: "flex items-center gap-2 flex-1 min-w-0"
          }, h("span", {
            className: "text-sm text-gray-700 font-medium shrink-0"
          }, "其他："), h("input", {
            type: "text",
            value: row.label || '',
            onChange: e => updateCheckQtyOther(checkName, row.id, { label: e.target.value }),
            placeholder: "請註明",
            className: "flex-1 max-w-xs p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent text-sm"
          })), h("div", {
            className: "flex items-center gap-2 shrink-0"
          }, h("input", {
            type: "number",
            value: row.qty || '',
            onChange: e => updateCheckQtyOther(checkName, row.id, { qty: e.target.value }),
            placeholder: qtyLabel,
            className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          }), h("span", {
            className: "text-sm text-gray-500 whitespace-nowrap"
          }, unit), h("button", {
            type: "button",
            title: "刪除此其他項目",
            onClick: () => removeCheckQtyOther(checkName, row.id),
            className: "text-red-500 hover:text-red-700 p-1"
          }, Icons.Trash2({ className: "h-4 w-4" })))) : null, checked ? h("button", {
            type: "button",
            onClick: () => addCheckQtyOther(checkName),
            className: "flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 mt-3 ml-6"
          }, Icons.Plus({ className: "h-4 w-4" }), "新增其他") : null));
        };
        // 配管工程「多選 + 填數字」子題卡片（同一單位）
        const renderPipingCheckQtyGroup = (subtitle, note, checkName, mapName, options, unit, qtyLabel) => h("div", {
          className: "bg-white p-4 rounded-lg border border-gray-200"
        }, h("h4", {
          className: "text-base font-bold text-indigo-700 mb-1"
        }, subtitle), note && h("p", {
          className: "text-xs text-gray-400 mb-3"
        }, note), h("div", {
          className: "space-y-2 mt-2"
        }, options.map(o => renderPipingQtyRow(checkName, mapName, typeof o === 'string' ? {
          label: o,
          unit,
          qtyLabel
        } : o)), renderCheckQtyOthersBlock(checkName, unit, qtyLabel)));
        // 配管工程 單選子題卡片
        const renderPipingSingleSelect = (subtitle, name, options, extra) => {
          const cur = formData.surveyData?.[name] || '';
          return h("div", {
            className: "bg-white p-4 rounded-lg border border-gray-200"
          }, h("h4", {
            className: "text-base font-bold text-indigo-700 mb-3"
          }, subtitle), h("div", {
            className: "flex flex-wrap gap-x-6 gap-y-3"
          }, options.map(opt => h("label", {
            key: opt,
            className: "flex items-center gap-2 cursor-pointer"
          }, h("input", {
            type: "radio",
            name: name,
            value: opt,
            checked: cur === opt,
            onChange: handleSurveyChange,
            onClick: handleSurveyRadioClick,
            className: "w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
          }), h("span", {
            className: "text-sm text-gray-700 font-medium"
          }, opt))), h("label", {
            className: "flex items-center gap-2 cursor-pointer"
          }, h("input", {
            type: "radio",
            name: name,
            value: "其他",
            checked: cur === '其他',
            onChange: handleSurveyChange,
            onClick: handleSurveyRadioClick,
            className: "w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
          }), h("span", {
            className: "text-sm text-gray-700 font-medium"
          }, "其他："), h("input", {
            type: "text",
            name: `${name}_other`,
            value: formData.surveyData?.[`${name}_other`] || '',
            onChange: handleSurveyChange,
            disabled: cur !== '其他',
            placeholder: "請註明",
            className: "w-32 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent text-sm disabled:opacity-50"
          }))), extra);
        };
        // 風管工程 集風箱／出線型箱「風管管徑 + 孔數 + 數量」多選列
        const renderDuctPipeRow = (checkName, holeMap, qtyMap, opt) => {
          const selected = formData.surveyData?.[checkName] || [];
          const checked = selected.includes(opt);
          return h("div", {
            key: opt,
            className: "flex items-center justify-between bg-white p-3 rounded border border-gray-200"
          }, h("label", {
            className: "flex items-center gap-2 cursor-pointer"
          }, h("input", {
            type: "checkbox",
            name: checkName,
            value: opt,
            checked: checked,
            onChange: handleSurveyChange,
            className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          }), h("span", {
            className: "text-sm text-gray-700 font-medium"
          }, opt)), h("div", {
            className: "flex items-center gap-2"
          }, h("input", {
            type: "number",
            value: formData.surveyData?.[holeMap]?.[opt] || '',
            onChange: e => handleQtyMapChange(holeMap, opt, e.target.value),
            disabled: !checked,
            placeholder: "孔數",
            className: "w-20 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
          }), h("span", {
            className: "text-sm text-gray-500 whitespace-nowrap"
          }, "孔"), h("input", {
            type: "number",
            value: formData.surveyData?.[qtyMap]?.[opt] || '',
            onChange: e => handleQtyMapChange(qtyMap, opt, e.target.value),
            disabled: !checked,
            placeholder: "數量",
            className: "w-20 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
          }), h("span", {
            className: "text-sm text-gray-500 whitespace-nowrap"
          }, "個")));
        };
        // 風管工程 集風箱／出線型箱 卡片（材質單選 + 法蘭內徑 + 風管管徑孔數/數量多選）
        const renderDuctBox = (title, prefix) => h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " " + title), h("div", {
          className: "space-y-6"
        }, renderPipingSingleSelect('材質', `${prefix}Material`, DUCT_BOX_MATERIALS), h("div", {
          className: "bg-white p-4 rounded-lg border border-gray-200"
        }, h("h4", {
          className: "text-base font-bold text-indigo-700 mb-3"
        }, "法蘭內徑"), h("div", {
          className: "flex flex-wrap items-center gap-3"
        }, h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, "寬"), h("input", {
          type: "number",
          name: `${prefix}FlangeWidth`,
          value: formData.surveyData?.[`${prefix}FlangeWidth`] || '',
          onChange: handleSurveyChange,
          placeholder: "寬",
          className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-500"
        }, "cm"), h("span", {
          className: "text-sm text-gray-700 font-medium ml-4"
        }, "高"), h("input", {
          type: "number",
          name: `${prefix}FlangeHeight`,
          value: formData.surveyData?.[`${prefix}FlangeHeight`] || '',
          onChange: handleSurveyChange,
          placeholder: "高",
          className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-500"
        }, "cm"))), h("div", {
          className: "bg-white p-4 rounded-lg border border-gray-200"
        }, h("h4", {
          className: "text-base font-bold text-indigo-700 mb-1"
        }, "風管管徑、孔數與數量"), h("p", {
          className: "text-xs text-gray-400 mb-3"
        }, "請勾選風管管徑並填寫孔數與數量（個）"), h("div", {
          className: "space-y-2 mt-2"
        }, DUCT_BOX_PIPES.map(o => renderDuctPipeRow(`${prefix}Pipes`, `${prefix}PipesHoles`, `${prefix}PipesQty`, o))))));
        // 風管工程 三通風箱 卡片（材質單選 + 風管管徑數量多選，無孔數／無其他列）
        const renderDuctTeeBox = (title, prefix) => h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " " + title), h("div", {
          className: "space-y-6"
        }, renderPipingSingleSelect('材質', `${prefix}Material`, DUCT_BOX_MATERIALS), h("div", {
          className: "bg-white p-4 rounded-lg border border-gray-200"
        }, h("h4", {
          className: "text-base font-bold text-indigo-700 mb-1"
        }, "風管管徑、數量"), h("p", {
          className: "text-xs text-gray-400 mb-3"
        }, "請勾選風管管徑並填寫數量（個）"), h("div", {
          className: "space-y-2 mt-2"
        }, DUCT_TEE_PIPES.map(o => renderPipingQtyRow(`${prefix}Pipes`, `${prefix}PipesQty`, {
          label: o,
          unit: '個',
          qtyLabel: '數量'
        }))))));
        // 風管工程 出風口 單一型式列（勾選 + 數量個；線型改為多筆尺寸列）
        const renderVentOutletRow = opt => {
          const selected = formData.surveyData?.ventOutlets || [];
          const checked = selected.includes(opt.label);
          const sizes = opt.dim ? SurveyVentLinearSizesUtils.getSizes(formData.surveyData) : [];
          return h("div", {
            key: opt.label,
            className: "bg-white p-3 rounded border border-gray-200"
          }, h("div", {
            className: "flex items-center justify-between"
          }, h("label", {
            className: "flex items-center gap-2 cursor-pointer"
          }, h("input", {
            type: "checkbox",
            name: "ventOutlets",
            value: opt.label,
            checked: checked,
            onChange: handleSurveyChange,
            className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          }), h("span", {
            className: "text-sm text-gray-700 font-medium"
          }, opt.label)), !opt.dim && h("div", {
            className: "flex items-center gap-2"
          }, h("input", {
            type: "number",
            value: formData.surveyData?.ventOutletsQty?.[opt.label] || '',
            onChange: e => handleQtyMapChange('ventOutletsQty', opt.label, e.target.value),
            disabled: !checked,
            placeholder: "數量",
            className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
          }), h("span", {
            className: "text-sm text-gray-500 whitespace-nowrap"
          }, "個"))), opt.dim && checked ? sizes.map(row => h("div", {
            key: row.id,
            className: "flex flex-wrap items-center gap-3 mt-3 ml-6"
          }, h("span", {
            className: "text-sm text-gray-700 font-medium"
          }, "寬"), h("input", {
            type: "number",
            value: row.width || '',
            onChange: e => updateVentLinearSize(row.id, { width: e.target.value }),
            placeholder: "寬",
            className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          }), h("span", {
            className: "text-sm text-gray-500"
          }, "cm"), h("span", {
            className: "text-sm text-gray-700 font-medium ml-2"
          }, "高"), h("input", {
            type: "number",
            value: row.height || '',
            onChange: e => updateVentLinearSize(row.id, { height: e.target.value }),
            placeholder: "高",
            className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          }), h("span", {
            className: "text-sm text-gray-500"
          }, "cm"), h("input", {
            type: "number",
            value: row.qty || '',
            onChange: e => updateVentLinearSize(row.id, { qty: e.target.value }),
            placeholder: "數量",
            className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 ml-2"
          }), h("span", {
            className: "text-sm text-gray-500 whitespace-nowrap"
          }, "個"), h("button", {
            type: "button",
            title: "刪除此尺寸",
            onClick: () => removeVentLinearSize(row.id),
            className: "text-red-500 hover:text-red-700 p-1"
          }, Icons.Trash2({ className: "h-4 w-4" }))) : null, opt.dim && checked ? h("button", {
            type: "button",
            onClick: () => addVentLinearSize(),
            className: "flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 mt-3 ml-6"
          }, Icons.Plus({ className: "h-4 w-4" }), "新增尺寸") : null);
        };
        // 風管工程 出風口 卡片（多選型式 + 數量；線型可填多筆尺寸，含其他）
        const renderVentOutletBox = () => h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 出風口"), h("div", {
          className: "space-y-6"
        }, h("div", {
          className: "bg-white p-4 rounded-lg border border-gray-200"
        }, h("h4", {
          className: "text-base font-bold text-indigo-700 mb-1"
        }, "出風口型式、數量"), h("p", {
          className: "text-xs text-gray-400 mb-3"
        }, "請勾選出風口型式並填寫數量（個）；線型出風口可新增多組寬、高（cm）與數量"), h("div", {
          className: "space-y-2 mt-2"
        }, DUCT_VENT_OUTLETS.map(renderVentOutletRow), renderCheckQtyOthersBlock('ventOutlets', '個', '數量')))));
        // 風管工程 回風口 卡片（多選型式 + 數量，無其他列）
        const renderReturnOutletBox = () => h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 回風口"), h("div", {
          className: "space-y-6"
        }, h("div", {
          className: "bg-white p-4 rounded-lg border border-gray-200"
        }, h("h4", {
          className: "text-base font-bold text-indigo-700 mb-1"
        }, "回風口型式、數量"), h("p", {
          className: "text-xs text-gray-400 mb-3"
        }, "請勾選回風口型式並填寫數量（個）"), h("div", {
          className: "space-y-2 mt-2"
        }, DUCT_RETURN_OUTLETS.map(o => renderPipingQtyRow('returnOutlets', 'returnOutletsQty', {
          label: o,
          unit: '個',
          qtyLabel: '數量'
        }))))));
        // 風管工程 特製風箱 卡片（單選 + 其他）
        const renderCustomBox = () => h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 特製風箱"), h("div", {
          className: "space-y-6"
        }, renderPipingSingleSelect('特製風箱', 'customBox', DUCT_CUSTOM_BOX_OPTIONS)));
        const handleSubmit = e => {
          e.preventDefault();
          if (formData.customerName && formData.storeName) {
            syncSurveyStoreFields();
          }
          if (!formData.customerName || !formData.storeName || !formData.storeAddress) {
            showToast('客戶名稱、門市名稱與門市地址皆為必填', 'error');
            return;
          }
          var baseFileName = (formData.fileName || buildDefaultSurveyFileName(formData.customerName, formData.storeName)).trim();
          if (!baseFileName) {
            showToast('檔案名稱不可為空', 'error');
            return;
          }
          var fileName = resolveUniqueSurveyFileName(baseFileName, cases, isEdit ? formData.id : null);
          var payload = Object.assign({}, formData, { fileName: fileName });
          if (isEdit) {
            setCases(cases.map(function (c) {
              return c.id === formData.id ? payload : c;
            }));
            showToast('現勘表更新成功');
          } else {
            setCases([Object.assign({ id: 'S' + Date.now() }, payload)].concat(cases));
            showToast(isCopy ? '現勘表複製成功' : '現勘表建立成功');
          }
          setView('survey-list');
        };
        return h("div", {
          className: "max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-100 relative"
        }, PageHeader({
          title: isCopy ? '複製現勘表' : (isEdit ? '編輯現勘表' : '新增現勘表'),
          onClose: () => setView('survey-list'),
          wrapperClass: 'flex justify-between items-center p-6 border-b border-gray-200 sticky top-0 z-10 bg-white rounded-t-lg'
        }), h("form", {
          onSubmit: handleSubmit,
          className: "p-6"
        }, h("div", {
          className: "space-y-6"
        }, h("div", {
          className: "grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-lg border border-gray-200"
        }, h("div", null, h("label", {
          className: "block text-sm font-medium text-gray-700 mb-1"
        }, "\u5BA2\u6236\u540D\u7A31 ", h("span", {
          className: "text-red-500"
        }, "*")), h("select", {
          required: true,
          name: "customerName",
          value: formData.customerName,
          onChange: handleChange,
          className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
        }, h("option", {
          value: "",
          disabled: true
        }, "\u8ACB\u9078\u64C7"), customerOptions.map(function (opt) {
          return h("option", { key: opt, value: opt }, opt);
        }))), h("div", null, h("label", {
          className: "block text-sm font-medium text-gray-700 mb-1"
        }, "\u9580\u5E02\u540D\u7A31 ", h("span", {
          className: "text-red-500"
        }, "*")), h("select", {
          required: true,
          name: "storeName",
          value: formData.storeName,
          onChange: handleChange,
          className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
        }, h("option", {
          value: "",
          disabled: true
        }, "\u8ACB\u9078\u64C7"), storeOptions.map(function (opt) {
          return h("option", { key: opt, value: opt }, opt);
        }))), h("div", {
          className: "col-span-full"
        }, h("label", {
          className: "block text-sm font-medium text-gray-700 mb-1"
        }, "\u9580\u5E02\u5730\u5740 ", h("span", {
          className: "text-red-500"
        }, "*")), h("input", {
          type: "text",
          required: true,
          disabled: true,
          name: "storeAddress",
          value: formData.storeAddress,
          placeholder: "\u8ACB\u5148\u9078\u64C7\u5BA2\u6236\u8207\u9580\u5E02",
          className: "w-full p-2 bg-gray-50 border rounded-md text-gray-500 cursor-not-allowed outline-none"
        })), h("div", null, h("label", {
          className: "block text-sm font-medium text-gray-700 mb-1"
        }, "\u586B\u55AE\u65E5\u671F"), h("input", {
          type: "date",
          name: "fillDate",
          value: formData.fillDate,
          onChange: handleChange,
          required: true,
          className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
        })), h("div", {
          className: "col-span-full"
        }, h("label", {
          className: "block text-sm font-medium text-gray-700 mb-1"
        }, "\u6A94\u6848\u540D\u7A31 ", h("span", {
          className: "text-red-500"
        }, "*")), h("input", {
          type: "text",
          required: true,
          name: "fileName",
          value: formData.fileName || '',
          onChange: handleChange,
          placeholder: "\u9078\u64C7\u5BA2\u6236\u8207\u9580\u5E02\u5F8C\u81EA\u52D5\u5E36\u5165",
          className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-500"
        }), h("p", {
          className: "text-xs text-gray-400 mt-1"
        }, "\u9810\u8A2D\u70BA\u5BA2\u6236\u540D\u7A31\u8207\u9580\u5E02\u540D\u7A31\uFF0C\u82E5\u91CD\u8907\u5247\u81EA\u52D5\u52A0\u4E0A (1)\u3001(2) \u2026 \u5340\u9694"))), h("div", {
          className: "mt-8"
        }, h("div", {
          className: "flex flex-wrap gap-1 border-b border-gray-200 mb-6 -mx-1"
        }, SURVEY_TYPES.map(function (tab) {
          var isActive = activeSurveyTab === tab;
          return h("button", {
            key: tab,
            type: "button",
            onClick: function () {
              activeSurveyTab = tab;
              rerender();
            },
            className: "px-3 py-2.5 text-sm font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap " + (isActive ? "border-blue-600 text-blue-700 bg-blue-50" : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50")
          }, tab);
        })), activeSurveyTab === '環境與施工' && h("div", {
          className: "space-y-8"
        }, h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.FileText({
          className: "h-6 w-6"
        }), " \u74B0\u5883\u8207\u65BD\u5DE5 - \u73FE\u52D8\u660E\u7D30"), h("div", {
          className: "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
        }, h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "\u5DE5\u7A0B\u985E\u578B"), h("select", {
          name: "projectType",
          value: formData.surveyData?.projectType || '',
          onChange: handleSurveyChange,
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
        }, h("option", {
          value: ""
        }, "\u8ACB\u9078\u64C7"), ['新開', '加裝', '移機', '撤店', '拆機', '維修汰換', '整裝汰換', '整裝沿用', '其他'].map(opt => h("option", {
          key: opt,
          value: opt
        }, opt)))), h("div", {
          className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-3"
        }, "\u5DE5\u7A0B\u5DE5\u7A2E"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-3"
        }, ['分離式工程', '冰水機工程', '風管工程', '保養工程', '其他'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
        }, h("input", {
          type: "checkbox",
          name: "projectTrades",
          value: opt,
          checked: (formData.surveyData?.projectTrades || []).includes(opt),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))))), h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "\u5730\u6BB5\u5340\u57DF"), h("select", {
          name: "locationArea",
          value: formData.surveyData?.locationArea || '',
          onChange: handleSurveyChange,
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm"
        }, h("option", {
          value: ""
        }, "\u8ACB\u9078\u64C7"), ['街邊店', '軍營', '醫院', '高鐵、捷運、機場', '電子廠、科技園區', '百貨', '其他'].map(opt => h("option", {
          key: opt,
          value: opt
        }, opt)))), h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "\u5DE5\u55AE\u7533\u8ACB"), h("div", {
          className: "flex gap-8 mt-2"
        }, ['是', '否'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer"
        }, h("input", {
          type: "radio",
          name: "workOrderApplied",
          value: opt,
          checked: formData.surveyData?.workOrderApplied === opt,
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))))), h("div", {
          className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-3"
        }, "\u7279\u6B8A\u74B0\u5883\u8655\u7406"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-3"
        }, ['防鹽害處理', '防硫處理', '沼氣處理'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
        }, h("input", {
          type: "checkbox",
          name: "specialEnv",
          value: opt,
          checked: (formData.surveyData?.specialEnv || []).includes(opt),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))))), h("div", {
          className: "col-span-full border-t border-indigo-100/50 my-2"
        }), h("div", {
          className: "md:col-span-2"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "\u5BA4\u5167\u65BD\u4F5C\u5340\u57DF"), h("div", {
          className: "flex items-center gap-6"
        }, h("label", {
          className: "flex items-center gap-2 cursor-pointer shrink-0"
        }, h("input", {
          type: "radio",
          name: "indoorWorkArea",
          value: "\u5168\u5340",
          checked: formData.surveyData?.indoorWorkArea === '全區',
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, "\u5168\u5340")), h("label", {
          className: "flex items-center gap-2 cursor-pointer w-full max-w-sm"
        }, h("input", {
          type: "radio",
          name: "indoorWorkArea",
          value: "\u5176\u4ED6",
          checked: formData.surveyData?.indoorWorkArea === '其他',
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium shrink-0"
        }, "\u5176\u4ED6\uFF1A"), h("input", {
          type: "text",
          name: "indoorWorkArea_other",
          value: formData.surveyData?.indoorWorkArea_other || '',
          onChange: handleSurveyChange,
          disabled: formData.surveyData?.indoorWorkArea !== '其他',
          className: "flex-1 p-1.5 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
          placeholder: "\u8ACB\u8A3B\u660E"
        })))), h("div", {
          className: "md:col-span-2"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "\u73FE\u5834\u63D0\u4F9B\u96FB\u6E90"), h("div", {
          className: "flex flex-wrap gap-6 bg-white p-4 rounded border border-gray-200"
        }, ['單相110V', '單相220V', '三相220V', '三相380V'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer"
        }, h("input", {
          type: "radio",
          name: "onSitePower",
          value: opt,
          checked: formData.surveyData?.onSitePower === opt,
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))))), h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "\u96FB\u7BB1\u4F4D\u7F6E"), h("input", {
          type: "text",
          name: "electricBoxLocation",
          value: formData.surveyData?.electricBoxLocation || '',
          onChange: handleSurveyChange,
          placeholder: "\u586B\u5BEB\u4F4D\u7F6E",
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        })), h("div", {
          className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-3"
        }, "\u73FE\u5834\u5DF2\u9810\u7559\u8AAA\u660E"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-4 items-center"
        }, ['主機電源線', '無熔絲開關', '溫控位置', '空氣門電源', '排水位置', '冰水幹管'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
        }, h("input", {
          type: "checkbox",
          name: "reservedItems",
          value: opt,
          checked: (formData.surveyData?.reservedItems || []).includes(opt),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))), h("label", {
          className: "flex items-center gap-2 cursor-pointer p-1"
        }, h("input", {
          type: "checkbox",
          name: "reservedItems",
          value: "\u5176\u4ED6",
          checked: (formData.surveyData?.reservedItems || []).includes('其他'),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, "\u5176\u4ED6\uFF1A"), h("input", {
          type: "text",
          name: "reservedItems_other",
          value: formData.surveyData?.reservedItems_other || '',
          onChange: handleSurveyChange,
          disabled: !(formData.surveyData?.reservedItems || []).includes('其他'),
          className: "w-40 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
          placeholder: "\u8ACB\u8A3B\u660E"
        })))), h("div", {
          className: "col-span-full border-t border-indigo-100/50 my-2"
        }), h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "\u6A13\u677F\u9AD8\u5EA6 (/cm)"), h("div", {
          className: "relative"
        }, h("input", {
          type: "number",
          name: "floorHeight",
          value: formData.surveyData?.floorHeight || '',
          onChange: handleSurveyChange,
          placeholder: "\u586B\u5BEB\u9AD8\u5EA6",
          className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        }), h("span", {
          className: "absolute right-3 top-2.5 text-gray-400 text-sm"
        }, "/cm"))), h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "\u5929\u82B1\u677F\u53CA\u6697\u67B6\u9AD8\u5EA6 (/cm)"), h("div", {
          className: "relative"
        }, h("input", {
          type: "number",
          name: "ceilingHeight",
          value: formData.surveyData?.ceilingHeight || '',
          onChange: handleSurveyChange,
          placeholder: "\u586B\u5BEB\u9AD8\u5EA6",
          className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        }), h("span", {
          className: "absolute right-3 top-2.5 text-gray-400 text-sm"
        }, "/cm"))), h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "\u4E3B\u6A11\u9AD8\u5EA6 (/cm)"), h("div", {
          className: "relative"
        }, h("input", {
          type: "number",
          name: "mainBeamHeight",
          value: formData.surveyData?.mainBeamHeight || '',
          onChange: handleSurveyChange,
          placeholder: "\u586B\u5BEB\u9AD8\u5EA6",
          className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        }), h("span", {
          className: "absolute right-3 top-2.5 text-gray-400 text-sm"
        }, "/cm"))), h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "\u526F\u6A11\u9AD8\u5EA6 (/cm)"), h("div", {
          className: "relative"
        }, h("input", {
          type: "number",
          name: "subBeamHeight",
          value: formData.surveyData?.subBeamHeight || '',
          onChange: handleSurveyChange,
          placeholder: "\u586B\u5BEB\u9AD8\u5EA6",
          className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        }), h("span", {
          className: "absolute right-3 top-2.5 text-gray-400 text-sm"
        }, "/cm"))), h("div", {
          className: "md:col-span-2"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "特殊施工"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-3 items-center"
        }, ['三樓以上外牆配管', '室內樓板高度6米以上'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
        }, h("input", {
          type: "radio",
          name: "specialConstruction",
          value: opt,
          checked: formData.surveyData?.specialConstruction === opt,
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))), h("label", {
          className: "flex items-center gap-2 cursor-pointer p-1"
        }, h("input", {
          type: "radio",
          name: "specialConstruction",
          value: "其他",
          checked: formData.surveyData?.specialConstruction === '其他',
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, "其他："), h("input", {
          type: "text",
          name: "specialConstruction_other",
          value: formData.surveyData?.specialConstruction_other || '',
          onChange: handleSurveyChange,
          disabled: formData.surveyData?.specialConstruction !== '其他',
          placeholder: "請註明特殊施工內容",
          className: "w-48 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium"
        })))), h("div", {
          className: "col-span-full border-t border-indigo-100/50 my-2"
        }), h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "\u5DF2\u5055\u540C\u73FE\u52D8\u5EE0\u5546"), h("input", {
          type: "text",
          name: "coSurveyContractor",
          value: formData.surveyData?.coSurveyContractor || '',
          onChange: handleSurveyChange,
          placeholder: "\u586B\u5BEB",
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        })), h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "\u696D\u4E3B\u5DE5\u52D9\u806F\u7E6B\u8CC7\u8A0A"), h("input", {
          type: "text",
          name: "ownerContact",
          value: formData.surveyData?.ownerContact || '',
          onChange: handleSurveyChange,
          placeholder: "\u586B\u5BEB",
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        })), h("div", {
          className: "md:col-span-2"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "\u914D\u5408\u6C34\u96FB/\u88DD\u6F62\u806F\u7E6B\u8CC7\u8A0A"), h("input", {
          type: "text",
          name: "decoratorContact",
          value: formData.surveyData?.decoratorContact || '',
          onChange: handleSurveyChange,
          placeholder: "\u586B\u5BEB",
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        })), h("div", {
          className: "md:col-span-2"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "\u5099\u8A3B"), h("textarea", {
          name: "remarks",
          value: formData.surveyData?.remarks || '',
          onChange: handleSurveyChange,
          rows: "3",
          placeholder: "\u586B\u5BEB",
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-sm"
        })), h("div", {
          className: "md:col-span-2"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "\u7167\u7247\u662F\u5426\u4E0A\u50B3 NSA"), h("div", {
          className: "flex gap-8 mt-1"
        }, ['是', '否'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer"
        }, h("input", {
          type: "radio",
          name: "photosUploadedNSA",
          value: opt,
          checked: formData.surveyData?.photosUploadedNSA === opt,
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))))))), h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 室內機施工內容"), h("div", {
          className: "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
        },
        /* 室內機安裝位置 — 點選(多選) */
        h("div", {
          className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-3"
        }, "室內機安裝位置"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-3"
        }, ['露明(開放區域)', '輕鋼架', '暗架天花'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
        }, h("input", {
          type: "checkbox",
          name: "indoorUnitLocation",
          value: opt,
          checked: (formData.surveyData?.indoorUnitLocation || []).includes(opt),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))))),
        /* 室內機安裝高度 — 數字填寫 */
        h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "室內機安裝高度 (/cm)"), h("div", {
          className: "relative"
        }, h("input", {
          type: "number",
          name: "indoorUnitHeight",
          value: formData.surveyData?.indoorUnitHeight || '',
          onChange: handleSurveyChange,
          placeholder: "填寫高度",
          className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        }), h("span", {
          className: "absolute right-3 top-2.5 text-gray-400 text-sm"
        }, "/cm"))),
        /* 室內機架1.5"角鋼需求 — 數字填寫 */
        h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "室內機架1.5\" 角鋼需求"), h("div", {
          className: "relative"
        }, h("input", {
          type: "number",
          name: "indoorUnitAngleSteel",
          value: formData.surveyData?.indoorUnitAngleSteel || '',
          onChange: handleSurveyChange,
          placeholder: "填寫數量",
          className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        }), h("span", {
          className: "absolute right-3 top-2.5 text-gray-400 text-sm"
        }, "支"))),
        /* 室內機定位方式 — 下拉選單(多選) + 其他 */
        h("div", {
          className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-3"
        }, "室內機定位方式"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-4 items-center"
        }, ['升降機', '鷹架', '自走車', '起重工人'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
        }, h("input", {
          type: "checkbox",
          name: "indoorUnitPositioning",
          value: opt,
          checked: (formData.surveyData?.indoorUnitPositioning || []).includes(opt),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))), h("label", {
          className: "flex items-center gap-2 cursor-pointer p-1"
        }, h("input", {
          type: "checkbox",
          name: "indoorUnitPositioning",
          value: "其他",
          checked: (formData.surveyData?.indoorUnitPositioning || []).includes('其他'),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, "其他："), h("input", {
          type: "text",
          name: "indoorUnitPositioning_other",
          value: formData.surveyData?.indoorUnitPositioning_other || '',
          onChange: handleSurveyChange,
          disabled: !(formData.surveyData?.indoorUnitPositioning || []).includes('其他'),
          className: "w-40 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
          placeholder: "請註明"
        })))),
        /* 室內機吊掛方式 — 下拉選單(多選) */
        h("div", {
          className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-3"
        }, "室內機吊掛方式"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-3"
        }, ['膨脹螺絲', '萬向接頭', 'C型鋼扣3/4'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
        }, h("input", {
          type: "checkbox",
          name: "indoorUnitHanging",
          value: opt,
          checked: (formData.surveyData?.indoorUnitHanging || []).includes(opt),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))))),
        /* 室內機洗孔需求 — 數字填寫 (可增加多筆) */
        h("div", {
          className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
        }, h("div", {
          className: "flex items-center justify-between mb-3"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700"
        }, "室內機洗孔需求"), h("button", {
          type: "button",
          onClick: addHole,
          className: "flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        }, Icons.Plus({
          className: "h-4 w-4"
        }), "增加洗孔")), (formData.surveyData?.indoorUnitHoles || []).length === 0 ? h("p", {
          className: "text-sm text-gray-400"
        }, "尚未新增洗孔，請點選「增加洗孔」") : h("div", {
          className: "space-y-2"
        }, (formData.surveyData?.indoorUnitHoles || []).map((hole, index) => h("div", {
          key: index,
          className: "flex items-center gap-2"
        }, h("span", {
          className: "text-sm text-gray-500 w-10 shrink-0"
        }, "#", index + 1), h("span", {
          className: "text-sm text-gray-700 font-medium shrink-0"
        }, "孔徑"), h("div", {
          className: "relative w-40"
        }, h("input", {
          type: "number",
          value: hole.diameter || '',
          onChange: e => handleHoleChange(index, e.target.value),
          placeholder: "填寫",
          className: "w-full p-2 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        }), h("span", {
          className: "absolute right-3 top-2 text-gray-400 text-sm"
        }, "cm")), h("button", {
          type: "button",
          onClick: () => removeHole(index),
          title: "刪除此洗孔",
          className: "text-red-500 hover:text-red-700 p-1"
        }, Icons.Trash2({
          className: "h-4 w-4"
        }))))))))
        /* ===== 室外機施工內容 ===== */
        , h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 室外機施工內容"), h("div", {
          className: "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
        },
        /* 室外機搬運 — 下拉選單(多選) + 其他 */
        h("div", {
          className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-3"
        }, "室外機搬運"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-4 items-center"
        }, ['卡吊', '附鐵籠', '全吊', '鷹架', '堆高機', '升降機', '小金剛', '起重工人', '樓梯種類'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
        }, h("input", {
          type: "checkbox",
          name: "outdoorUnitTransport",
          value: opt,
          checked: (formData.surveyData?.outdoorUnitTransport || []).includes(opt),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))), h("label", {
          className: "flex items-center gap-2 cursor-pointer p-1"
        }, h("input", {
          type: "checkbox",
          name: "outdoorUnitTransport",
          value: "其他",
          checked: (formData.surveyData?.outdoorUnitTransport || []).includes('其他'),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, "其他："), h("input", {
          type: "text",
          name: "outdoorUnitTransport_other",
          value: formData.surveyData?.outdoorUnitTransport_other || '',
          onChange: handleSurveyChange,
          disabled: !(formData.surveyData?.outdoorUnitTransport || []).includes('其他'),
          className: "w-40 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
          placeholder: "請註明"
        })))),
        /* 室外機定位 — 下拉選單(多選) */
        h("div", {
          className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-3"
        }, "室外機定位"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-3"
        }, ['彈簧基座', '水泥基座', '橡膠墊片'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
        }, h("input", {
          type: "checkbox",
          name: "outdoorUnitPositioning",
          value: opt,
          checked: (formData.surveyData?.outdoorUnitPositioning || []).includes(opt),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))))),
        /* 吊車需求 — 單選 + 其他 */
        h("div", {
          className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-3"
        }, "吊車需求"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-3 items-center"
        }, ['裝新機', '拆舊機', '拆+裝同時處理', '拆+裝分開處理'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
        }, h("input", {
          type: "radio",
          name: "craneRequirement",
          value: opt,
          checked: formData.surveyData?.craneRequirement === opt,
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))), h("label", {
          className: "flex items-center gap-2 cursor-pointer p-1"
        }, h("input", {
          type: "radio",
          name: "craneRequirement",
          value: "其他",
          checked: formData.surveyData?.craneRequirement === '其他',
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, "其他："), h("input", {
          type: "text",
          name: "craneRequirement_other",
          value: formData.surveyData?.craneRequirement_other || '',
          onChange: handleSurveyChange,
          disabled: formData.surveyData?.craneRequirement !== '其他',
          className: "w-40 p-1 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
          placeholder: "請註明"
        })))),
        /* 室外機架類型 — 單選 + 噸 + 數量/組 */
        h("div", {
          className: "md:col-span-2 bg-white p-4 rounded border border-gray-200"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-3"
        }, "室外機架類型"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-3"
        }, ['鍍鋅', '白鐵', 'ABS', '沿用(需噴漆)'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
        }, h("input", {
          type: "radio",
          name: "outdoorRackType",
          value: opt,
          checked: formData.surveyData?.outdoorRackType === opt,
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt)))), h("div", {
          className: "flex flex-wrap gap-6 mt-4"
        }, h("div", {
          className: "flex items-center gap-2"
        }, h("span", {
          className: "text-sm font-medium text-gray-700 shrink-0"
        }, "角鋼重量"), h("div", {
          className: "relative w-32"
        }, h("input", {
          type: "number",
          name: "outdoorRackTons",
          value: formData.surveyData?.outdoorRackTons || '',
          onChange: handleSurveyChange,
          placeholder: "填數字",
          className: "w-full p-2 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        }), h("span", {
          className: "absolute right-3 top-2 text-gray-400 text-sm"
        }, "噸"))), h("div", {
          className: "flex items-center gap-2"
        }, h("span", {
          className: "text-sm font-medium text-gray-700 shrink-0"
        }, "數量"), h("div", {
          className: "relative w-32"
        }, h("input", {
          type: "number",
          name: "outdoorRackQty",
          value: formData.surveyData?.outdoorRackQty || '',
          onChange: handleSurveyChange,
          placeholder: "填數字",
          className: "w-full p-2 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        }), h("span", {
          className: "absolute right-3 top-2 text-gray-400 text-sm"
        }, "組"))))),
        /* 選配題目（需可隱藏）顯示切換 */
        h("div", {
          className: "md:col-span-2 flex items-center justify-between bg-amber-50 border border-amber-200 p-3 rounded"
        }, h("span", {
          className: "text-sm font-medium text-amber-800"
        }, "選配題目（可隱藏）"), h("button", {
          type: "button",
          onClick: () => (showOutdoorHideable = !showOutdoorHideable, rerender()),
          className: "text-sm font-medium text-indigo-600 hover:text-indigo-800"
        }, showOutdoorHideable ? '隱藏' : '顯示')),
        showOutdoorHideable && h("div", {
          className: "md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
        },
        /* 室外機是否加大 — 單選 */
        h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "室外機是否加大"), h("div", {
          className: "flex gap-8 mt-1"
        }, ['是', '否'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer"
        }, h("input", {
          type: "radio",
          name: "outdoorUnitEnlarged",
          value: opt,
          checked: formData.surveyData?.outdoorUnitEnlarged === opt,
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))))),
        /* 2" 角鋼增加數量 — 填寫 */
        h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "2\" 角鋼增加數量（3支以上）"), h("div", {
          className: "relative"
        }, h("input", {
          type: "number",
          name: "outdoorAngleSteelExtra",
          value: formData.surveyData?.outdoorAngleSteelExtra || '',
          onChange: handleSurveyChange,
          placeholder: "填寫數量",
          className: "w-full p-2.5 pr-10 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
        }), h("span", {
          className: "absolute right-3 top-2.5 text-gray-400 text-sm"
        }, "支"))))))), activeSurveyTab === '設備與零件' && h("div", {
          className: "space-y-8"
        },
        /* ===== 新增設備（可增加多個設備） ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("div", {
          className: "flex justify-between items-center border-b-2 border-indigo-200 pb-3 mb-6"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 新增設備"), h("button", {
          type: "button",
          onClick: addEquipment,
          className: "flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors shadow-sm"
        }, Icons.Plus({
          className: "h-4 w-4"
        }), "增加設備")), (formData.surveyData?.equipmentList || []).length === 0 ? h("div", {
          className: "text-center text-gray-400 text-sm py-6 border-2 border-dashed border-gray-200 rounded-lg"
        }, "尚未新增設備，請點選「增加設備」") : h("div", {
          className: "space-y-4"
        }, (formData.surveyData?.equipmentList || []).map((eq, index) => {
          var normalizedEq = normalizeSurveyEquip(eq, deviceCategories);
          var fieldOptions = DeviceCategoryUtils.getEquipFieldOptions(deviceCategories, normalizedEq);
          return h("div", {
          key: index,
          className: "bg-white p-4 rounded-lg border border-gray-200"
        }, h("div", {
          className: "flex justify-between items-center mb-3"
        }, h("span", {
          className: "text-sm font-bold text-indigo-700"
        }, "設備 #", index + 1), h("button", {
          type: "button",
          onClick: () => removeEquipment(index),
          title: "刪除此設備",
          className: "text-red-500 hover:text-red-700 p-1"
        }, Icons.Trash2({
          className: "h-4 w-4"
        }))), h("div", {
          className: "grid grid-cols-1 md:grid-cols-2 gap-4"
        },
        renderSurveyEquipSelect('設備分類', 'category', fieldOptions.category, normalizedEq, e => handleEquipmentChange(index, 'category', e.target.value), {
          emptyHint: '尚無設備分類資料'
        }),
        renderSurveyEquipSelect('品牌', 'brand', fieldOptions.brand, normalizedEq, e => handleEquipmentChange(index, 'brand', e.target.value), {
          waitFor: 'category',
          emptyHint: '請先選擇設備分類'
        }),
        renderSurveyEquipSelect('設備名稱', 'deviceName', fieldOptions.deviceName, normalizedEq, e => handleEquipmentChange(index, 'deviceName', e.target.value), {
          waitFor: 'brand',
          emptyHint: '請先選擇品牌'
        }),
        renderSurveyEquipSelect('設備規格', 'specification', fieldOptions.specification, normalizedEq, e => handleEquipmentChange(index, 'specification', e.target.value), {
          waitFor: 'deviceName',
          emptyHint: '請先選擇設備名稱'
        }),
        renderSurveyEquipSelect('型號', 'model', fieldOptions.model, normalizedEq, e => handleEquipmentChange(index, 'model', e.target.value), {
          waitFor: 'specification',
          emptyHint: '請先選擇設備規格'
        }),
        h("div", {
          className: "md:col-span-2"
        }, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "設備區域"), h("input", {
          type: "text",
          value: normalizedEq.area || '',
          onChange: e => handleEquipmentChange(index, 'area', e.target.value),
          placeholder: "填寫",
          className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
        }))));
        }))),
        /* ===== 零配件（多選 + 填數量） ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-2 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 零配件"), h("p", {
          className: "text-sm text-gray-500 mb-4"
        }, "請勾選需要的零配件並填寫數量（組）"), h("div", {
          className: "space-y-3"
        }, SURVEY_PARTS.map(part => h("div", {
          key: part,
          className: "flex items-center justify-between bg-white p-3 rounded border border-gray-200"
        }, h("label", {
          className: "flex items-center gap-2 cursor-pointer"
        }, h("input", {
          type: "checkbox",
          name: "parts",
          value: part,
          checked: (formData.surveyData?.parts || []).includes(part),
          onChange: handleSurveyChange,
          className: "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, part)), h("div", {
          className: "flex items-center gap-2"
        }, h("input", {
          type: "number",
          value: formData.surveyData?.partsQty?.[part] || '',
          onChange: e => handlePartQtyChange(part, e.target.value),
          disabled: !(formData.surveyData?.parts || []).includes(part),
          placeholder: "數量",
          className: "w-24 p-1.5 border rounded-md text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50"
        }), h("span", {
          className: "text-sm text-gray-500"
        }, "組")))), renderCheckQtyOthersBlock('parts', '組', '數量'))),
        /* ===== 沿用設備（需可隱藏） ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("div", {
          className: "flex justify-between items-center border-b-2 border-indigo-200 pb-3 mb-6"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 沿用設備"), h("button", {
          type: "button",
          onClick: () => (showReuseEquipment = !showReuseEquipment, rerender()),
          className: "flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-colors"
        }, showReuseEquipment ? '隱藏' : '顯示')), showReuseEquipment && h("div", {
          className: "space-y-4"
        }, h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "沿用設備"), h("input", {
          type: "text",
          name: "reuseEquipment",
          value: formData.surveyData?.reuseEquipment || '',
          onChange: handleSurveyChange,
          placeholder: "填寫",
          className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
        })), h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-1"
        }, "備註"), h("p", {
          className: "text-xs text-gray-400 mb-1"
        }, "現場舊機沿用（廠牌、型號、出廠年份、數量）及處理說明"), h("textarea", {
          name: "reuseEquipmentNote",
          rows: 4,
          value: formData.surveyData?.reuseEquipmentNote || '',
          onChange: handleSurveyChange,
          placeholder: "請填寫...",
          className: "w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500"
        }))))), activeSurveyTab === '配管工程' && h("div", {
          className: "space-y-8"
        },
        /* ===== 銅管工程 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 銅管工程"), h("div", {
          className: "space-y-6"
        }, renderPipingCheckQtyGroup('銅管尺寸與長度', '請勾選管徑規格並填寫長度（米）', 'copperSizes', 'copperSizesQty', PIPING_COPPER_SIZES, '米', '長度'), renderPipingCheckQtyGroup('銅管配件', '請勾選配件並填寫數量（個）', 'copperFittings', 'copperFittingsQty', PIPING_COPPER_FITTINGS, '個', '數量'))),
        /* ===== 排水工程 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 排水工程"), h("div", {
          className: "space-y-6"
        }, renderPipingCheckQtyGroup('PVC排水管', '請勾選管徑並填寫長度（米）', 'pvcDrain', 'pvcDrainQty', PIPING_PVC_DRAIN, '米', '長度'), renderPipingCheckQtyGroup('排水保溫', '請勾選規格並填寫長度（米）', 'drainInsulation', 'drainInsulationQty', PIPING_DRAIN_INSULATION, '米', '長度'))),
        /* ===== 冰水管工程 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 冰水管工程"), h("div", {
          className: "space-y-6"
        }, renderPipingCheckQtyGroup('冰水管配件', '請勾選配件並填寫數量（個）', 'chilledFittings', 'chilledFittingsQty', PIPING_CHILLED_FITTINGS, '個', '數量'), renderPipingCheckQtyGroup('冰水管', '請勾選管徑並填寫長度（米）', 'chilledPipe', 'chilledPipeQty', PIPING_CHILLED_PIPE, '米', '長度'), renderPipingCheckQtyGroup('冰水保溫管', '請勾選規格並填寫長度（米）', 'chilledInsulation', 'chilledInsulationQty', PIPING_CHILLED_INSULATION, '米', '長度'))),
        /* ===== 管路保護 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 管路保護"), h("div", {
          className: "space-y-6"
        }, renderPipingSingleSelect('管路保護材質', 'protectMaterial', PIPING_PROTECT_MATERIALS, formData.surveyData?.protectMaterial === 'ABS管槽' ? h("div", {
          className: "mt-4 ml-6 p-3 bg-indigo-50 rounded border border-indigo-100"
        }, h("p", {
          className: "text-xs font-bold text-indigo-700 mb-2"
        }, "ABS管槽 第二層尺寸"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-2"
        }, PIPING_ABS_SIZES.map(sz => h("label", {
          key: sz,
          className: "flex items-center gap-2 cursor-pointer"
        }, h("input", {
          type: "radio",
          name: "absSize",
          value: sz,
          checked: (formData.surveyData?.absSize || '') === sz,
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, sz))))) : null), renderPipingCheckQtyGroup('管槽配件', '請勾選配件並填寫數量／長度', 'channelFittings', 'channelFittingsQty', PIPING_CHANNEL_FITTINGS, '個', '數量'), renderPipingSingleSelect('管路保護顏色', 'protectColor', PIPING_PROTECT_COLORS)))), activeSurveyTab === '配電工程' && h("div", {
          className: "space-y-8"
        },
        /* ===== 控制及訊號線材 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 控制及訊號線材／米"), h("div", {
          className: "space-y-6"
        }, renderPipingCheckQtyGroup('控制及訊號線材', '請勾選線材規格並填寫長度（米）', 'controlSignalWire', 'controlSignalWireQty', WIRING_CONTROL_SIGNAL, '米', '長度'))),
        /* ===== 電源線線材 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 電源線線材／米"), h("div", {
          className: "space-y-6"
        }, renderPipingCheckQtyGroup('電源線線材', '請勾選線材規格並填寫長度（米）', 'powerCableWire', 'powerCableWireQty', WIRING_POWER_CABLE, '米', '長度')))), activeSurveyTab === '風管工程' && h("div", {
          className: "space-y-8"
        },
        /* ===== 保溫軟管(玻璃棉) ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 保溫軟管(玻璃棉)／米"), h("div", {
          className: "space-y-6"
        }, renderPipingCheckQtyGroup('保溫軟管(玻璃棉)', '請勾選管徑並填寫長度（米）', 'insulatedHose', 'insulatedHoseQty', DUCT_INSULATED_HOSE, '米', '長度'))),
        /* ===== 無保溫軟管(鋁箔) ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 無保溫軟管(鋁箔)／米"), h("div", {
          className: "space-y-6"
        }, renderPipingCheckQtyGroup('無保溫軟管(鋁箔)', '請勾選管徑並填寫長度（米）', 'uninsulatedHose', 'uninsulatedHoseQty', DUCT_UNINSULATED_HOSE, '米', '長度'))),
        /* ===== 集風箱 ===== */
        renderDuctBox('集風箱（管徑、數量）', 'collectBox'),
        /* ===== 出／線型箱 ===== */
        renderDuctBox('出／線型箱', 'outletBox'),
        /* ===== 回風箱 ===== */
        renderDuctBox('回風箱', 'returnBox'),
        /* ===== 強制回風箱 ===== */
        renderDuctBox('強制回風箱', 'forcedReturnBox'),
        /* ===== 三通風箱 ===== */
        renderDuctTeeBox('三通風箱', 'teeBox'),
        /* ===== 出風口 ===== */
        renderVentOutletBox(),
        /* ===== 回風口 ===== */
        renderReturnOutletBox(),
        /* ===== 特製風箱 ===== */
        renderCustomBox()), activeSurveyTab === '拆除工程' && h("div", {
          className: "space-y-8"
        },
        /* ===== 舊設備拆除 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 舊設備拆除"), h("div", {
          className: "space-y-6"
        },
        /* 設備拆除/台 */
        h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "設備拆除／台"), h("input", {
          type: "text",
          name: "demoEquip",
          value: formData.surveyData?.demoEquip || '',
          onChange: handleSurveyChange,
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
          placeholder: "請填寫數量"
        }), h("p", {
          className: "text-xs text-gray-500 mt-1.5"
        }, "備註：品牌、主機、內機、空氣門、水塔、泵浦、送風機、冰水機")),
        /* 風管拆除/台 */
        h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "風管拆除／台"), h("input", {
          type: "text",
          name: "demoDuct",
          value: formData.surveyData?.demoDuct || '',
          onChange: handleSurveyChange,
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
          placeholder: "請填寫數量"
        })),
        /* 管路拆除/米 */
        h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "管路拆除／米"), h("input", {
          type: "text",
          name: "demoPipe",
          value: formData.surveyData?.demoPipe || '',
          onChange: handleSurveyChange,
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
          placeholder: "請填寫長度（米）"
        })),
        /* 其他拆除項目、數量說明 */
        h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "其他拆除項目、數量說明"), h("textarea", {
          name: "demoOther",
          value: formData.surveyData?.demoOther || '',
          onChange: handleSurveyChange,
          rows: 3,
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
          placeholder: "請填寫"
        })))),
        /* ===== 舊機處理方式 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 舊機處理方式"), h("div", {
          className: "space-y-6"
        },
        /* 品牌、規格 */
        h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "品牌、規格"), h("input", {
          type: "text",
          name: "oldMachineSpec",
          value: formData.surveyData?.oldMachineSpec || '',
          onChange: handleSurveyChange,
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
          placeholder: "請填寫品牌、規格"
        })),
        /* 處理方式（單選） */
        h("div", null, h("label", {
          className: "block text-sm font-bold text-gray-700 mb-2"
        }, "處理方式"), h("div", {
          className: "flex flex-wrap gap-6 bg-white p-4 rounded border border-gray-200"
        }, ['協力商直接報廢', '載回晉詮', '回收補助'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer"
        }, h("input", {
          type: "radio",
          name: "oldMachineMethod",
          value: opt,
          checked: formData.surveyData?.oldMachineMethod === opt,
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))))))),
        /* ===== 廢棄物(舊風管)清運處理說明 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 廢棄物(舊風管)清運處理說明"), h("div", {
          className: "flex flex-wrap gap-x-6 gap-y-3 bg-white p-4 rounded border border-gray-200"
        }, ['裝潢處理', '晉詮處理', '協力商處理', '業主處理'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer"
        }, h("input", {
          type: "radio",
          name: "wasteDisposal",
          value: opt,
          checked: formData.surveyData?.wasteDisposal === opt,
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt))), h("label", {
          className: "flex items-center gap-2 cursor-pointer"
        }, h("input", {
          type: "radio",
          name: "wasteDisposal",
          value: "其他",
          checked: formData.surveyData?.wasteDisposal === '其他',
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium shrink-0"
        }, "其他："), h("input", {
          type: "text",
          name: "wasteDisposal_other",
          value: formData.surveyData?.wasteDisposal_other || '',
          onChange: handleSurveyChange,
          disabled: formData.surveyData?.wasteDisposal !== '其他',
          className: "p-1.5 border-b-2 border-gray-300 outline-none focus:border-indigo-500 bg-transparent disabled:opacity-50 text-sm font-medium",
          placeholder: "請註明"
        }))))), activeSurveyTab === '汰換工程' && h("div", {
          className: "space-y-8"
        },
        /* ===== 裝潢區開孔尺寸說明 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 裝潢區開孔尺寸說明"), h("textarea", {
          name: "renovationHoleSize",
          value: formData.surveyData?.renovationHoleSize || '',
          onChange: handleSurveyChange,
          rows: 3,
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
          placeholder: "請填寫"
        })),
        /* ===== 是否更新汰換 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 是否更新汰換"), h("div", {
          className: "divide-y divide-indigo-100/70 bg-white rounded border border-gray-200"
        }, ['控制/訊號線', '室外機電源線', '室內機電源線', '銅管', '冰水管', '排水管', '保溫管', '軟管', '集風箱', '出/線型風箱', '回風箱', '強制回風箱', '三通風箱', '出風口', '回風口'].map(item => h("div", {
          key: item,
          className: "flex items-center justify-between px-4 py-2.5"
        }, h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, item), h("div", {
          className: "flex items-center gap-6"
        }, ['是', '否'].map(opt => h("label", {
          key: opt,
          className: "flex items-center gap-2 cursor-pointer"
        }, h("input", {
          type: "radio",
          name: "replace_" + item,
          value: opt,
          checked: formData.surveyData?.['replace_' + item] === opt,
          onChange: handleSurveyChange,
          onClick: handleSurveyRadioClick,
          className: "w-4 h-4 text-indigo-600 focus:ring-indigo-500"
        }), h("span", {
          className: "text-sm text-gray-700 font-medium"
        }, opt)))))))),
        /* ===== 備註 ===== */
        h("div", {
          className: "bg-indigo-50/30 p-8 rounded-lg border border-indigo-100 shadow-sm"
        }, h("h3", {
          className: "text-xl font-bold text-indigo-800 border-b-2 border-indigo-200 pb-3 mb-6 flex items-center gap-2"
        }, Icons.Wrench({
          className: "h-6 w-6"
        }), " 備註"), h("textarea", {
          name: "replaceRemark",
          value: formData.surveyData?.replaceRemark || '',
          onChange: handleSurveyChange,
          rows: 3,
          className: "w-full p-2.5 border rounded-md outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm",
          placeholder: "請填寫"
        })))), h("div", {
          className: "mt-8 pt-6 border-t flex justify-end gap-4"
        }, h("button", {
          type: "button",
          onClick: () => setView('survey-list'),
          className: "px-6 py-2.5 border rounded-md text-gray-600 hover:bg-gray-50 font-medium transition-colors"
        }, "\u53D6\u6D88"), h("button", {
          type: "submit",
          className: "px-8 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 font-bold shadow-sm transition-colors"
        }, Icons.Save({
          className: "h-5 w-5"
        }), " 儲存")))));
    });
  }

  window.SurveyForm = SurveyForm;
})();
