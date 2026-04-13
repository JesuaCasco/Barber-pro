import React, { useMemo, useState } from 'react';
import { Gift, Scissors, X, Zap } from 'lucide-react';

import {
  CATEGORY_LABELS,
  CATEGORIES,
  clampPromotionDiscountValue,
  isPromotionService,
} from './shared';

export function ServiceEditorModal({ services, onClose, onSave, initial }) {
  const [formData, setFormData] = useState({
    name: initial?.name || '',
    price: initial?.price || '',
    category: initial?.category || 'Cortes',
    items: initial?.items || [],
    appliesTo: initial?.appliesTo || 'General',
    discountType: initial?.discountType || 'percentage',
    discountValue: initial?.discountValue !== undefined && initial?.discountValue !== null
      ? String(clampPromotionDiscountValue(initial?.discountType || 'percentage', initial.discountValue))
      : '',
    isOptional: initial?.isOptional ?? true,
  });
  const [searchTerm, setSearchTerm] = useState('');

  const isPromotion = formData.category === 'Promocion';
  const availableItems = useMemo(
    () => (services || []).filter((service) => (
      service.name.toLowerCase().includes(searchTerm.toLowerCase())
      && service.category !== 'Combo'
      && !isPromotionService(service)
    )),
    [services, searchTerm],
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-slate-950 w-full max-w-xl rounded-[3.5rem] shadow-2xl border border-slate-800 animate-in zoom-in-95 max-h-[95vh] flex flex-col text-white overflow-hidden">
        <div className="px-12 py-8 bg-gradient-to-br from-indigo-600/20 border-b border-slate-900 flex justify-between items-center text-white">
          <div className="flex items-center gap-6 text-white">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              {formData.category === 'Combo' ? <Zap size={28} /> : formData.category === 'Promocion' ? <Gift size={28} /> : <Scissors size={28} />}
            </div>
            <div>
              <h3 className="text-2xl font-black uppercase italic text-white leading-none">{initial?.id ? 'Editar' : 'Nuevo'} Registro</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-3 bg-black rounded-xl text-slate-500 text-white">
            <X size={20} />
          </button>
        </div>

        <form
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
              targetServiceIds: [],
            };
            onSave(normalized);
          }}
          className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1 text-white"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
            <div className="space-y-3 text-white">
              <label className="text-[10px] font-black text-slate-500 uppercase italic px-1 leading-none">Categoría</label>
              <select
                className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold uppercase italic text-white outline-none focus:border-indigo-600 appearance-none leading-none cursor-pointer"
                value={formData.category}
                onChange={(event) => setFormData({
                  ...formData,
                  category: event.target.value,
                  items: event.target.value === 'Combo' ? formData.items : [],
                })}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category} className="bg-slate-950 text-white">
                    {CATEGORY_LABELS[category] || category}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3 text-white">
              <label className="text-[10px] font-black text-slate-500 uppercase italic px-1 leading-none">Nombre</label>
              <input
                required
                placeholder={isPromotion ? 'Ej. Corte gratis por fidelidad' : 'Ej. Combo Pro'}
                className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold uppercase italic text-white outline-none focus:border-indigo-600 italic leading-none"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              />
            </div>
          </div>

          {isPromotion ? (
            <div className="space-y-6 rounded-[2.5rem] border border-emerald-500/20 bg-emerald-500/5 p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-300 uppercase italic px-1 leading-none">Cobertura</label>
                  <input
                    readOnly
                    value="GENERAL"
                    className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold uppercase italic text-white outline-none leading-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-300 uppercase italic px-1 leading-none">Tipo de descuento</label>
                  <select
                    className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold uppercase italic text-white outline-none focus:border-emerald-500 appearance-none leading-none cursor-pointer"
                    value={formData.discountType}
                    onChange={(event) => setFormData({
                      ...formData,
                      discountType: event.target.value,
                      discountValue: String(clampPromotionDiscountValue(event.target.value, formData.discountValue)),
                    })}
                  >
                    <option value="percentage" className="bg-slate-950 text-white">Porcentaje</option>
                    <option value="fixed" className="bg-slate-950 text-white">Monto fijo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-emerald-300 uppercase italic px-1 leading-none">
                  {formData.discountType === 'fixed' ? 'Descuento en córdobas' : 'Porcentaje de descuento'}
                </label>
                <input
                  required
                  type="text"
                  inputMode="decimal"
                  className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-lg font-black italic text-white outline-none focus:border-emerald-500 leading-none"
                  value={formData.discountValue}
                  onChange={(event) => {
                    const rawValue = event.target.value.replace(',', '.');
                    if (!/^\d*\.?\d*$/.test(rawValue)) return;
                    if (rawValue === '') {
                      setFormData({ ...formData, discountValue: '' });
                      return;
                    }
                    const normalizedValue = clampPromotionDiscountValue(formData.discountType, rawValue);
                    setFormData({ ...formData, discountValue: String(normalizedValue) });
                  }}
                />
              </div>
            </div>
          ) : null}

          {formData.category === 'Combo' ? (
            <div className="space-y-5 bg-indigo-600/5 p-8 rounded-[2.5rem] border border-indigo-500/20 text-white">
              <label className="text-[10px] font-black text-indigo-400 uppercase italic px-1 leading-none">Componer Combo</label>
              <div className="flex flex-col gap-4 text-white">
                <input
                  type="text"
                  placeholder="BUSCAR ÍTEMS"
                  className="w-full bg-black border border-slate-800 rounded-2xl px-8 py-4 text-sm font-black uppercase italic text-white leading-none"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                <div className="space-y-3 max-h-60 overflow-y-auto pr-3 custom-scrollbar text-white">
                  {availableItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-center justify-between p-4 rounded-[1.8rem] cursor-pointer border ${formData.items.includes(item.id) ? 'bg-indigo-600/20 border-indigo-500' : 'bg-black border-slate-800'} text-white`}
                    >
                      <span className="text-[11px] font-black uppercase italic text-white leading-none">{item.name}</span>
                      <span className="text-[11px] font-black text-emerald-400 italic leading-none">C$ {item.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {!isPromotion ? (
            <div className="space-y-3 text-white">
              <label className="text-[10px] font-black text-slate-500 uppercase italic px-1 leading-none">Precio Final (C$)</label>
              <div className="relative text-white">
                <input
                  required
                  type="number"
                  className="w-full bg-black border border-slate-800 rounded-[2.5rem] pl-20 pr-8 py-8 text-5xl font-black italic text-white outline-none focus:border-emerald-500 leading-none"
                  value={formData.price}
                  onChange={(event) => setFormData({ ...formData, price: event.target.value ? Number(event.target.value) : 0 })}
                />
                <span className="absolute left-8 top-1/2 -translate-y-1/2 text-3xl font-black text-emerald-500 italic text-white leading-none">C$</span>
              </div>
            </div>
          ) : null}

          {isPromotion ? (
            <div className="rounded-[2.5rem] border border-emerald-500/20 bg-black/40 px-8 py-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Resumen de promoción</p>
              <p className="mt-3 text-lg font-black uppercase italic text-white">{formData.name || 'Promoción sin nombre'}</p>
              <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
                {formData.discountType === 'fixed'
                  ? `Descuento fijo de C$ ${Number(formData.discountValue || 0).toLocaleString('es-NI')}`
                  : `${Number(formData.discountValue || 0)}% de descuento`}
              </p>
            </div>
          ) : null}

          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-7 rounded-[2.5rem] font-black uppercase italic text-xs transition-all text-white leading-none">
            GUARDAR CATÁLOGO
          </button>
        </form>
      </div>
    </div>
  );
}
