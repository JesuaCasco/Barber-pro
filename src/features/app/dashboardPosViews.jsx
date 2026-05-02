import React, { memo, useDeferredValue, useMemo, useState } from 'react';
import {
  Activity,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Plus,
  Repeat,
  Search,
  ShoppingBag,
  Sparkles,
  UserCheck,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';

import {
  calculatePromotionDiscount,
  formatPromotionValue,
  getTodayString,
  isPromotionService,
  standardizeDate,
} from './shared';
import { DelayTimer, ServiceTimer, WaitTimer } from './sharedComponents';

const ProductCard = memo(function ProductCard({ service, onAdd }) {
  return (
    <button onClick={() => onAdd(service)} className="bg-slate-900 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-800 hover:border-indigo-600 hover:bg-slate-800 transition-all text-left shadow-xl active:scale-95 group flex flex-col justify-between min-h-[138px] md:min-h-[180px] text-white">
      <div><p className="text-[8px] font-black text-indigo-400 uppercase mb-2 tracking-widest leading-none italic">{service.category}</p><h5 className="text-[13px] md:text-sm font-black uppercase italic mb-4 text-white group-hover:text-indigo-400 transition-colors leading-tight">{service.name}</h5></div>
      <div className="flex items-center justify-between mt-auto text-white"><p className="text-lg md:text-xl font-black text-emerald-400 italic leading-none">C$ {service.price}</p><div className="p-2 bg-indigo-600/20 rounded-xl text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg text-white"><Plus size={16} /></div></div>
    </button>
  );
});

const CartLine = memo(function CartLine({ item, onRemove }) {
  return (
    <div className="bg-slate-900 p-5 rounded-[1.5rem] flex justify-between items-center border border-white/5 animate-in slide-in-from-right-4 group text-white">
      <div className="min-w-0 text-white"><p className="text-[10px] font-black uppercase italic text-white truncate pr-2 leading-none mb-1">{item.name}</p><p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">{item.qty} unidad{item.qty > 1 ? 'es' : ''} @ C$ {item.price}</p></div>
      <div className="flex items-center gap-4 text-white"><p className="text-sm font-black italic text-emerald-400 leading-none">C$ {item.price * item.qty}</p><button onClick={() => onRemove(item.id)} className="p-2 text-slate-600 hover:text-rose-500 transition-colors text-white"><X size={14} /></button></div>
    </div>
  );
});

export function DashboardView({ appointments, clients, onUpdate, onTransfer, barbers, onNewWalkin, posSales = [] }) {
  const [activeBarber, setActiveBarber] = useState('Global');
  const today = getTodayString();

  const normalizeApt = (appointment) => ({
    ...appointment,
    type: appointment.type || 'reserva',
    status: appointment.status || 'Confirmada',
    durationMinutes: Number(appointment.durationMinutes) > 0 ? Number(appointment.durationMinutes) : 30,
  });

  const todayApts = useMemo(() => (
    (appointments || []).map(normalizeApt).filter((appointment) => standardizeDate(appointment.date) === today)
  ), [appointments, today]);

  const recentActivity = useMemo(() => (
    [...appointments].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt)).slice(0, 6)
  ), [appointments]);

  const pendingApts = todayApts.filter((appointment) => appointment.status !== 'Finalizada' && appointment.status !== 'Cita Perdida');
  const waitCount = todayApts.filter((appointment) => appointment.status === 'En Espera' || (appointment.type === 'walkin' && appointment.status === 'Confirmada')).length;
  const plannedCount = todayApts.filter((appointment) => appointment.type === 'reserva' && appointment.status === 'Confirmada').length;
  const finishedCount = todayApts.filter((appointment) => appointment.status === 'Finalizada').length;
  const totalTodayCount = todayApts.length;
  const todayRevenue = todayApts
    .filter((appointment) => appointment.status === 'Finalizada')
    .reduce((sum, appointment) => sum + (Number(appointment.price) || 0), 0);
  const todayProductRevenue = (posSales || [])
    .filter((sale) => standardizeDate(sale.createdAt) === today)
    .reduce((sum, sale) => sum + (Number(sale.productTotal) || 0), 0);
  const busyBarbers = new Set(todayApts.filter((appointment) => appointment.status === 'En Corte').map((appointment) => String(appointment.barberId))).size;
  const totalBarbers = (barbers || []).length;

  const toMinutes = (time = '00:00') => {
    if (!time || typeof time !== 'string') return 0;
    const [hours, minutes] = time.split(':').map((value) => Number(value));
    return hours * 60 + minutes;
  };

  const sortedDisplayApts = useMemo(() => {
    const base = activeBarber === 'Global'
      ? pendingApts
      : pendingApts.filter((appointment) => String(appointment.barberId) === String(activeBarber));

    return [...base].sort((left, right) => {
      if (left.status === 'En Corte' && right.status !== 'En Corte') return -1;
      if (left.status !== 'En Corte' && right.status === 'En Corte') return 1;
      return (toMinutes(left.time) || 0) - (toMinutes(right.time) || 0);
    });
  }, [activeBarber, pendingApts]);

  const getTypeLabel = (appointment) => {
    if (appointment.status === 'En Corte') return 'En servicio';
    if (appointment.status === 'En Espera') return 'En sala';
    if (appointment.type === 'walkin') return 'Sin reserva';
    return 'Reserva';
  };

  const getTypeColor = (appointment) => {
    if (appointment.status === 'En Corte') return 'bg-emerald-600 border-emerald-400';
    if (appointment.status === 'En Espera') return 'bg-indigo-500 border-indigo-400';
    if (appointment.type === 'walkin') return 'bg-amber-500 border-amber-400';
    return 'bg-slate-700 border-slate-500';
  };

  return (
    <div className="dashboard-view p-4 md:p-8 space-y-6 md:space-y-10 animate-in fade-in pb-20 no-print">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h3 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter text-white leading-none">Tablero de Control</h3>
          <p className="mobile-simplify-subtitle text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2 italic flex items-center gap-2">
            <Sparkles size={12} className="text-indigo-400" /> Resumen Operativo - {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex w-full md:w-auto items-center gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-2xl">
          <div className="px-3 border-r border-slate-800">
            <p className="text-[9px] font-black text-slate-500 uppercase leading-none mb-1">Barberos</p>
            <p className="text-[11px] font-black uppercase text-emerald-400 italic leading-none">{busyBarbers} Ocupados / {totalBarbers || 0}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4 md:gap-6">
        <div className="bg-slate-900 neon-border-indigo p-6 rounded-[2rem] text-white flex flex-col justify-center">
          <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest italic leading-none mb-3">Reservaciones</p>
          <h4 className="text-4xl font-black italic tracking-tighter text-indigo-400">{plannedCount}</h4>
        </div>
        <div className="bg-slate-900 neon-border-amber p-6 rounded-[2rem] text-white flex flex-col justify-center">
          <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest italic leading-none mb-3">En Espera</p>
          <h4 className="text-4xl font-black italic tracking-tighter text-amber-400">{waitCount}</h4>
        </div>
        <div className="bg-slate-900 neon-border-emerald p-6 rounded-[2rem] text-white flex flex-col justify-center">
          <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest italic leading-none mb-3">Finalizadas</p>
          <h4 className="text-4xl font-black italic tracking-tighter text-emerald-400">{finishedCount}</h4>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] text-white flex flex-col justify-center">
          <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest italic leading-none mb-3">Total Turnos</p>
          <h4 className="text-4xl font-black italic tracking-tighter text-slate-200">{totalTodayCount}</h4>
        </div>
        <div className="bg-indigo-600 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-500 text-white flex flex-col justify-center">
          <DollarSign className="absolute -right-2 -bottom-2 w-20 h-20 text-white/10 rotate-12" />
          <p className="text-[9px] font-black uppercase text-indigo-100 tracking-widest italic leading-none mb-3 relative z-10">Ingresos Cortes Hoy</p>
          <h4 className="text-3xl font-black italic tracking-tighter relative z-10">C$ {(Number(todayRevenue) || 0).toLocaleString()}</h4>
        </div>
        <div className="bg-emerald-600 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-500 text-white flex flex-col justify-center">
          <ShoppingBag className="absolute -right-2 -bottom-2 w-20 h-20 text-white/10 rotate-12" />
          <p className="text-[9px] font-black uppercase text-emerald-100 tracking-widest italic leading-none mb-3 relative z-10">Ventas Productos Hoy</p>
          <h4 className="text-3xl font-black italic tracking-tighter relative z-10">C$ {(Number(todayProductRevenue) || 0).toLocaleString()}</h4>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 md:gap-8">
        <div className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-[3rem] p-4 md:p-8 space-y-6 md:space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <h3 className="text-2xl md:text-4xl font-black uppercase italic tracking-tighter text-white">Turnos del día</h3>
            <button onClick={() => onNewWalkin(activeBarber !== 'Global' ? activeBarber : (barbers[0]?.id || ''))} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-[0.2em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3">
              <UserPlus size={18} /> Nuevo turno sin cita
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-3 p-3 md:p-4 bg-black/40 border border-white/5 rounded-[2.5rem] w-full max-w-5xl mx-auto shadow-inner">
            <button onClick={() => setActiveBarber('Global')} className={`px-6 py-3 md:px-8 md:py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.22em] italic transition-all duration-300 ${activeBarber === 'Global' ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.5)] scale-105' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}>Vista Global</button>
            {(barbers || []).map((barber) => {
              const isActive = String(activeBarber) === String(barber.id);
              const barberActiveBg = barber.bg || 'bg-indigo-600';
              const barberBorder = barber.color || 'border-indigo-500';
              return (
                <button key={barber.id} onClick={() => setActiveBarber(String(barber.id))} className={`group px-5 py-3 md:px-6 md:py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest italic transition-all duration-500 flex items-center gap-3 border ${isActive ? `${barberActiveBg} text-white shadow-[0_0_25px] scale-105 ${barberBorder}` : 'bg-slate-900/50 text-slate-500 border-white/5 hover:text-white hover:scale-105'}`}>
                  <div className={`w-6 h-6 rounded-lg ${isActive ? 'bg-white/20' : barber.bg} flex items-center justify-center text-[8px] text-white shadow-inner`}>{barber.avatar}</div>
                  {barber.name}
                </button>
              );
            })}
          </div>

          <div className="space-y-4 pt-4">
            {sortedDisplayApts.length === 0 ? (
              <div className="bg-slate-950/50 border border-dashed border-slate-800 p-20 rounded-[3rem] text-slate-700 text-center flex flex-col items-center gap-6 animate-pulse">
                <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center border border-slate-800"><Clock size={32} /></div>
                <p className="font-black uppercase italic text-xs tracking-[0.5em]">No hay turnos activos en esta vista</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 max-w-5xl mx-auto">
                {sortedDisplayApts.map((appointment, index) => {
                  const client = clients.find((item) => item.id === appointment.clientId);
                  const barber = (barbers || []).find((item) => String(item.id) === String(appointment.barberId));
                  const inService = appointment.status === 'En Corte';
                  const hasArrived = !!appointment.checkInAt;
                  const isWalkin = appointment.type === 'walkin';

                  return (
                    <div key={appointment.id} className={`bg-slate-950 border ${inService ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)] scale-[1.01] z-10' : (appointment.status === 'En Espera' ? 'border-indigo-500/50' : 'border-slate-800')} rounded-[2.5rem] p-4 md:p-6 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 md:gap-6 transition-all group relative overflow-hidden`}>
                      <div className="flex items-center gap-4 md:gap-6 min-w-0">
                        <div className="relative">
                          <div className={`w-16 h-16 rounded-[1.5rem] ${barber?.bg || 'bg-slate-800'} flex items-center justify-center font-black italic text-xl text-white shadow-2xl relative z-10 border-2 border-white/10 group-hover:scale-110 transition-transform`}>{barber?.avatar || '?'}</div>
                          {inService && <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-slate-950 animate-ping z-20"></div>}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-3">
                            <h4 className="text-lg md:text-xl font-black uppercase italic text-white tracking-tighter leading-none group-hover:text-indigo-400 transition-colors truncate">
                              {index + 1}-{client?.name || 'Cliente desconocido'}
                            </h4>
                            {inService && <span className="animate-pulse flex items-center gap-1 text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 italic">EN PROCESO</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-2 min-w-0">
                            <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${getTypeColor(appointment)} text-white`}>{getTypeLabel(appointment)}</span>
                            <span className="text-[10px] text-slate-600 font-black uppercase italic tracking-widest leading-none truncate">- {barber?.name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6 w-full md:w-auto md:justify-end">
                        <div className="flex flex-wrap gap-2 md:justify-end">
                          {appointment.type === 'reserva' && !hasArrived && <DelayTimer reservationTime={appointment.time} />}
                          {hasArrived && <WaitTimer checkInAt={appointment.checkInAt} startedAt={appointment.startedAt} />}
                          {inService && appointment.startedAt && <ServiceTimer startedAt={appointment.startedAt} />}
                        </div>
                        <div className="flex items-end justify-between md:justify-end md:flex-col md:items-end gap-1 md:min-w-[80px]">
                          <span className="text-[9px] font-black text-slate-600 uppercase italic tracking-[0.2em] leading-none">Hora inicio</span>
                          <span className="text-lg font-black text-white italic leading-none">{appointment.time || '--:--'}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:justify-end">
                          {appointment.status !== 'Finalizada' && appointment.status !== 'Cita Perdida' && (
                            <button onClick={() => onTransfer?.(appointment)} className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-4 md:px-5 py-3 md:py-5 rounded-2xl font-black uppercase italic text-[10px] tracking-widest border border-slate-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                              <Repeat size={15} /> Trasladar
                            </button>
                          )}
                          {appointment.type === 'reserva' && !hasArrived && <button onClick={() => onUpdate(appointment.id, 'En Espera')} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 md:px-6 py-3 md:py-5 rounded-2xl font-black uppercase italic text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"><UserCheck size={16} /> Llegó</button>}
                          {(hasArrived || isWalkin) && (
                            <button onClick={() => onUpdate(appointment.id, inService ? 'Finalizada' : 'En Corte')} className={`w-full sm:w-auto px-4 md:px-8 py-3 md:py-5 rounded-2xl text-[10px] font-black uppercase italic tracking-[0.2em] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 ${inService ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'}`}>
                              {inService ? <CheckCircle2 size={16} strokeWidth={3} /> : <Zap size={16} fill="white" />}
                              {inService ? 'Finalizar' : 'Iniciar'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-[3rem] p-4 md:p-8 flex flex-col shadow-2xl relative overflow-hidden h-full no-print">
          <div className="flex items-center justify-between mb-8">
            <h4 className="text-xl font-black italic uppercase text-white flex items-center gap-3"><Activity size={20} className="text-indigo-500" /> Actividad Reciente</h4>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2">
            {recentActivity.map((activity) => {
              const activityClient = clients.find((item) => item.id === activity.clientId);
              return (
                <div key={activity.id} className="bg-black/50 border border-white/5 p-4 rounded-2xl flex items-center gap-4 group text-white">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black italic border border-white/10 ${activity.status === 'Finalizada' ? 'bg-emerald-500/20 text-emerald-400' : (activity.status === 'En Corte' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400')}`}>{activityClient?.name?.[0] || '?'}</div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black uppercase text-white truncate leading-none">{activityClient?.name || 'Desconocido'}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase mt-1 leading-none">{activity.status} - {activity.service || 'Servicio'}</p>
                  </div>
                  <span className="text-[8px] font-black text-slate-600 uppercase italic whitespace-nowrap">{new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function POSView({ services, onSale }) {
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPromotionId, setSelectedPromotionId] = useState('');
  const [promotionPickerOpen, setPromotionPickerOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const normalizedSearch = deferredSearch.trim().toLowerCase();

  const filtered = useMemo(() => (
    (services || []).filter((service) => (
      service.category === 'Producto'
      && service.name.toLowerCase().includes(normalizedSearch)
    ))
  ), [services, normalizedSearch]);

  const savedPromotions = useMemo(
    () => (services || [])
      .filter((service) => isPromotionService(service))
      .sort((left, right) => {
        const leftWeight = (left.appliesTo || 'Servicio') === 'Producto' ? 0 : 1;
        const rightWeight = (right.appliesTo || 'Servicio') === 'Producto' ? 0 : 1;
        if (leftWeight !== rightWeight) return leftWeight - rightWeight;
        return `${left.name || ''}`.localeCompare(`${right.name || ''}`, 'es');
      }),
    [services],
  );

  const selectedPromotion = useMemo(
    () => savedPromotions.find((promotion) => String(promotion.id) === String(selectedPromotionId)) || null,
    [savedPromotions, selectedPromotionId],
  );

  const promotionPreview = useMemo(
    () => calculatePromotionDiscount(selectedPromotion, cart),
    [selectedPromotion, cart],
  );

  const promotionDiscount = promotionPreview.amount;
  const totalToCharge = Math.max(subtotal - promotionDiscount, 0);
  const applicablePromotionIds = useMemo(
    () => new Set(
      savedPromotions
        .filter((promotion) => calculatePromotionDiscount(promotion, cart).amount > 0)
        .map((promotion) => String(promotion.id)),
    ),
    [savedPromotions, cart],
  );


  const addItem = (item) => {
    setCart((prev) => {
      const current = prev.find((entry) => entry.id === item.id);
      if (current) {
        return prev.map((entry) => entry.id === item.id ? { ...entry, qty: entry.qty + 1 } : entry);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const removeItem = (id) => setCart((prev) => prev.filter((item) => item.id !== id));

  const handleCompleteSale = async () => {
    const result = await onSale({
      items: cart,
      rawSubtotal: subtotal,
      discountTotal: promotionDiscount,
      subtotal: totalToCharge,
      promotion: selectedPromotion ? { id: selectedPromotion.id, name: selectedPromotion.name } : null,
    });

    if (result) {
      setCart([]);
      setSelectedPromotionId('');
      setPromotionPickerOpen(false);
      setTicketOpen(false);
    }
  };

  return (
    <div className="pos-view relative h-full flex flex-col text-white animate-in fade-in no-print">
      <div className="flex-1 flex flex-col min-w-0 text-white">
        <div className="p-4 md:p-8 space-y-4 md:space-y-6 border-b border-slate-900 bg-black text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-white">
            <div className="px-5 py-4 rounded-[2rem] bg-slate-900 border border-slate-800">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] italic text-emerald-400 leading-none">Catálogo de productos</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative text-white">
                <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="text" placeholder="Buscar producto" className="bg-black border border-slate-800 rounded-2xl pl-8 pr-16 py-4 text-sm font-black w-full md:w-80 outline-none focus:border-indigo-600 transition-all text-white italic placeholder:text-slate-600 shadow-inner" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <button
                type="button"
                onClick={() => setTicketOpen(true)}
                disabled={cart.length === 0}
                className={`hidden md:flex items-center gap-3 rounded-[1.6rem] border px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${cart.length > 0 ? 'border-indigo-500/30 bg-indigo-600/15 text-indigo-200 hover:border-indigo-400 hover:bg-indigo-600/25' : 'border-slate-800 bg-slate-950 text-slate-500 cursor-not-allowed opacity-70'}`}
              >
                <ShoppingBag size={16} />
                {cart.length > 0 ? `Carrito (${cart.length})` : 'Carrito vacío'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 p-3 md:p-8 overflow-y-auto grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-6 content-start custom-scrollbar text-white">
          {filtered.map((service) => (
            <ProductCard key={service.id} service={service} onAdd={addItem} />
          ))}
        </div>
      </div>

      {cart.length > 0 ? (
        <button
          type="button"
          onClick={() => setTicketOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-4 rounded-[1.8rem] border border-indigo-400/30 bg-black/90 px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-md md:hidden"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/35">
            <ShoppingBag size={18} />
          </div>
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Carrito</p>
            <p className="mt-1 text-sm font-black italic text-white">{cart.length} ítem{cart.length > 1 ? 's' : ''} | C$ {totalToCharge.toLocaleString('es-NI')}</p>
          </div>
        </button>
      ) : null}

      {ticketOpen && cart.length > 0 ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm xl:items-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2.6rem] border border-slate-800 bg-black text-white shadow-[0_30px_120px_rgba(0,0,0,0.65)] xl:max-w-4xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-900 px-6 py-5 md:px-8 md:py-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/40">
                  <ShoppingBag size={22} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Ticket de venta</h3>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Aplica promociones guardadas antes de completar la venta</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPromotionPickerOpen(false);
                  setTicketOpen(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 text-slate-400 transition-colors hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="max-h-[70vh] overflow-y-auto border-b border-slate-900 p-5 md:p-6 xl:border-b-0 xl:border-r custom-scrollbar">
                <div className="space-y-4">
                  {cart.map((item) => (
                    <CartLine key={item.id} item={item} onRemove={removeItem} />
                  ))}
                </div>
              </div>

              <div className="bg-slate-950 p-5 md:p-6">
                <div className="mb-6 rounded-[1.8rem] border border-emerald-500/20 bg-black/40 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Promociones</p>
                      <p className="mt-2 truncate text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        {selectedPromotion
                          ? `Aplicada: ${selectedPromotion.name}`
                          : savedPromotions.length > 0
                            ? 'Sin promoción aplicada'
                            : 'No hay promociones guardadas'}
                      </p>
                    </div>
                    {selectedPromotion ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-300">
                        Activa
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPromotionPickerOpen(true)}
                      disabled={savedPromotions.length === 0}
                      className={`inline-flex items-center gap-2 rounded-[1.1rem] border px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${savedPromotions.length > 0 ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-500/15' : 'cursor-not-allowed border-slate-800 bg-slate-900 text-slate-500 opacity-70'}`}
                    >
                      Elegir promoción
                      <ChevronDown size={16} className="text-current" />
                    </button>

                    {selectedPromotion ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPromotionId('')}
                        className="rounded-[1.1rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-rose-300 transition-all hover:border-rose-400/30"
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>

                  {selectedPromotion && !applicablePromotionIds.has(String(selectedPromotion.id)) ? (
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                      La promoción elegida no descuenta este ticket.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-3 mb-8 text-white">
                  <div className="flex justify-between items-center text-white"><span className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none">Subtotal</span><span className="text-base font-black italic text-white">C$ {subtotal.toLocaleString('es-NI')}</span></div>
                  {selectedPromotion ? <div className="flex justify-between items-center text-white"><span className="text-emerald-300 text-[10px] font-black uppercase tracking-widest leading-none">{selectedPromotion.name}</span><span className="text-base font-black italic text-emerald-300">- C$ {promotionDiscount.toLocaleString('es-NI')}</span></div> : null}
                  <div className="flex justify-between items-center text-white"><span className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none">Monto Total</span><span className="text-4xl font-black italic tracking-tighter leading-none text-white shadow-[0_0_15px_rgba(99,102,241,0.2)]">C$ {totalToCharge.toLocaleString('es-NI')}</span></div>
                </div>

                <button disabled={cart.length === 0} onClick={handleCompleteSale} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 py-6 rounded-[2rem] font-black uppercase italic text-xs shadow-xl active:scale-95 transition-all text-white flex items-center justify-center gap-3"><Check size={18} strokeWidth={3} /> COMPLETAR VENTA</button>
              </div>
            </div>
          </div>

          {promotionPickerOpen ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md overflow-hidden rounded-[2.2rem] border border-emerald-500/20 bg-slate-950 text-white shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Promociones</p>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      Elige una promoción para este ticket
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPromotionPickerOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-black text-slate-400 transition-colors hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="max-h-[60vh] space-y-3 overflow-y-auto p-5 custom-scrollbar">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPromotionId('');
                      setPromotionPickerOpen(false);
                    }}
                    className={`w-full rounded-[1.2rem] border px-4 py-4 text-left transition-all ${selectedPromotionId ? 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700' : 'border-emerald-400/40 bg-emerald-500/10 text-white shadow-[0_0_20px_rgba(16,185,129,0.12)]'}`}
                  >
                    <p className="text-[11px] font-black uppercase italic">Sin promoción</p>
                    <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                      Cobrar precio completo
                    </p>
                  </button>

                  {savedPromotions.map((promotion) => {
                    const applies = applicablePromotionIds.has(String(promotion.id));
                    const isSelected = String(selectedPromotionId) === String(promotion.id);
                    return (
                      <button
                        key={promotion.id}
                        type="button"
                        onClick={() => {
                          setSelectedPromotionId(String(promotion.id));
                          setPromotionPickerOpen(false);
                        }}
                        className={`w-full rounded-[1.2rem] border px-4 py-4 text-left transition-all ${isSelected ? 'border-emerald-400/40 bg-emerald-500/10 text-white shadow-[0_0_20px_rgba(16,185,129,0.12)]' : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700'} ${!applies ? 'opacity-75' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-black uppercase italic text-white">{promotion.name}</p>
                            <p className="mt-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                              {formatPromotionValue(promotion)} | General
                            </p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] ${applies ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-400/20 bg-amber-500/10 text-amber-300'}`}>
                            {applies ? 'Aplicable' : 'Revisar'}
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {savedPromotions.length === 0 ? (
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      No hay promociones guardadas todavía.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
