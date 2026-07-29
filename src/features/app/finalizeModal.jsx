import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  CreditCard,
  DollarSign,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Star,
  Wallet,
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

const DEFAULT_EXCHANGE_RATE = 36.7;
const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

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
  const [desktopStep, setDesktopStep] = useState('services');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashPaymentCurrency, setCashPaymentCurrency] = useState('NIO');
  const [saleExchangeRate, setSaleExchangeRate] = useState(String(DEFAULT_EXCHANGE_RATE));
  const [nioReceived, setNioReceived] = useState('');
  const [usdReceived, setUsdReceived] = useState('');

  const billingClient = useMemo(
    () => (clients || []).find((client) => String(client.id) === String(initial?.clientId || initial?.client?.id || '')) || null,
    [clients, initial],
  );
  const isStandardClient = String(billingClient?.name || '').trim().toLowerCase() === 'cliente estándar';
  const completedVisits = Number(billingClient?.completedVisits || 0);
  const projectedVisitCount = completedVisits + (initial?.status === 'Finalizada' ? 0 : 1);

  const loyaltyPromotion = useMemo(() => {
    if (isStandardClient || !billingClient || projectedVisitCount <= 0 || projectedVisitCount % LOYALTY_REWARD_VISITS !== 0) return null;

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
  }, [billingClient, billItems, isStandardClient, projectedVisitCount]);

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
  const activeSaleExchangeRate = Math.max(Number(saleExchangeRate || 0), 0);
  const nioReceivedAmount = Math.max(Number(nioReceived || 0), 0);
  const nioChangeNio = Math.max(roundMoney(nioReceivedAmount - total), 0);
  const nioPaymentIsEnough = cashPaymentCurrency !== 'NIO' || nioReceivedAmount + 0.01 >= total;
  const usdReceivedAmount = Math.max(Number(usdReceived || 0), 0);
  const usdReceivedEquivalent = roundMoney(usdReceivedAmount * activeSaleExchangeRate);
  const usdChangeNio = Math.max(roundMoney(usdReceivedEquivalent - total), 0);
  const usdPaymentIsEnough = cashPaymentCurrency !== 'USD' || usdReceivedEquivalent + 0.01 >= total;
  const cashPaymentIsEnough = paymentMethod !== 'cash' || (cashPaymentCurrency === 'USD' ? usdPaymentIsEnough : nioPaymentIsEnough);

  const addToBill = (item) => {
    setBillItems((current) => [...current, { ...item, uniqueId: makeId() }]);
  };

  const removeFromBill = (uniqueId) => {
    setBillItems((current) => current.filter((item) => item.uniqueId !== uniqueId));
  };

  const goToDesktopCheckout = () => {
    if (billItems.length === 0) return;
    setDesktopStep('checkout');
  };

  const confirmFinalCharge = () => {
    if (billItems.length === 0) return;
    if (paymentMethod === 'cash' && !cashPaymentIsEnough) return;

    const serviceNames = billItems.map((item) => item.name).join(' + ');
    const paymentMeta = paymentMethod === 'cash'
      ? (cashPaymentCurrency === 'USD' ? {
          currency: 'USD',
          receivedUsd: usdReceivedAmount,
          exchangeRate: activeSaleExchangeRate,
          receivedEquivalentNio: usdReceivedEquivalent,
          changeNio: usdChangeNio,
        } : {
          currency: 'NIO',
          receivedNio: nioReceivedAmount,
          changeNio: nioChangeNio,
        })
      : { currency: 'NIO' };

    onConfirm({
      serviceName: serviceNames,
      items: billItems.map((item) => ({
        id: item.id,
        serviceId: item.serviceId || item.id || null,
        inventoryItemId: item.inventoryItemId || null,
        inventoryUsage: Array.isArray(item.inventoryUsage) ? item.inventoryUsage : [],
        name: item.name,
        category: item.category,
        price: Number(item.price || 0),
        qty: Number(item.qty || 1) || 1,
      })),
      price: total,
      rating,
      grossAmount: subtotal,
      promotionName: selectedPromotion?.name || '',
      discountAmount: promotionDiscount,
      paymentMethod,
      notes: JSON.stringify({ paymentMeta }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-in fade-in text-white no-print">
      <div className="relative bg-slate-950 w-full max-w-[96rem] rounded-[2.4rem] shadow-2xl border border-slate-800 animate-in zoom-in h-[94vh] md:h-[96vh] flex flex-col text-white overflow-hidden">
        <div className="p-5 md:px-7 md:py-4 border-b border-slate-900 flex justify-between items-center bg-black">
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
                <div className="grid min-h-[188px] grid-cols-2 content-start gap-2.5">
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

        <div className="hidden md:flex flex-1 min-h-0 flex-col md:flex-row overflow-hidden">
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

          <div className="flex-1 flex flex-col bg-slate-950 min-h-0">
            <div className="p-4 border-b border-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
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

            <div className="min-h-[160px] flex-[1_1_auto] p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5 custom-scrollbar content-start">
              {catalog.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToBill(item)}
                  className="bg-slate-900/50 border border-slate-800 px-4 py-3 rounded-[1.35rem] hover:border-emerald-500 hover:bg-slate-900 transition-all text-left flex flex-col justify-between min-h-[88px] group"
                >
                  <div>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">{item.category}</p>
                    <h5 className="text-sm font-black uppercase italic text-white leading-tight group-hover:text-emerald-400 transition-colors line-clamp-2">{item.name}</h5>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-sm font-black text-emerald-500 italic leading-none">C$ {item.price}</span>
                    <div className="p-2 bg-emerald-600/10 rounded-lg text-emerald-500 opacity-0 transition-opacity group-hover:opacity-100">
                      <Plus size={14} />
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-900 px-5 py-3 bg-black/30 shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Promoción opcional</p>
                  <p className="mt-1.5 truncate text-[10px] font-bold text-slate-400 leading-none">
                    {selectedPromotion
                      ? `Aplicada: ${selectedPromotion.name}`
                      : availablePromotions.length > 0
                        ? 'Selecciona una promoción guardada'
                        : billItems.length === 0
                          ? 'Agrega un servicio para ver promociones disponibles'
                          : 'No hay promociones aplicables ahora'}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPromotionPickerOpen(true)}
                    disabled={availablePromotions.length === 0}
                    className={`inline-flex min-w-[118px] items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[9px] font-black uppercase tracking-widest transition-all ${availablePromotions.length > 0 ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-500/15' : 'cursor-not-allowed border-slate-800 bg-slate-950 text-slate-500 opacity-70'}`}
                  >
                    Elegir
                    <ChevronDown size={14} className="text-current" />
                  </button>
                  {selectedPromotion ? (
                    <button
                      type="button"
                      onClick={() => setSelectedPromotionId('')}
                      className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-rose-300"
                    >
                      Quitar
                    </button>
                  ) : null}
                </div>
              </div>

              {loyaltyPromotion && billingClient ? (
                <div className="mt-2 rounded-[1rem] border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-bold text-amber-100">
                  {billingClient.name} está completando su visita #{projectedVisitCount}. Puedes aplicar el beneficio opcional de corte gratis en este cobro.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {desktopStep === 'services' ? (
          <div className="p-2.5 md:p-4 bg-black border-t border-slate-900 flex flex-col md:grid md:grid-cols-[240px_minmax(260px,1fr)_240px] items-stretch gap-2 md:gap-3 shrink-0">
            <div className="w-full bg-slate-950/50 border border-slate-800 px-3 md:px-4 py-2.5 md:py-3 rounded-[1.2rem] md:rounded-[1.35rem] flex flex-col items-center justify-center shrink-0">
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

            <div className="w-full rounded-[1.35rem] border border-slate-800 bg-slate-950/70 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Total seleccionado</p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">{billItems.length} ítem{billItems.length === 1 ? '' : 's'}</span>
                <span className="whitespace-nowrap text-[28px] font-black italic tracking-tighter leading-none text-emerald-400">
                  C$ {total.toLocaleString('es-NI')}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={billItems.length === 0}
              onClick={goToDesktopCheckout}
              className="w-full rounded-[1.2rem] bg-emerald-600 px-5 py-3.5 text-[10px] font-black uppercase italic tracking-[0.12em] text-white shadow-xl shadow-emerald-950/20 transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600"
            >
              Continuar al cobro
            </button>
          </div>
        ) : (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm md:p-6">
            <div className="grid max-h-[90vh] w-[min(96vw,82rem)] grid-cols-1 items-stretch gap-4 overflow-y-auto custom-scrollbar md:grid-cols-[minmax(280px,0.72fr)_minmax(540px,1.28fr)]">
              <div className="order-2 rounded-[1.5rem] border border-slate-800 bg-slate-950/70 px-5 py-5 flex flex-col items-center justify-center md:order-2">
                <p className="text-[11px] font-black text-amber-500 uppercase italic tracking-[0.2em] mb-5 leading-none">Califica la experiencia</p>
                <div className="flex gap-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      className={`transition-all ${star <= rating ? 'text-amber-500 scale-125 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'text-slate-800 hover:text-slate-600'}`}
                    >
                      <Star size={32} fill={star <= rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="order-1 rounded-[1.5rem] border border-slate-800 bg-slate-950/70 px-6 py-5 md:order-1">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Resumen de cobro</p>
                <div className="mt-5 space-y-4">
                  <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <span className="text-[12px] font-black uppercase tracking-[0.18em] text-slate-400">Subtotal</span>
                    <span className="text-xl font-black italic text-white">C$ {subtotal.toLocaleString('es-NI')}</span>
                  </div>
                  {selectedPromotion ? (
                    <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">Descuento</p>
                        <p className="mt-1 truncate text-[10px] font-black uppercase italic tracking-[0.12em] text-slate-500">{selectedPromotion.name}</p>
                      </div>
                      <span className="shrink-0 text-base font-black italic text-emerald-300">- C$ {promotionDiscount.toLocaleString('es-NI')}</span>
                    </div>
                  ) : null}
                  <div className="flex items-end justify-between gap-4 pt-3">
                    <span className="text-[12px] font-black uppercase tracking-[0.22em] text-white">Total final</span>
                    <span className="whitespace-nowrap text-[42px] font-black italic tracking-tighter leading-none text-emerald-400">
                      C$ {total.toLocaleString('es-NI')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="order-3 flex w-full flex-col gap-4 rounded-[1.8rem] border border-cyan-300/25 bg-slate-950 px-6 py-6 shadow-[0_24px_70px_rgba(34,211,238,0.08)] md:order-3 md:col-start-2 md:row-span-2 md:row-start-1">
                <div className="flex flex-col gap-2 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-300">Procesar pago</p>
                    <h4 className="mt-2 text-2xl font-black uppercase italic leading-none text-white">Método y recibido</h4>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Total a pagar</p>
                    <p className="mt-1 text-[34px] font-black italic leading-none text-emerald-400">C$ {total.toLocaleString('es-NI')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'cash', label: 'Efectivo', icon: DollarSign },
                    { id: 'card', label: 'Tarjeta', icon: CreditCard },
                    { id: 'transfer', label: 'Transfer', icon: Wallet },
                  ].map((method) => {
                    const Icon = method.icon;
                    const active = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        className={`flex min-h-[5.25rem] flex-col items-center justify-center gap-2 rounded-[1.25rem] border px-3 py-4 text-[9px] font-black uppercase tracking-[0.08em] transition-all ${active ? 'border-emerald-400 bg-emerald-600 text-white shadow-[0_16px_34px_rgba(16,185,129,0.2)]' : 'border-slate-800 bg-black text-slate-500 hover:border-cyan-300/40 hover:text-white'}`}
                      >
                        <Icon size={18} />
                        {method.label}
                      </button>
                    );
                  })}
                </div>

                <div className="min-h-[16rem]">
                  {paymentMethod === 'cash' ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setCashPaymentCurrency('NIO')} className={`rounded-[1.2rem] border px-5 py-4 text-[10px] font-black uppercase tracking-[0.1em] transition-all ${cashPaymentCurrency === 'NIO' ? 'border-emerald-400 bg-emerald-600 text-white' : 'border-slate-800 bg-black text-slate-500 hover:text-white'}`}>Paga C$</button>
                        <button type="button" onClick={() => setCashPaymentCurrency('USD')} className={`rounded-[1.2rem] border px-5 py-4 text-[10px] font-black uppercase tracking-[0.1em] transition-all ${cashPaymentCurrency === 'USD' ? 'border-emerald-400 bg-emerald-600 text-white' : 'border-slate-800 bg-black text-slate-500 hover:text-white'}`}>Paga US$</button>
                      </div>

                      {cashPaymentCurrency === 'NIO' ? (
                        <div className="mt-4 grid grid-cols-1 gap-4">
                          <input type="number" min="0" step="0.01" value={nioReceived} onChange={(event) => setNioReceived(event.target.value)} placeholder="C$ recibido" className="rounded-[1.25rem] border border-slate-800 bg-black px-5 py-5 text-xl font-black text-white outline-none focus:border-emerald-500" />
                          <div className={`rounded-[1.35rem] border px-6 py-5 ${nioPaymentIsEnough ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/35 bg-rose-500/10 text-rose-100'}`}>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Cliente paga</span>
                              <span className="text-xl font-black italic text-white">C$ {nioReceivedAmount.toLocaleString('es-NI')}</span>
                            </div>
                            <div className="mt-4 border-t border-white/10 pt-4">
                              <p className="text-[11px] font-black uppercase tracking-[0.18em]">{nioPaymentIsEnough ? 'Vuelto a entregar' : 'Monto pendiente'}</p>
                              <p className={`mt-2 text-[34px] font-black italic leading-none tracking-tight ${nioPaymentIsEnough ? 'text-emerald-300' : 'text-rose-300'}`}>
                                C$ {(nioPaymentIsEnough ? nioChangeNio : Math.max(total - nioReceivedAmount, 0)).toLocaleString('es-NI')}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {cashPaymentCurrency === 'USD' ? (
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          <input type="number" min="0" step="0.01" value={usdReceived} onChange={(event) => setUsdReceived(event.target.value)} placeholder="US$ recibido" className="rounded-[1.25rem] border border-slate-800 bg-black px-5 py-5 text-xl font-black text-white outline-none focus:border-emerald-500" />
                          <input type="number" min="0" step="0.01" value={saleExchangeRate} onChange={(event) => setSaleExchangeRate(event.target.value)} placeholder="Tasa" className="rounded-[1.25rem] border border-slate-800 bg-black px-5 py-5 text-xl font-black text-white outline-none focus:border-emerald-500" />
                          <div className={`col-span-2 rounded-[1.35rem] border px-6 py-5 ${usdPaymentIsEnough ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/35 bg-rose-500/10 text-rose-100'}`}>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Equivalente</span>
                              <span className="text-xl font-black italic text-white">C$ {usdReceivedEquivalent.toLocaleString('es-NI')}</span>
                            </div>
                            <div className="mt-4 border-t border-white/10 pt-4">
                              <p className="text-[11px] font-black uppercase tracking-[0.18em]">{usdPaymentIsEnough ? 'Vuelto a entregar' : 'Monto pendiente'}</p>
                              <p className={`mt-2 text-[34px] font-black italic leading-none tracking-tight ${usdPaymentIsEnough ? 'text-emerald-300' : 'text-rose-300'}`}>
                                {usdPaymentIsEnough ? `C$ ${usdChangeNio.toLocaleString('es-NI')}` : 'No cubre el total'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex min-h-[15.5rem] flex-col items-center justify-center rounded-[1.4rem] border border-cyan-300/25 bg-cyan-300/5 px-6 text-center">
                      <p className="text-[12px] font-black uppercase tracking-[0.14em] text-cyan-200">
                        {paymentMethod === 'card' ? 'Pago con tarjeta' : 'Pago por transferencia'}
                      </p>
                      <p className="mt-3 text-lg font-black italic text-emerald-300">Sin cálculo de vuelto</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <button
                    disabled={billItems.length === 0 || !cashPaymentIsEnough}
                    onClick={confirmFinalCharge}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-5 rounded-[1.35rem] font-black uppercase italic text-[12px] tracking-[0.12em] disabled:opacity-20 shadow-xl shadow-emerald-950/20 active:scale-95 transition-all flex items-center justify-center gap-3 leading-tight"
                  >
                    <CheckCircle2 size={20} strokeWidth={3} /> Confirmar cobro
                  </button>
                  <button onClick={() => setDesktopStep('services')} className="w-full rounded-[1.35rem] border border-slate-800 bg-black px-5 py-4 text-[10px] font-black uppercase text-slate-500 hover:text-white hover:border-slate-600 italic transition-colors leading-none">Volver</button>
                </div>
              </div>
            </div>
          </div>
        )}

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
