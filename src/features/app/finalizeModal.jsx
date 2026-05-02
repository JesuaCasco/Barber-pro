import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Star,
  X,
} from 'lucide-react';

import {
  CATEGORY_LABELS,
  CATEGORIES,
  LOYALTY_REWARD_VISITS,
  calculatePromotionDiscount,
  formatPromotionValue,
  getApplicablePromotions,
  isPromotionService,
  makeId,
} from './shared';

export function FinalizeModal({ onClose, onConfirm, services, clients, initial }) {
  const [billItems, setBillItems] = useState(() => {
    if (initial?.service && initial.service !== 'POR DEFINIR') {
      const match = (services || []).find((service) => service.name === initial.service);
      return match ? [{ ...match, uniqueId: makeId() }] : [];
    }
    return [];
  });
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState(5);
  const [selectedPromotionId, setSelectedPromotionId] = useState('');
  const [promotionPickerOpen, setPromotionPickerOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState('catalog');

  const billingClient = useMemo(
    () => (clients || []).find((client) => String(client.id) === String(initial?.clientId || initial?.client?.id || '')) || null,
    [clients, initial],
  );
  const completedVisits = Number(billingClient?.completedVisits || 0);
  const projectedVisitCount = completedVisits + (initial?.status === 'Finalizada' ? 0 : 1);

  const loyaltyPromotion = useMemo(() => {
    if (!billingClient || projectedVisitCount <= 0 || projectedVisitCount % LOYALTY_REWARD_VISITS !== 0) return null;

    const eligibleCuts = billItems.filter((item) => item?.category === 'Cortes');
    if (!eligibleCuts.length) return null;

    const loyaltyCutValue = Math.max(...eligibleCuts.map((item) => Number(item.price || 0)), 0);
    if (loyaltyCutValue <= 0) return null;

    return {
      id: `loyalty-${billingClient.id}-${projectedVisitCount}`,
      name: `Corte gratis por ${LOYALTY_REWARD_VISITS} visitas`,
      appliesTo: 'Servicio',
      eligibleCategories: ['Cortes'],
      discountType: 'fixed',
      discountValue: loyaltyCutValue,
      isOptional: true,
      isLoyaltyReward: true,
    };
  }, [billingClient, billItems, projectedVisitCount]);

  const catalog = useMemo(
    () => (services || []).filter((service) => (
      !isPromotionService(service)
      && (activeCategory === 'Todos' || service.category === activeCategory)
      && service.name.toLowerCase().includes(search.toLowerCase())
    )),
    [services, activeCategory, search],
  );

  const availablePromotions = useMemo(() => {
    const manualPromotions = getApplicablePromotions(services, billItems, 'Servicio');
    return loyaltyPromotion ? [loyaltyPromotion, ...manualPromotions] : manualPromotions;
  }, [services, billItems, loyaltyPromotion]);

  const selectedPromotion = useMemo(
    () => availablePromotions.find((promotion) => String(promotion.id) === String(selectedPromotionId)) || null,
    [availablePromotions, selectedPromotionId],
  );

  const subtotal = billItems.reduce((acc, item) => acc + Number(item.price || 0), 0);
  const promotionPreview = useMemo(
    () => calculatePromotionDiscount(selectedPromotion, billItems),
    [selectedPromotion, billItems],
  );
  const promotionDiscount = promotionPreview.amount;
  const total = Math.max(subtotal - promotionDiscount, 0);

  const addToBill = (item) => {
    setBillItems((current) => [...current, { ...item, uniqueId: makeId() }]);
  };

  const removeFromBill = (uniqueId) => {
    setBillItems((current) => current.filter((item) => item.uniqueId !== uniqueId));
  };

  const confirmFinalCharge = () => {
    if (billItems.length === 0) return;

    const serviceNames = billItems.map((item) => item.name).join(' + ');
    onConfirm({
      serviceName: serviceNames,
      price: total,
      rating,
      grossAmount: subtotal,
      promotionName: selectedPromotion?.name || '',
      discountAmount: promotionDiscount,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-in fade-in text-white no-print">
      <div className="relative bg-slate-950 w-full max-w-6xl rounded-[2.4rem] shadow-2xl border border-slate-800 animate-in zoom-in h-[92vh] md:h-[88vh] flex flex-col text-white overflow-hidden">
        <div className="p-5 md:px-7 md:py-5 border-b border-slate-900 flex justify-between items-center bg-black">
          <div>
            <h3 className="text-xl md:text-2xl font-black uppercase italic text-white leading-none">Pantalla de Cobro y Cierre</h3>
            <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-[0.16em] md:tracking-widest mt-2 leading-none">Finaliza el servicio y procesa el pago</p>
          </div>
          <button
            onClick={() => {
              setPromotionPickerOpen(false);
              onClose();
            }}
            className="p-3 bg-slate-900 rounded-2xl text-slate-500 hover:text-rose-500 transition-all"
          >
            <X size={22} />
          </button>
        </div>

        <div className="md:hidden flex-1 overflow-y-auto custom-scrollbar bg-slate-950">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-[1.4rem] border border-slate-800 bg-black p-1.5">
              <button
                type="button"
                onClick={() => setMobilePanel('services')}
                className={`px-3 py-2.5 rounded-xl text-[9px] font-black uppercase italic tracking-[0.14em] transition-all ${mobilePanel === 'services' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                Servicios
              </button>
              <button
                type="button"
                onClick={() => setMobilePanel('catalog')}
                className={`px-3 py-2.5 rounded-xl text-[9px] font-black uppercase italic tracking-[0.14em] transition-all ${mobilePanel === 'catalog' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                Catálogo
              </button>
              <button
                type="button"
                onClick={() => setMobilePanel('promos')}
                className={`px-3 py-2.5 rounded-xl text-[9px] font-black uppercase italic tracking-[0.14em] transition-all ${mobilePanel === 'promos' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}
              >
                Promos
              </button>
            </div>

            {mobilePanel === 'services' && (
              <div className="rounded-[1.6rem] border border-slate-800 bg-black/35 p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400">Servicios realizados</p>
                {billItems.length === 0 ? (
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Aún no has agregado servicios</p>
                ) : (
                  billItems.map((item) => (
                    <div key={item.uniqueId} className="rounded-2xl border border-white/5 bg-slate-900 p-3.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-black uppercase italic text-white">{item.name}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">C$ {item.price}</p>
                      </div>
                      <button onClick={() => removeFromBill(item.uniqueId)} className="shrink-0 p-2 text-slate-600 hover:text-rose-500 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {mobilePanel === 'catalog' && (
              <div className="rounded-[1.6rem] border border-slate-800 bg-black/35 p-4 space-y-3">
                <div className="flex gap-2 p-1 bg-black border border-slate-800 rounded-xl overflow-x-auto no-scrollbar">
                  {['Todos', ...CATEGORIES.filter((category) => category !== 'Promocion')].map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase italic tracking-[0.14em] whitespace-nowrap transition-all ${activeCategory === category ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                    >
                      {category === 'Todos' ? category : (CATEGORY_LABELS[category] || category)}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                  <input
                    type="text"
                    placeholder="Buscar ítem..."
                    className="w-full bg-black border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-[10px] font-black uppercase text-white outline-none focus:border-indigo-600 italic"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {catalog.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addToBill(item)}
                      className="rounded-[1.2rem] border border-slate-800 bg-slate-900/60 p-3 text-left hover:border-emerald-500 transition-all"
                    >
                      <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-500">{item.category}</p>
                      <p className="mt-1.5 text-[12px] font-black uppercase italic leading-tight text-white">{item.name}</p>
                      <p className="mt-2 text-[11px] font-black italic text-emerald-400">C$ {item.price}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mobilePanel === 'promos' && (
              <div className="rounded-[1.6rem] border border-emerald-500/20 bg-black/35 p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Promoción opcional</p>
                <p className="text-[10px] font-bold text-slate-400">
                  {selectedPromotion
                    ? `Aplicada: ${selectedPromotion.name}`
                    : availablePromotions.length > 0
                      ? 'Selecciona una promoción guardada'
                      : 'No hay promociones aplicables ahora'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPromotionPickerOpen(true)}
                    disabled={availablePromotions.length === 0}
                    className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${availablePromotions.length > 0 ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-500/15' : 'cursor-not-allowed border-slate-800 bg-slate-950 text-slate-500 opacity-70'}`}
                  >
                    Elegir
                    <ChevronDown size={14} className="text-current" />
                  </button>
                  {selectedPromotion ? (
                    <button
                      type="button"
                      onClick={() => setSelectedPromotionId('')}
                      className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-rose-300"
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="hidden md:flex flex-1 flex-col md:flex-row overflow-hidden">
          <div className="w-full md:w-[380px] border-r border-slate-900 flex flex-col bg-black/40">
            <div className="p-5 border-b border-slate-900">
              <h4 className="text-[10px] font-black text-indigo-400 uppercase italic tracking-widest flex items-center gap-2">
                <ShoppingBag size={14} /> Servicios Realizados
              </h4>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
              {billItems.length === 0 ? (
                <div className="min-h-[180px] h-full flex flex-col items-center justify-center text-slate-800 border-2 border-dashed border-slate-900 rounded-[2rem] p-6 text-center">
                  <Package size={30} className="mb-3 opacity-20" />
                  <p className="text-[10px] font-black uppercase italic leading-none">Ningún servicio seleccionado para cobrar</p>
                </div>
              ) : (
                billItems.map((item) => (
                  <div key={item.uniqueId} className="bg-slate-900 p-5 rounded-[1.5rem] flex justify-between items-center border border-white/5 group animate-in slide-in-from-left-4">
                    <div className="min-w-0">
                      <p className="text-xl font-black uppercase italic text-white truncate leading-tight mb-2">{item.name}</p>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none">C$ {item.price}</p>
                    </div>
                    <button onClick={() => removeFromBill(item.uniqueId)} className="p-2 text-slate-600 hover:text-rose-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-5 bg-slate-950 border-t border-slate-900">
              <div className="flex justify-between items-end">
                <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none mb-2">Total a Cobrar</span>
                <span className="text-3xl font-black text-emerald-400 italic tracking-tighter leading-none">C$ {total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-slate-950">
            <div className="p-5 border-b border-slate-900 flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-2 p-1 bg-black border border-slate-800 rounded-2xl overflow-x-auto no-scrollbar">
                {['Todos', ...CATEGORIES.filter((category) => category !== 'Promocion')].map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase italic tracking-widest transition-all ${activeCategory === category ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                  >
                    {category === 'Todos' ? category : (CATEGORY_LABELS[category] || category)}
                  </button>
                ))}
              </div>

              <div className="relative flex-1 max-w-xs">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                <input
                  type="text"
                  placeholder="BUSCAR ÍTEM..."
                  className="w-full bg-black border border-slate-800 rounded-xl pl-4 pr-10 py-3 text-[10px] font-black uppercase text-white outline-none focus:border-indigo-600 italic"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 custom-scrollbar content-start">
              {catalog.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToBill(item)}
                  className="bg-slate-900/50 border border-slate-800 p-5 rounded-[2rem] hover:border-emerald-500 hover:bg-slate-900 transition-all text-left flex flex-col justify-between h-32 group"
                >
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{item.category}</p>
                    <h5 className="text-xl font-black uppercase italic text-white leading-tight group-hover:text-emerald-400 transition-colors">{item.name}</h5>
                  </div>
                  <div className="flex justify-between items-center mt-auto">
                    <span className="text-sm font-black text-emerald-500 italic leading-none">C$ {item.price}</span>
                    <div className="p-2 bg-emerald-600/10 rounded-lg text-emerald-500 opacity-0 transition-opacity group-hover:opacity-100">
                      <Plus size={14} />
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-900 p-5 space-y-3 bg-black/30">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Promoción opcional</p>
                  <p className="mt-2 text-[11px] font-bold text-slate-400">
                    {selectedPromotion
                      ? `Aplicada: ${selectedPromotion.name}`
                      : availablePromotions.length > 0
                        ? 'Selecciona una promoción guardada'
                        : 'No hay promociones aplicables ahora'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPromotionPickerOpen(true)}
                    disabled={availablePromotions.length === 0}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${availablePromotions.length > 0 ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-500/15' : 'cursor-not-allowed border-slate-800 bg-slate-950 text-slate-500 opacity-70'}`}
                  >
                    Elegir
                    <ChevronDown size={14} className="text-current" />
                  </button>
                  {selectedPromotion ? (
                    <button
                      type="button"
                      onClick={() => setSelectedPromotionId('')}
                      className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-300"
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              </div>

              {loyaltyPromotion && billingClient ? (
                <div className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-[11px] font-bold text-amber-100">
                  {billingClient.name} está completando su visita #{projectedVisitCount}. Puedes aplicar el beneficio opcional de corte gratis en este cobro.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="p-2.5 md:p-5 bg-black border-t border-slate-900 flex flex-col md:grid md:grid-cols-[260px_minmax(260px,1fr)_260px] items-stretch gap-2 md:gap-4">
          <div className="w-full bg-slate-950/50 border border-slate-800 px-3 md:px-5 py-2.5 md:py-4 rounded-[1.2rem] md:rounded-[1.6rem] flex flex-col items-center justify-center shrink-0">
            <p className="text-[8px] md:text-[10px] font-black text-amber-500 uppercase italic tracking-[0.14em] md:tracking-[0.2em] mb-1.5 md:mb-3 leading-none">Califica la experiencia</p>
            <div className="flex gap-1.5 md:gap-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`transition-all ${star <= rating ? 'text-amber-500 scale-125 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'text-slate-800 hover:text-slate-600'}`}
                >
                  <Star size={16} className="md:w-8 md:h-8" fill={star <= rating ? 'currentColor' : 'none'} />
                </button>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 md:contents">
            <div className="md:hidden w-full rounded-[1.15rem] border border-slate-800 bg-slate-950/70 px-3 py-2.5 shadow-[0_10px_22px_rgba(0,0,0,0.18)]">
              <p className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-500">Resumen</p>
              <div className="mt-1.5 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Subtotal</span>
                  <span className="text-[15px] font-black italic text-white leading-none">C$ {subtotal.toLocaleString('es-NI')}</span>
                </div>
                {selectedPromotion ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300">Descuento</span>
                    <span className="text-[13px] font-black italic text-emerald-300 leading-none">- C$ {promotionDiscount.toLocaleString('es-NI')}</span>
                  </div>
                ) : null}
              </div>
              <div className="mt-2 border-t border-slate-800 pt-2">
                <div className="flex items-end justify-between gap-3">
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white">Total</span>
                  <span className="whitespace-nowrap text-[22px] font-black italic tracking-tighter leading-none text-emerald-400">
                    C$ {total.toLocaleString('es-NI')}
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden md:block w-full rounded-[1.6rem] border border-slate-800 bg-slate-950/70 px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Resumen de cobro</p>
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Subtotal</span>
                  <span className="text-lg font-black italic text-white">C$ {subtotal.toLocaleString('es-NI')}</span>
                </div>
                {selectedPromotion ? (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">Descuento</p>
                      <p className="mt-1 truncate text-[10px] font-black uppercase italic tracking-[0.12em] text-slate-500">
                        {selectedPromotion.name}
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-black italic text-emerald-300">- C$ {promotionDiscount.toLocaleString('es-NI')}</span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 border-t border-slate-800 pt-3">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-white">Total final</span>
                  <span className="whitespace-nowrap text-[32px] font-black italic tracking-tighter leading-none text-emerald-400">
                    C$ {total.toLocaleString('es-NI')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 md:h-full">
              <button
                disabled={billItems.length === 0}
                onClick={confirmFinalCharge}
                className="w-full flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 md:py-4 rounded-[1.2rem] md:rounded-[1.6rem] font-black uppercase italic text-[10px] md:text-[11px] tracking-[0.1em] md:tracking-[0.14em] disabled:opacity-20 shadow-xl shadow-emerald-950/20 active:scale-95 transition-all flex items-center justify-center gap-2.5 md:gap-3 leading-tight"
              >
                <CheckCircle2 size={18} strokeWidth={3} /> Confirmar cobro
              </button>
              <button onClick={onClose} className="hidden md:block w-full rounded-[1.3rem] border border-slate-800 bg-slate-950/70 px-5 py-3 text-[10px] font-black uppercase text-slate-500 hover:text-white hover:border-slate-600 italic transition-colors leading-none">Cerrar</button>
            </div>
          </div>
        </div>

        {promotionPickerOpen ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-[2.5rem] border border-emerald-500/20 bg-slate-950 shadow-[0_30px_120px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-6 py-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Promociones</p>
                  <p className="mt-2 text-[11px] font-bold text-slate-400">Elige un descuento para este cobro</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPromotionPickerOpen(false)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-black text-slate-400 transition-colors hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[60vh] space-y-3 overflow-y-auto p-6 custom-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPromotionId('');
                    setPromotionPickerOpen(false);
                  }}
                  className={`w-full rounded-[1.5rem] border px-5 py-4 text-left transition-all ${selectedPromotionId ? 'border-slate-800 bg-slate-900 hover:border-slate-700' : 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.18)]'}`}
                >
                  <p className="text-sm font-black uppercase italic text-white">Sin promoción</p>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Cobrar precio completo</p>
                </button>

                {availablePromotions.length > 0 ? (
                  availablePromotions.map((promotion) => (
                    <button
                      key={promotion.id}
                      type="button"
                      onClick={() => {
                        setSelectedPromotionId(String(promotion.id));
                        setPromotionPickerOpen(false);
                      }}
                      className={`w-full rounded-[1.5rem] border px-5 py-4 text-left transition-all ${selectedPromotion?.id === promotion.id ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.18)]' : 'border-slate-800 bg-slate-900 hover:border-emerald-500/40'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black uppercase italic text-white">{promotion.name}</p>
                          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {promotion.isLoyaltyReward
                              ? `beneficio por fidelización · visita ${projectedVisitCount}`
                              : `${formatPromotionValue(promotion)} · descuento sobre el cobro`}
                          </p>
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-[12px] font-black italic leading-none text-emerald-300 md:text-sm">
                          - C${calculatePromotionDiscount(promotion, billItems).amount.toLocaleString('es-NI')}
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-800 bg-slate-950/60 px-5 py-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    No hay promociones aplicables para este cobro.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
