import React, { useMemo, useState } from 'react';
import { Gift, Package, Plus, Scissors, Search, Sparkles, Trash2, X, Zap } from 'lucide-react';

import {
  CATEGORY_LABELS,
  CATEGORIES,
  clampPromotionDiscountValue,
  isPromotionService,
} from './shared';

export function ServiceEditorModal({ services, inventoryItems = [], serviceCategoryOptions = CATEGORIES, onClose, onSave, initial }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '',
    price: initial?.price || '',
    category: initial?.category || 'Cortes',
    items: initial?.items || [],
    inventoryUsage: initial?.inventoryUsage || [],
    appliesTo: initial?.appliesTo || 'General',
    discountType: initial?.discountType || 'percentage',
    discountValue: initial?.discountValue !== undefined && initial?.discountValue !== null
      ? String(clampPromotionDiscountValue(initial?.discountType || 'percentage', initial.discountValue))
      : '',
    isOptional: initial?.isOptional ?? true,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [supplySearch, setSupplySearch] = useState('');
  const [supplyFilter, setSupplyFilter] = useState('related');
  const [isSupplyConfigOpen, setIsSupplyConfigOpen] = useState(false);

  const isPromotion = formData.category === 'Promocion';
  const isCombo = formData.category === 'Combo';
  const canConfigureSupplies = !isPromotion && !isCombo && formData.category !== 'Producto';
  const serviceCategories = useMemo(
    () => Array.from(new Set([...(serviceCategoryOptions || CATEGORIES), 'Combo', 'Promocion'])).filter((category) => category !== 'Producto'),
    [serviceCategoryOptions],
  );
  const preferredSupplyCategories = useMemo(() => {
    const categoryMap = {
      Cortes: ['Cabello', 'Barba', 'Herramientas'],
      Barba: ['Barba', 'Higiene', 'Herramientas'],
      Tratamientos: ['Tratamiento', 'Cabello'],
      Facial: ['Facial'],
      Uñas: ['Uñas'],
    };
    return categoryMap[formData.category] || [formData.category];
  }, [formData.category]);
  const availableItems = useMemo(
    () => (services || []).filter((service) => (
      service.name.toLowerCase().includes(searchTerm.toLowerCase())
      && service.category !== 'Combo'
      && service.category !== 'Producto'
      && !isPromotionService(service)
    )),
    [services, searchTerm],
  );
  const rawSupplyItems = useMemo(
    () => (inventoryItems || []).filter((item) => {
      const isSupply = ['internal', 'both'].includes(item.usageType || 'retail');
      return isSupply && item.isActive !== false;
    }),
    [inventoryItems],
  );
  const supplyCategoryOptions = useMemo(() => {
    const categories = Array.from(new Set(rawSupplyItems.map((item) => item.productCategory).filter(Boolean)));
    return categories.sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [rawSupplyItems]);
  const relatedSupplyCount = useMemo(
    () => rawSupplyItems.filter((item) => preferredSupplyCategories.includes(item.productCategory || '')).length,
    [preferredSupplyCategories, rawSupplyItems],
  );
  const supplyItems = useMemo(
    () => rawSupplyItems.filter((item) => {
      const matches = [item.productName, item.name, item.productCategory, item.sku]
        .some((value) => String(value || '').toLowerCase().includes(supplySearch.toLowerCase()));
      const matchesFilter = supplyFilter === 'all'
        || (supplyFilter === 'related' && preferredSupplyCategories.includes(item.productCategory || ''))
        || item.productCategory === supplyFilter;
      return matches && matchesFilter;
    }).sort((a, b) => {
      const aSelected = formData.inventoryUsage.some((usage) => String(usage.inventoryItemId) === String(a.id));
      const bSelected = formData.inventoryUsage.some((usage) => String(usage.inventoryItemId) === String(b.id));
      if (aSelected !== bSelected) return aSelected ? 1 : -1;

      const aPreferred = preferredSupplyCategories.includes(a.productCategory || '');
      const bPreferred = preferredSupplyCategories.includes(b.productCategory || '');
      if (aPreferred !== bPreferred) return aPreferred ? -1 : 1;

      return String(a.productName || a.name || '').localeCompare(String(b.productName || b.name || ''), 'es');
    }),
    [formData.inventoryUsage, preferredSupplyCategories, rawSupplyItems, supplyFilter, supplySearch],
  );
  const supplyById = useMemo(
    () => new Map((inventoryItems || []).map((item) => [String(item.id), item])),
    [inventoryItems],
  );

  const calculateComboPrice = (items) => (
    (items || []).reduce((acc, itemId) => {
      const itemPrice = Number(services.find((service) => service.id === itemId)?.price || 0);
      return acc + itemPrice;
    }, 0)
  );

  const toggleItem = (id) => {
    const newItems = formData.items.includes(id)
      ? formData.items.filter((itemId) => itemId !== id)
      : [...formData.items, id];
    const newPrice = formData.category === 'Combo'
      ? calculateComboPrice(newItems)
      : Number(formData.price || 0);

    setFormData({ ...formData, items: newItems, price: newPrice });
  };

  const addSupply = (item) => {
    if (formData.inventoryUsage.some((usage) => String(usage.inventoryItemId) === String(item.id))) return;
    setFormData((prev) => ({
      ...prev,
      inventoryUsage: [
        ...prev.inventoryUsage,
        { inventoryItemId: item.id, quantity: 1 },
      ],
    }));
  };

  const updateSupplyQuantity = (inventoryItemId, quantity) => {
    setFormData((prev) => ({
      ...prev,
      inventoryUsage: prev.inventoryUsage.map((usage) => (
        String(usage.inventoryItemId) === String(inventoryItemId)
          ? { ...usage, quantity }
          : usage
      )),
    }));
  };

  const removeSupply = (inventoryItemId) => {
    setFormData((prev) => ({
      ...prev,
      inventoryUsage: prev.inventoryUsage.filter((usage) => String(usage.inventoryItemId) !== String(inventoryItemId)),
    }));
  };

  const supplyCost = useMemo(
    () => formData.inventoryUsage.reduce((sum, usage) => {
      const item = supplyById.get(String(usage.inventoryItemId));
      return sum + (Number(usage.quantity || 0) * Number(item?.costPrice || 0));
    }, 0),
    [formData.inventoryUsage, supplyById],
  );
  const estimatedMargin = Math.max(Number(formData.price || 0) - supplyCost, 0);

  return (
    <div className="barber-service-editor fixed inset-0 z-[300] flex items-center justify-center bg-[#24181f]/80 p-4 backdrop-blur-xl animate-in fade-in text-[#302530] no-print">
      <div className="barber-service-panel relative w-full max-w-7xl min-h-[70vh] max-h-[96vh] overflow-hidden rounded-[2rem] border border-[#ee9fbc] bg-white shadow-[0_30px_90px_rgba(52,31,42,0.38)] animate-in zoom-in-95 flex flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-[#f2c1d4] bg-[#fff7fb] px-5 md:px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d94f83] text-white shadow-[0_14px_30px_rgba(217,79,131,0.25)]">
              {isCombo ? <Zap size={26} /> : isPromotion ? <Gift size={26} /> : formData.category === 'Producto' ? <Package size={26} /> : ['Uñas', 'Facial', 'Tratamientos'].includes(formData.category) ? <Sparkles size={26} /> : <Scissors size={26} />}
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d94f83]">Catálogo de barbería</p>
              <h3 className="mt-1 text-2xl font-black uppercase italic tracking-tighter leading-none text-[#302530]">{initial?.id ? 'Editar servicio' : 'Nuevo servicio'}</h3>
            </div>
          </div>
          <button onClick={onClose} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#ee9fbc] bg-white text-[#9b6076] transition-all hover:bg-[#fff7fb]">
            <X size={20} />
          </button>
        </div>

        <form
          id="service-editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            const normalizedDiscountValue = clampPromotionDiscountValue(
              formData.discountType || 'percentage',
              formData.discountValue,
            );
            const normalized = {
              ...formData,
              price: formData.category === 'Promocion' ? 0 : Number(formData.price) || 0,
              discountValue: normalizedDiscountValue,
              items: formData.category === 'Combo' ? formData.items : [],
              inventoryUsage: canConfigureSupplies
                ? formData.inventoryUsage
                  .map((usage) => ({
                    ...usage,
                    quantity: Number(usage.quantity || 0),
                  }))
                  .filter((usage) => usage.inventoryItemId && usage.quantity > 0)
                : [],
              targetServiceIds: [],
            };
            onSave(normalized);
          }}
          className="flex-1 overflow-y-auto custom-scrollbar"
        >
          <div className="grid grid-cols-1 gap-5 p-5 md:p-8 pb-28">
            <div className="space-y-5">
              <section className="rounded-[1.8rem] border border-[#f2c1d4] bg-white p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="space-y-2">
                    <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#9b6076]">Categoría</span>
                    <select
                      className="w-full rounded-2xl border border-[#ee9fbc] bg-[#fff7fb] px-5 py-4 text-sm font-black uppercase italic text-[#302530] outline-none focus:border-[#d94f83]"
                      value={formData.category}
                      onChange={(event) => setFormData({
                        ...formData,
                        category: event.target.value,
                        items: event.target.value === 'Combo' ? formData.items : [],
                        inventoryUsage: ['Combo', 'Promocion', 'Producto'].includes(event.target.value) ? [] : formData.inventoryUsage,
                      })}
                    >
                      {serviceCategories.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category] || category}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2">
                    <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#9b6076]">Nombre</span>
                    <input
                      required
                      placeholder={isPromotion ? 'Ej. Servicio gratis por fidelidad' : 'Ej. Corte premium, barba o tratamiento'}
                      className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-5 py-4 text-sm font-black uppercase italic text-[#302530] outline-none focus:border-[#d94f83]"
                      value={formData.name}
                      onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    />
                  </label>
                </div>

                {!isPromotion ? (
                  <label className="mt-5 block space-y-2">
                    <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#9b6076]">Precio final (C$)</span>
                    <div className="relative">
                      <input
                        required
                        type="number"
                        className="w-full rounded-[1.8rem] border border-[#ee9fbc] bg-[#fff7fb] py-6 pl-20 pr-8 text-4xl font-black italic leading-none text-[#302530] outline-none focus:border-[#6fb89b]"
                        value={formData.price}
                        onChange={(event) => setFormData({ ...formData, price: event.target.value ? Number(event.target.value) : 0 })}
                      />
                      <span className="absolute left-8 top-1/2 -translate-y-1/2 text-2xl font-black italic leading-none text-[#4f8674]">C$</span>
                    </div>
                  </label>
                ) : null}
              </section>

              {isPromotion ? (
                <section className="space-y-5 rounded-[1.8rem] border border-[#b7d8c7] bg-[#edf7f2] p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#4f8674]">Cobertura</span>
                      <input readOnly value="GENERAL" className="w-full rounded-2xl border border-[#b7d8c7] bg-white px-5 py-4 text-sm font-black uppercase italic text-[#302530] outline-none" />
                    </label>
                    <label className="space-y-2">
                      <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#4f8674]">Tipo de descuento</span>
                      <select
                        className="w-full rounded-2xl border border-[#b7d8c7] bg-white px-5 py-4 text-sm font-black uppercase italic text-[#302530] outline-none focus:border-[#6fb89b]"
                        value={formData.discountType}
                        onChange={(event) => setFormData({
                          ...formData,
                          discountType: event.target.value,
                          discountValue: String(clampPromotionDiscountValue(event.target.value, formData.discountValue)),
                        })}
                      >
                        <option value="percentage">Porcentaje</option>
                        <option value="fixed">Monto fijo</option>
                      </select>
                    </label>
                  </div>
                  <label className="block space-y-2">
                    <span className="block text-[9px] font-black uppercase italic tracking-[0.18em] text-[#4f8674]">
                      {formData.discountType === 'fixed' ? 'Descuento en córdobas' : 'Porcentaje de descuento'}
                    </span>
                    <input
                      required
                      type="text"
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-[#b7d8c7] bg-white px-5 py-4 text-lg font-black italic text-[#302530] outline-none focus:border-[#6fb89b]"
                      value={formData.discountValue}
                      onChange={(event) => {
                        const rawValue = event.target.value.replace(',', '.');
                        if (!/^\d*\.?\d*$/.test(rawValue)) return;
                        if (rawValue === '') {
                          setFormData({ ...formData, discountValue: '' });
                          return;
                        }
                        setFormData({ ...formData, discountValue: String(clampPromotionDiscountValue(formData.discountType, rawValue)) });
                      }}
                    />
                  </label>
                </section>
              ) : null}

              {isCombo ? (
                <section className="space-y-4 rounded-[1.8rem] border border-[#f2c1d4] bg-[#fff7fb] p-5">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d94f83]">Componer combo</p>
                    <p className="mt-1 text-[11px] font-bold text-[#856a75]">Selecciona servicios para calcular el precio base.</p>
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar ítems"
                    className="w-full rounded-2xl border border-[#ee9fbc] bg-white px-5 py-4 text-xs font-black uppercase italic text-[#302530] outline-none"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {availableItems.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => toggleItem(item.id)}
                        className={`flex items-center justify-between rounded-2xl border p-4 text-left transition-all ${formData.items.includes(item.id) ? 'border-[#6fb89b] bg-[#edf7f2]' : 'border-[#ee9fbc] bg-white'}`}
                      >
                        <span className="text-[11px] font-black uppercase italic text-[#302530]">{item.name}</span>
                        <span className="text-[11px] font-black italic text-[#4f8674]">C$ {item.price}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {canConfigureSupplies && isSupplyConfigOpen ? (
                <section className="space-y-4 rounded-[1.8rem] border border-[#f2c1d4] bg-[#fff7fb] p-5">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d94f83]">Insumos del servicio</p>
                      <p className="mt-1 text-[11px] font-bold text-[#856a75]">Configura lo que se descontará del inventario al cobrar.</p>
                    </div>
                    <div className="rounded-2xl border border-[#b7d8c7] bg-white px-4 py-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#4f8674]">Costo estimado</p>
                      <p className="text-lg font-black italic text-[#2f6f61]">C$ {supplyCost.toLocaleString('es-NI')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-4">
                    <div className="space-y-3 rounded-[1.5rem] border border-[#f2c1d4] bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#d94f83]">Disponibles</p>
                          <p className="mt-1 text-[10px] font-bold text-[#856a75]">
                            Primero: {preferredSupplyCategories.join(', ')}
                          </p>
                        </div>
                        <span className="rounded-full border border-[#b7d8c7] bg-[#edf7f2] px-3 py-1 text-[8px] font-black uppercase text-[#4f8674]">
                          {supplyItems.length}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="Buscar insumo"
                        className="w-full rounded-2xl border border-[#ee9fbc] bg-[#fff7fb] px-5 py-4 text-xs font-black uppercase italic text-[#302530] outline-none"
                        value={supplySearch}
                        onChange={(event) => setSupplySearch(event.target.value)}
                      />
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                        {supplyItems.map((item) => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => addSupply(item)}
                            className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-all hover:bg-[#fff7fb] ${
                              preferredSupplyCategories.includes(item.productCategory || '')
                                ? 'border-[#b7d8c7] bg-[#edf7f2]'
                                : 'border-[#ee9fbc] bg-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-black uppercase italic text-[#302530]">{item.productName || item.name}</p>
                              <p className="mt-1 text-[9px] font-bold uppercase text-[#856a75]">{item.productCategory || 'Insumo'} · Stock {Number(item.currentStock || 0).toLocaleString('es-NI')}</p>
                            </div>
                            <Plus size={16} className="shrink-0 text-[#d94f83]" />
                          </button>
                        ))}
                        {!supplyItems.length && (
                          <div className="rounded-2xl border border-dashed border-[#ee9fbc] bg-white p-5 text-center text-[10px] font-black uppercase tracking-[0.14em] text-[#9b6076]">
                            No hay insumos disponibles
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[1.5rem] border border-[#f2c1d4] bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#d94f83]">Seleccionados</p>
                          <p className="mt-1 text-[10px] font-bold text-[#856a75]">Cantidad estandar por servicio</p>
                        </div>
                        <span className="rounded-full border border-[#ee9fbc] bg-[#fff7fb] px-3 py-1 text-[8px] font-black uppercase text-[#9b6076]">
                          {formData.inventoryUsage.length}
                        </span>
                      </div>
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                      {formData.inventoryUsage.map((usage) => {
                        const item = supplyById.get(String(usage.inventoryItemId));
                        return (
                          <div key={usage.inventoryItemId} className="rounded-2xl border border-[#ee9fbc] bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-[11px] font-black uppercase italic text-[#302530]">{item?.productName || item?.name || 'Insumo'}</p>
                                <p className="mt-1 text-[9px] font-bold uppercase text-[#856a75]">Costo unitario C$ {Number(item?.costPrice || 0).toLocaleString('es-NI')}</p>
                              </div>
                              <button type="button" onClick={() => removeSupply(usage.inventoryItemId)} className="rounded-xl border border-[#f2c1d4] p-2 text-[#d94f83]">
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={usage.quantity}
                                onChange={(event) => updateSupplyQuantity(usage.inventoryItemId, event.target.value)}
                                className="w-full rounded-xl border border-[#ee9fbc] bg-[#fff7fb] px-4 py-3 text-sm font-black text-[#302530] outline-none"
                              />
                              <span className="text-[10px] font-black uppercase text-[#856a75]">{item?.unitName || 'unidad'}</span>
                            </div>
                          </div>
                        );
                      })}
                      {!formData.inventoryUsage.length && (
                        <div className="rounded-2xl border border-dashed border-[#ee9fbc] bg-white p-8 text-center text-[10px] font-black uppercase tracking-[0.14em] text-[#9b6076]">
                          Este servicio todavía no tiene insumos
                        </div>
                      )}
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>

            {canConfigureSupplies && isSupplyConfigOpen && (
            <aside className="space-y-4">
              <div className="rounded-[1.8rem] border border-[#b7d8c7] bg-[#edf7f2] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4f8674]">Resumen</p>
                <h4 className="mt-3 text-lg font-black uppercase italic leading-tight text-[#302530]">{formData.name || 'Servicio sin nombre'}</h4>
                <div className="mt-5 space-y-3 text-sm font-black">
                  <div className="flex justify-between gap-3 border-b border-[#b7d8c7] pb-3">
                    <span className="text-[#856a75]">Precio</span>
                    <span className="text-[#302530]">C$ {Number(formData.price || 0).toLocaleString('es-NI')}</span>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-[#b7d8c7] pb-3">
                    <span className="text-[#856a75]">Insumos</span>
                    <span className="text-[#4f8674]">C$ {supplyCost.toLocaleString('es-NI')}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-[#856a75]">Margen bruto</span>
                    <span className="text-[#d94f83]">C$ {estimatedMargin.toLocaleString('es-NI')}</span>
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full rounded-[1.6rem] bg-[#d94f83] px-6 py-5 text-[11px] font-black uppercase italic tracking-[0.16em] text-white shadow-[0_16px_34px_rgba(217,79,131,0.25)] transition-all hover:bg-[#c83f75]">
                Guardar catálogo
              </button>
              <button type="button" onClick={onClose} className="w-full rounded-[1.6rem] border border-[#ee9fbc] bg-white px-6 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#9b6076]">
                Cancelar
              </button>
            </aside>
            )}
          </div>
        </form>

        <div className="absolute bottom-5 right-5 z-20 flex flex-col sm:flex-row gap-3">
          <button type="submit" form="service-editor-form" className="rounded-[1.4rem] bg-[#d94f83] px-7 py-4 text-[11px] font-black uppercase italic tracking-[0.16em] text-white shadow-[0_16px_34px_rgba(217,79,131,0.25)] transition-all hover:bg-[#c83f75]">
            Guardar catálogo
          </button>
          <button type="button" onClick={onClose} className="rounded-[1.4rem] border border-[#ee9fbc] bg-white px-7 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#9b6076]">
            Cancelar
          </button>
        </div>

        {canConfigureSupplies && (
          <button
            type="button"
            onClick={() => setIsSupplyConfigOpen(true)}
            className="absolute bottom-5 left-5 z-20 flex items-center gap-3 rounded-[1.4rem] border border-[#8fd6cf] bg-[#2fb7ae] px-5 py-4 text-left text-white shadow-[0_16px_34px_rgba(47,183,174,0.28)] transition-all hover:bg-[#259f98] active:scale-95"
          >
            <Package size={18} />
            <span>
              <span className="block text-[9px] font-black uppercase tracking-[0.18em] opacity-90">Insumos</span>
              <span className="block text-[11px] font-black uppercase italic tracking-[0.1em]">
                {formData.inventoryUsage.length} configurados · C$ {supplyCost.toLocaleString('es-NI')}
              </span>
            </span>
          </button>
        )}

        {isSupplyConfigOpen && (
          <div className="barber-supply-config fixed inset-0 z-[340] flex items-center justify-center bg-[#24181f]/75 p-3 backdrop-blur-md">
            <div className="barber-supply-panel flex h-[94vh] w-[98vw] max-w-[1600px] flex-col overflow-hidden rounded-[1.6rem] border border-[#8fd6cf] bg-white shadow-[0_30px_90px_rgba(23,91,86,0.32)] animate-in zoom-in-95">
              <div className="flex items-center justify-between gap-4 border-b border-[#c6ebe6] bg-[#ecfbf8] px-5 md:px-7 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2f8f88]">Configuracion de servicio</p>
                  <h3 className="mt-1 text-xl font-black uppercase italic tracking-tighter leading-none text-[#302530]">
                    Insumos de {formData.name || 'servicio'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSupplyConfigOpen(false)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#8fd6cf] bg-white text-[#2f8f88] transition-all hover:bg-[#f3fffd]"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 md:p-5">
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
                <section className="flex min-h-0 flex-col gap-3 rounded-[1.35rem] border border-[#c6ebe6] bg-[#f3fffd] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2f8f88]">Disponibles</p>
                      <p className="mt-1 text-[11px] font-bold text-[#58716e]">Busca, filtra y agrega insumos al servicio.</p>
                    </div>
                    <span className="rounded-full border border-[#8fd6cf] bg-white px-3 py-1 text-[9px] font-black uppercase text-[#2f8f88]">
                      {supplyItems.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2 rounded-2xl border border-[#8fd6cf] bg-white px-3 py-2 focus-within:border-[#2fb7ae]">
                      <Search size={16} className="shrink-0 text-[#2f8f88]" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, categoria o SKU"
                        className="min-w-0 flex-1 bg-transparent text-xs font-black uppercase italic text-[#302530] outline-none placeholder:text-[#9ab8b4]"
                        value={supplySearch}
                        onChange={(event) => setSupplySearch(event.target.value)}
                      />
                      {supplySearch && (
                        <button
                          type="button"
                          onClick={() => setSupplySearch('')}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[#9b6076] hover:bg-[#fff7fb]"
                          aria-label="Limpiar busqueda"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'related', label: `Relacionados ${relatedSupplyCount}` },
                        { key: 'all', label: `Todos ${rawSupplyItems.length}` },
                        ...supplyCategoryOptions.map((category) => ({ key: category, label: category })),
                      ].map((option) => {
                        const isActive = supplyFilter === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setSupplyFilter(option.key)}
                            className={`rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-[0.12em] transition-all ${
                              isActive
                                ? 'border-[#2fb7ae] bg-[#2fb7ae] text-white shadow-[0_10px_22px_rgba(47,183,174,0.2)]'
                                : 'border-[#8fd6cf] bg-white text-[#2f8f88] hover:bg-[#ecfbf8]'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-2 overflow-y-auto pr-1 custom-scrollbar">
                    {supplyItems.map((item) => {
                      const isSelected = formData.inventoryUsage.some((usage) => String(usage.inventoryItemId) === String(item.id));
                      const isPreferred = preferredSupplyCategories.includes(item.productCategory || '');
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => addSupply(item)}
                          disabled={isSelected}
                            className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition-all ${
                            isSelected
                              ? 'border-[#cfdedb] bg-[#eef5f3] text-[#8da19d] opacity-70'
                              : isPreferred
                                ? 'border-[#8fd6cf] bg-white text-[#302530] hover:bg-[#ecfbf8]'
                                : 'border-[#f2c1d4] bg-white text-[#302530] hover:bg-[#fff7fb]'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-black uppercase italic">{item.productName || item.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[8px] font-black uppercase text-[#58716e]">
                              {item.productCategory || 'Insumo'} · Stock {Number(item.currentStock || 0).toLocaleString('es-NI')}
                            </div>
                          </div>
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${
                            isSelected ? 'border-[#cfdedb] bg-white text-[#8da19d]' : 'border-[#8fd6cf] bg-[#ecfbf8] text-[#2fb7ae]'
                          }`}>
                            <Plus size={16} />
                          </span>
                        </button>
                      );
                    })}
                    {!supplyItems.length && (
                      <div className="rounded-2xl border border-dashed border-[#8fd6cf] bg-white p-8 text-center text-[10px] font-black uppercase tracking-[0.14em] text-[#2f8f88]">
                        No hay insumos con ese filtro
                      </div>
                    )}
                  </div>
                </section>

                <section className="flex min-h-0 flex-col space-y-3 rounded-[1.35rem] border border-[#ee9fbc] bg-[#fff7fb] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d94f83]">Seleccionados</p>
                      <p className="mt-1 text-[11px] font-bold text-[#856a75]">Cantidad estandar que se descontara por servicio.</p>
                    </div>
                    <div className="rounded-2xl border border-[#8fd6cf] bg-white px-4 py-2 text-right">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#2f8f88]">Costo</p>
                      <p className="text-lg font-black italic text-[#2f6f61]">C$ {supplyCost.toLocaleString('es-NI')}</p>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                    {formData.inventoryUsage.length > 0 && (
                      <div className="rounded-2xl border border-[#ee9fbc] bg-white">
                        <div>
                          <div className="grid grid-cols-[minmax(0,1fr)_120px_90px_115px_50px] items-center gap-3 border-b border-[#f2c1d4] bg-[#fff7fb] px-3 py-2 text-[8px] font-black uppercase tracking-[0.14em] text-[#9b6076]">
                            <span>Producto</span>
                            <span>Cantidad</span>
                            <span>Unidad</span>
                            <span className="text-right">Costo</span>
                            <span className="text-right"></span>
                          </div>
                          <div className="divide-y divide-[#f7d7e2]">
                            {formData.inventoryUsage.map((usage) => {
                              const item = supplyById.get(String(usage.inventoryItemId));
                              const lineCost = Number(usage.quantity || 0) * Number(item?.costPrice || 0);

                              return (
                                <div key={usage.inventoryItemId} className="grid grid-cols-[minmax(0,1fr)_120px_90px_115px_50px] items-center gap-3 px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-[11px] font-black uppercase italic text-[#302530]">{item?.productName || item?.name || 'Insumo'}</p>
                                    <p className="mt-1 text-[8px] font-bold uppercase text-[#856a75]">
                                      Unit. C$ {Number(item?.costPrice || 0).toLocaleString('es-NI')}
                                    </p>
                                  </div>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={usage.quantity}
                                    onChange={(event) => updateSupplyQuantity(usage.inventoryItemId, event.target.value)}
                                    className="w-full rounded-xl border border-[#ee9fbc] bg-[#fff7fb] px-3 py-2 text-sm font-black text-[#302530] outline-none focus:border-[#d94f83]"
                                  />
                                  <span className="text-[9px] font-black uppercase text-[#856a75]">{item?.unitName || 'unidad'}</span>
                                  <span className="text-right text-sm font-black italic text-[#2f8f88]">C$ {lineCost.toLocaleString('es-NI')}</span>
                                  <button type="button" onClick={() => removeSupply(usage.inventoryItemId)} className="ml-auto rounded-xl border border-[#f2c1d4] p-2 text-[#d94f83] hover:bg-[#fff7fb]">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    {!formData.inventoryUsage.length && (
                      <div className="rounded-2xl border border-dashed border-[#ee9fbc] bg-white p-10 text-center text-[10px] font-black uppercase tracking-[0.14em] text-[#9b6076]">
                          Este servicio todavía no tiene insumos
                      </div>
                    )}
                  </div>

                  <div className="hidden">
                    {formData.inventoryUsage.map((usage) => {
                      const item = supplyById.get(String(usage.inventoryItemId));
                      return (
                        <div key={usage.inventoryItemId} className="rounded-2xl border border-[#ee9fbc] bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-black uppercase italic text-[#302530]">{item?.productName || item?.name || 'Insumo'}</p>
                              <p className="mt-1 text-[9px] font-bold uppercase text-[#856a75]">
                                Costo unitario C$ {Number(item?.costPrice || 0).toLocaleString('es-NI')} · {item?.unitName || 'unidad'}
                              </p>
                            </div>
                            <button type="button" onClick={() => removeSupply(usage.inventoryItemId)} className="rounded-xl border border-[#f2c1d4] p-2 text-[#d94f83] hover:bg-[#fff7fb]">
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={usage.quantity}
                              onChange={(event) => updateSupplyQuantity(usage.inventoryItemId, event.target.value)}
                              className="w-full rounded-xl border border-[#ee9fbc] bg-[#fff7fb] px-4 py-3 text-sm font-black text-[#302530] outline-none focus:border-[#d94f83]"
                            />
                            <span className="text-[10px] font-black uppercase text-[#856a75]">{item?.unitName || 'unidad'}</span>
                          </div>
                        </div>
                      );
                    })}
                    {!formData.inventoryUsage.length && (
                      <div className="rounded-2xl border border-dashed border-[#ee9fbc] bg-white p-10 text-center text-[10px] font-black uppercase tracking-[0.14em] text-[#9b6076]">
                          Este servicio todavía no tiene insumos
                      </div>
                    )}
                  </div>
                </section>
                </div>

                <section className="rounded-[1.25rem] border border-[#c6ebe6] bg-[#f8fffd] p-4">
                  <div className="flex flex-col gap-2 border-b border-[#c6ebe6] pb-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2f8f88]">Desglose del servicio</p>
                      <h4 className="mt-1 text-base font-black uppercase italic text-[#302530]">{formData.name || 'Servicio sin nombre'}</h4>
                    </div>
                    <span className="w-fit rounded-full border border-[#8fd6cf] bg-white px-4 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-[#2f8f88]">
                      {formData.inventoryUsage.length} insumos
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="flex items-center justify-between gap-4 text-sm font-black">
                      <span className="text-[#58716e]">Precio del servicio</span>
                      <span className="text-[#302530]">C$ {Number(formData.price || 0).toLocaleString('es-NI')}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-sm font-black">
                      <span className="text-[#58716e]">Costo estimado de insumos</span>
                      <span className="text-[#2f8f88]">- C$ {supplyCost.toLocaleString('es-NI')}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-[#c6ebe6] pt-3 text-base font-black md:border-l md:border-t-0 md:pl-4 md:pt-0">
                      <span className="uppercase tracking-[0.14em] text-[#9b6076]">Margen bruto estimado</span>
                      <span className="text-xl italic text-[#d94f83]">C$ {estimatedMargin.toLocaleString('es-NI')}</span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 border-t border-[#c6ebe6] bg-white px-5 md:px-7 py-3">
                <button
                  type="button"
                  onClick={() => setIsSupplyConfigOpen(false)}
                  className="rounded-[1.2rem] border border-[#8fd6cf] bg-white px-7 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#2f8f88] hover:bg-[#f3fffd]"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

