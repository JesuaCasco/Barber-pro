import React, { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  Loader2,
  Plus,
  ListChecks,
  ReceiptText,
  RotateCcw,
  Save,
  Search,
  ShoppingBag,
  Sparkles,
  UserCheck,
  UserPlus,
  Wallet,
  X,
  Zap,
} from 'lucide-react';

import {
  calculatePromotionDiscount,
  formatPromotionValue,
  getPhoneDigits,
  getTodayString,
  isPromotionService,
  standardizeDate,
} from './shared';
import { DelayTimer, ServiceTimer, WaitTimer } from './sharedComponents';

const GENERIC_CLIENT_NAME = 'Cliente generico';
const isWebAppointment = (appointment) => appointment?.source === 'web' || Boolean(appointment?.needsClientConfirmation || appointment?.guestName || appointment?.guestPhone);
const getAppointmentDisplayClientName = (appointment, client = null) => {
  if (client?.name) return client.name;
  if (isWebAppointment(appointment) && appointment?.guestName) return appointment.guestName;
  return appointment?.clientName || GENERIC_CLIENT_NAME;
};
const getAppointmentClientMetaLabel = (appointment) => {
  if (!isWebAppointment(appointment)) return '';
  return appointment?.claimsExistingClient ? 'WEB - dice ser cliente' : 'WEB - cliente por confirmar';
};
const ProductCard = memo(function ProductCard({ service, onAdd }) {
  const categoryTheme = {
    Producto: {
      border: 'border-cyan-400/25 hover:border-cyan-300/70',
      bg: 'from-cyan-500/18 via-slate-900 to-slate-950',
      accent: 'text-cyan-300',
      chip: 'bg-cyan-400/12 border-cyan-300/25 text-cyan-200',
      button: 'bg-cyan-500 text-white shadow-cyan-500/25 group-hover:bg-cyan-400',
    },
    Cortes: {
      border: 'border-indigo-400/25 hover:border-indigo-300/70',
      bg: 'from-indigo-500/18 via-slate-900 to-slate-950',
      accent: 'text-indigo-300',
      chip: 'bg-indigo-400/12 border-indigo-300/25 text-indigo-200',
      button: 'bg-indigo-600 text-white shadow-indigo-500/25 group-hover:bg-indigo-500',
    },
    Barba: {
      border: 'border-amber-400/25 hover:border-amber-300/70',
      bg: 'from-amber-500/18 via-slate-900 to-slate-950',
      accent: 'text-amber-300',
      chip: 'bg-amber-400/12 border-amber-300/25 text-amber-200',
      button: 'bg-amber-500 text-white shadow-amber-500/25 group-hover:bg-amber-400',
    },
    Combo: {
      border: 'border-fuchsia-400/25 hover:border-fuchsia-300/70',
      bg: 'from-fuchsia-500/18 via-slate-900 to-slate-950',
      accent: 'text-fuchsia-300',
      chip: 'bg-fuchsia-400/12 border-fuchsia-300/25 text-fuchsia-200',
      button: 'bg-fuchsia-600 text-white shadow-fuchsia-500/25 group-hover:bg-fuchsia-500',
    },
  };
  const theme = categoryTheme[service.category] || categoryTheme.Producto;

  return (
    <button
      onClick={() => onAdd(service)}
      className={`group relative min-h-[156px] md:min-h-[210px] overflow-hidden rounded-[1.5rem] md:rounded-[2.2rem] border ${theme.border} bg-gradient-to-br ${theme.bg} p-4 md:p-5 text-left text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl active:scale-95`}
    >
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-[2rem] border border-white/10 bg-white/[0.03] rotate-12 transition-transform duration-500 group-hover:rotate-45 group-hover:scale-110" />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <span className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.2em] italic ${theme.chip}`}>
            {service.category}
          </span>
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/35 ${theme.accent} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
            <ShoppingBag size={17} />
          </div>
        </div>

        <div className="mt-5 flex-1">
          <h5 className="line-clamp-2 text-base md:text-lg font-black uppercase italic leading-tight tracking-tight text-white transition-colors duration-300 group-hover:text-white">
            {service.name}
          </h5>
          <p className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 transition-colors group-hover:text-slate-300">
            Disponible para venta rápida
          </p>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.22em] text-slate-500">Precio</p>
            <p className="mt-1 text-2xl md:text-3xl font-black italic leading-none text-emerald-300">C$ {Number(service.price || 0).toLocaleString('es-NI')}</p>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition-all duration-300 ${theme.button} group-hover:scale-110`}>
            <Plus size={20} strokeWidth={3} />
          </div>
        </div>
      </div>
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

function DenominationGrid({ title, currency, denominations, values, onChange, compact = false }) {
  return (
    <div className={`${compact ? 'rounded-[1.25rem] p-2.5' : 'rounded-[1.6rem] p-4'} border border-slate-700 bg-slate-950/80`}>
      <div className={`${compact ? 'mb-1.5' : 'mb-3'} flex items-center justify-between gap-3`}>
        <p className={`${compact ? 'text-[8px]' : 'text-[10px]'} font-black uppercase tracking-[0.18em] text-cyan-300`}>{title}</p>
        <span className={`${compact ? 'px-2 py-0.5 text-[8px]' : 'px-3 py-1 text-[9px]'} rounded-full border border-cyan-400/25 bg-cyan-400/10 font-black uppercase tracking-[0.14em] text-cyan-200`}>{currency}</span>
      </div>
      <div className={`grid ${compact ? 'grid-cols-1 gap-1.5' : 'grid-cols-2 gap-2 sm:grid-cols-3'}`}>
        {denominations.map((denomination) => (
          <label key={`${currency}-${denomination}`} className={`${compact ? 'rounded-xl px-2 py-1' : 'rounded-2xl px-3 py-2'} grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border border-slate-700 bg-slate-900/80`}>
            <span className={`${compact ? 'text-[13.5px]' : 'text-[11px]'} font-black italic text-slate-100`}>{currency} {denomination}</span>
            <input
              type="number"
              min="0"
              step="1"
              value={values[denomination] || ''}
              onChange={(event) => onChange(denomination, event.target.value)}
              className={`${compact ? 'rounded-lg px-1.5 py-0.5 text-sm' : 'rounded-xl px-2 py-2 text-sm'} min-w-0 border border-slate-600 bg-slate-950 text-center font-black text-white outline-none placeholder:text-slate-600 focus:border-indigo-400`}
              placeholder="0"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function DashboardView({ appointments, clients, onUpdate, onOpenAppointment, barbers, onNewWalkin, onQuickAppointment, onCashWithdrawal, posSales = [] }) {
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

  const pendingApts = todayApts.filter((appointment) => appointment.status !== 'Finalizada' && appointment.status !== 'Cita Perdida' && appointment.status !== 'Cancelada');
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
        <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto md:items-center">
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2.5 rounded-2xl">
          <div className="px-3 border-r border-slate-800">
            <p className="text-[9px] font-black text-slate-500 uppercase leading-none mb-1">Barberos</p>
            <p className="text-[11px] font-black uppercase text-emerald-400 italic leading-none">{busyBarbers} Ocupados / {totalBarbers || 0}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onCashWithdrawal?.(activeBarber !== 'Global' ? activeBarber : '')}
          className="flex items-center justify-center gap-2 rounded-2xl border border-indigo-400/25 bg-indigo-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-indigo-200 transition-all hover:border-indigo-300 hover:bg-indigo-500/15 active:scale-95"
        >
          <Wallet size={15} /> Adelanto
        </button>
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
            <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
              <button onClick={() => onQuickAppointment?.(activeBarber !== 'Global' ? activeBarber : (barbers[0]?.id || ''))} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-[0.2em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3">
                <Zap size={18} /> Agendar rápido
              </button>
              <button onClick={() => onNewWalkin(activeBarber !== 'Global' ? activeBarber : (barbers[0]?.id || ''))} className="w-full md:w-auto bg-slate-800 hover:bg-slate-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-[0.2em] transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3">
                <UserPlus size={18} /> Turno completo
              </button>
            </div>
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
                    <div key={appointment.id} onClick={() => onOpenAppointment?.(appointment)} className={`bg-slate-950 border ${inService ? 'border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.2)] scale-[1.01] z-10' : (appointment.status === 'En Espera' ? 'border-indigo-500/50' : 'border-slate-800')} rounded-[2rem] px-4 py-4 md:px-6 md:py-4 grid grid-cols-1 md:grid-cols-[minmax(340px,1fr)_minmax(128px,auto)_74px_150px] items-center gap-4 md:gap-5 transition-all group relative overflow-hidden cursor-pointer hover:border-indigo-500/40`}>
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div className="relative">
                          <div className={`w-14 h-14 rounded-[1.25rem] ${barber?.bg || 'bg-slate-800'} flex items-center justify-center font-black italic text-base text-white shadow-2xl relative z-10 border-2 border-white/10 group-hover:scale-105 transition-transform`}>{barber?.avatar || '?'}</div>
                          {inService && <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-slate-950 animate-ping z-20"></div>}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center">
                          <div className="min-w-0">
                            <p className="text-[16px] font-black uppercase italic text-white tracking-normal leading-tight group-hover:text-indigo-400 transition-colors whitespace-nowrap">
                              {index + 1}-{getAppointmentDisplayClientName(appointment, client)}
                            </p>
                          </div>
                          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
                            <span className={`shrink-0 px-3 py-1 text-[8px] font-black uppercase tracking-widest rounded-full border ${isWebAppointment(appointment) ? 'bg-cyan-500 border-cyan-300' : getTypeColor(appointment)} text-white`}>{getAppointmentClientMetaLabel(appointment) || getTypeLabel(appointment)}</span>
                            <span className="min-w-0 text-[9px] text-slate-500 font-black uppercase italic tracking-widest leading-tight break-words">- {barber?.name || 'Sin barbero'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 md:justify-end">
                          {appointment.type === 'reserva' && !hasArrived && <DelayTimer reservationTime={appointment.time} />}
                          {hasArrived && <WaitTimer checkInAt={appointment.checkInAt} startedAt={appointment.startedAt} />}
                          {inService && appointment.startedAt && <ServiceTimer startedAt={appointment.startedAt} />}
                      </div>
                      <div className="flex items-end justify-between gap-1 md:min-w-[74px] md:flex-col md:items-end md:justify-center">
                          <span className="text-[8px] font-black text-slate-600 uppercase italic tracking-[0.18em] leading-none">Hora inicio</span>
                          <span className="text-base font-black text-white italic leading-none">{appointment.time || '--:--'}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto md:justify-end">
                          {appointment.type === 'reserva' && !hasArrived && <button onClick={(event) => { event.stopPropagation(); onUpdate(appointment.id, 'En Espera'); }} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 md:px-6 py-3 md:py-5 rounded-2xl font-black uppercase italic text-[10px] tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"><UserCheck size={16} /> Llegó</button>}
                          {(hasArrived || isWalkin) && (
                            <button onClick={(event) => { event.stopPropagation(); onUpdate(appointment.id, inService ? 'Finalizada' : 'En Corte'); }} className={`w-full sm:w-auto px-4 md:px-7 py-3.5 rounded-2xl text-[10px] font-black uppercase italic tracking-[0.18em] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 ${inService ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'}`}>
                              {inService ? <CheckCircle2 size={16} strokeWidth={3} /> : <Zap size={16} fill="white" />}
                              {inService ? 'Finalizar' : 'Iniciar'}
                            </button>
                          )}
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
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black italic border border-white/10 ${activity.status === 'Finalizada' ? 'bg-emerald-500/20 text-emerald-400' : (activity.status === 'En Corte' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400')}`}>{getAppointmentDisplayClientName(activity, activityClient)?.[0] || '?'}</div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-black uppercase text-white truncate leading-none">{getAppointmentDisplayClientName(activity, activityClient)}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase mt-1 leading-none">{getAppointmentClientMetaLabel(activity) || activity.status} - {activity.service || 'Servicio'}</p>
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

const TEXT_REPAIR_REPLACEMENTS = [
  [/\u00c3\u00a1/g, '\u00e1'], [/\u00c3\u00a9/g, '\u00e9'], [/\u00c3\u00ad/g, '\u00ed'], [/\u00c3\u00b3/g, '\u00f3'], [/\u00c3\u00ba/g, '\u00fa'],
  [/\u00c3\u00b1/g, '\u00f1'], [/\u00c3\u00bc/g, '\u00fc'],
  [/\u00c3\u0081/g, '\u00c1'], [/\u00c3\u0089/g, '\u00c9'], [/\u00c3\u008d/g, '\u00cd'], [/\u00c3\u0093/g, '\u00d3'], [/\u00c3\u009a/g, '\u00da'],
  [/\u00c3\u0091/g, '\u00d1'], [/\u00c3\u009c/g, '\u00dc'],
  [/\u00c2\u00bf/g, '\u00bf'], [/\u00c2\u00a1/g, '\u00a1'], [/\u00c2\u00b7/g, '\u00b7'],
];

const repairDisplayText = (value = '') => {
  let text = `${value ?? ''}`;
  TEXT_REPAIR_REPLACEMENTS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  return text
    .replace(/anulaci[?\uFFFD]n/gi, (match) => (match === match.toUpperCase() ? 'ANULACI\u00d3N' : 'Anulaci\u00f3n'))
    .replace(/promoci[?\uFFFD]n/gi, (match) => (match === match.toUpperCase() ? 'PROMOCI\u00d3N' : 'Promoci\u00f3n'))
    .replace(/n[?\uFFFD]mina/gi, (match) => (match === match.toUpperCase() ? 'N\u00d3MINA' : 'n\u00f3mina'))
    .replace(/auditor[?\uFFFD]a/gi, (match) => (match === match.toUpperCase() ? 'AUDITOR\u00cdA' : 'auditor\u00eda'))
    .replace(/(Ã­tems|ÃƒÂ­tems|[?\uFFFD]tems)/gi, (match) => (match === match.toUpperCase() ? '\u00cdTEMS' : '\u00edtems'))
    .replace(/u[?\uFFFD]as/gi, (match) => (match === match.toUpperCase() ? 'U\u00d1AS' : 'u\u00f1as'))
    .replace(/dise[?\uFFFD]o/gi, (match) => (match === match.toUpperCase() ? 'DISE\u00d1O' : 'dise\u00f1o'));
};

const summarizeMovementItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return 'Sin detalle guardado';
  return items
    .map((item) => `${repairDisplayText(item.name || 'Item')} x${Number(item.qty || 1)}`)
    .join(' \u00b7 ');
};

const SERVICE_INCOME_LABELS = {
  Cortes: 'Servicio de corte',
  Tratamientos: 'Tratamiento',
  Facial: 'Servicio facial',
  Uñas: 'Servicio de uñas',
  Combo: 'Combo de servicios',
  Promociones: 'Promoción',
  Servicio: 'Servicio',
};

const NIO_BILL_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10];
const NIO_COIN_DENOMINATIONS = [10, 5, 1];
const USD_BILL_DENOMINATIONS = [100, 50, 20, 10, 5, 1];
const DEFAULT_EXCHANGE_RATE = 36.7;

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const parseJsonNote = (value) => {
  if (!value || typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const getNoteLabel = (value, fallback = '') => {
  const parsed = parseJsonNote(value);
  return repairDisplayText(parsed?.label || parsed?.source || fallback || value || '');
};

const getUniqueLabels = (values = []) => [...new Set(values.filter(Boolean).map(repairDisplayText))];

const getSaleIncomeType = (sale) => {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const categories = getUniqueLabels(items.map((item) => item.category || 'Servicio'));
  const hasProducts = categories.includes('Producto') || Number(sale.productTotal || 0) > 0;
  const serviceCategories = categories.filter((category) => category !== 'Producto');
  const hasServices = serviceCategories.length > 0 || Number(sale.serviceTotal || 0) > 0;

  if (hasProducts && hasServices) return 'Venta mixta';
  if (hasProducts) return 'Venta de producto';
  if (serviceCategories.length === 1) return SERVICE_INCOME_LABELS[serviceCategories[0]] || 'Servicio';
  if (serviceCategories.length > 1) return 'Servicios varios';
  return 'Ingreso por servicio';
};

const getSaleClientLabel = (sale) => sale.clientName || getUniqueLabels((sale.items || []).map((item) => item.clientName))[0] || '-';

const getSaleBarberLabel = (sale) => {
  const barberNames = getUniqueLabels((sale.items || []).map((item) => item.barberName));
  return barberNames.length ? barberNames.join(', ') : '-';
};

const getMovementTicketNumber = (movement) => {
  const match = `${movement.notes || ''}`.match(/(?:POS\s*)?#(\d+)/i);
  return match ? Number(match[1]) : 0;
};

const formatTicketNumber = (ticketNumber) => (
  Number(ticketNumber || 0) > 0 ? String(Number(ticketNumber)).padStart(6, '0') : ''
);

const summarizeSaleMovementSource = (sale) => {
  return summarizeMovementItems(sale.items);
};

export function POSView({
  services,
  clients = [],
  onSale,
  cashSession = null,
  cashMovements = [],
  posSales = [],
  cashSessions = [],
  allCashMovements = [],
  allPosSales = [],
  onOpenCashSession,
  onCloseCashSession,
  onPrintCashClosure,
  onCashMovement,
  onCancelSale,
  onCancelCashMovement,
  confirmAction,
  users = [],
}) {
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPromotionId, setSelectedPromotionId] = useState('');
  const [promotionPickerOpen, setPromotionPickerOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [closingModalOpen, setClosingModalOpen] = useState(false);
  const [movementsModalOpen, setMovementsModalOpen] = useState(false);
  const [movementsSummaryCollapsed, setMovementsSummaryCollapsed] = useState(false);
  const [cashHistoryOpen, setCashHistoryOpen] = useState(false);
  const [cashHistorySummaryCollapsed, setCashHistorySummaryCollapsed] = useState(false);
  const [movementSearch, setMovementSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [genericClientSale, setGenericClientSale] = useState(false);
  const [openingModalSuppressed, setOpeningModalSuppressed] = useState(false);
  const [openingBusy, setOpeningBusy] = useState(false);
  const [openingFeedback, setOpeningFeedback] = useState('');
  const [openingBreakdown, setOpeningBreakdown] = useState({
    nioBills: {},
    nioCoins: {},
    usdBills: {},
  });
  const [closingBreakdown, setClosingBreakdown] = useState({
    nioBills: {},
    nioCoins: {},
    usdBills: {},
  });
  const [openingExchangeRate, setOpeningExchangeRate] = useState('36.7');
  const [closingExchangeRate, setClosingExchangeRate] = useState('36.7');
  const [closingCardAmount, setClosingCardAmount] = useState('');
  const [closingTransferAmount, setClosingTransferAmount] = useState('');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [movementType, setMovementType] = useState('in');
  const [movementCurrency, setMovementCurrency] = useState('NIO');
  const [movementExchangeRate, setMovementExchangeRate] = useState(String(DEFAULT_EXCHANGE_RATE));
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [cashPaymentCurrency, setCashPaymentCurrency] = useState('NIO');
  const [saleExchangeRate, setSaleExchangeRate] = useState(String(DEFAULT_EXCHANGE_RATE));
  const [nioReceived, setNioReceived] = useState('');
  const [usdReceived, setUsdReceived] = useState('');
  const deferredSearch = useDeferredValue(search);
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const normalizedMovementSearch = movementSearch.trim().toLowerCase();
  const formatCurrency = (value) => `C$ ${(Number(value) || 0).toLocaleString('es-NI')}`;
  const sumDenominations = (denominations, values) =>
    denominations.reduce((sum, denomination) => sum + (Number(values[denomination] || 0) * denomination), 0);
  const openingTotals = useMemo(() => {
    const nioBillsTotal = sumDenominations(NIO_BILL_DENOMINATIONS, openingBreakdown.nioBills);
    const nioCoinsTotal = sumDenominations(NIO_COIN_DENOMINATIONS, openingBreakdown.nioCoins);
    const usdTotal = sumDenominations(USD_BILL_DENOMINATIONS, openingBreakdown.usdBills);
    const exchangeRate = Math.max(Number(openingExchangeRate || 0), 0);

    return {
      nioBillsTotal,
      nioCoinsTotal,
      nioTotal: nioBillsTotal + nioCoinsTotal,
      usdTotal,
      exchangeRate,
      convertedUsdTotal: usdTotal * exchangeRate,
      total: nioBillsTotal + nioCoinsTotal + (usdTotal * exchangeRate),
    };
  }, [openingBreakdown, openingExchangeRate]);
  const closingTotals = useMemo(() => {
    const nioBillsTotal = sumDenominations(NIO_BILL_DENOMINATIONS, closingBreakdown.nioBills);
    const nioCoinsTotal = sumDenominations(NIO_COIN_DENOMINATIONS, closingBreakdown.nioCoins);
    const usdTotal = sumDenominations(USD_BILL_DENOMINATIONS, closingBreakdown.usdBills);
    const exchangeRate = Math.max(Number(closingExchangeRate || 0), 0);

    return {
      nioBillsTotal,
      nioCoinsTotal,
      nioTotal: nioBillsTotal + nioCoinsTotal,
      usdTotal,
      exchangeRate,
      convertedUsdTotal: usdTotal * exchangeRate,
      total: nioBillsTotal + nioCoinsTotal + (usdTotal * exchangeRate),
    };
  }, [closingBreakdown, closingExchangeRate]);
  const cashSummary = useMemo(() => {
    const base = {
      expectedCash: 0,
      opening: 0,
      sales: 0,
      manualIn: 0,
      manualOut: 0,
      saleCount: 0,
    };

    return (cashMovements || []).reduce((summary, movement) => {
      if ((movement.paymentMethod || 'cash') !== 'cash') return summary;
      const amount = Number(movement.amount || 0);
      if (movement.movementKind === 'opening') summary.opening += amount;
      if (movement.movementKind === 'sale') {
        summary.sales += movement.type === 'out' ? -amount : amount;
        summary.saleCount += 1;
      }
      if (movement.movementKind === 'manual' && movement.type === 'in') summary.manualIn += amount;
      if (movement.movementKind === 'manual' && movement.type === 'out') summary.manualOut += amount;
      summary.expectedCash += movement.type === 'out' ? -amount : amount;
      return summary;
    }, base);
  }, [cashMovements]);
  const systemPaymentSummary = useMemo(() => (
    (posSales || []).reduce((summary, sale) => {
      const method = sale.paymentMethod || 'cash';
      const amount = Number(sale.subtotal || 0);
      if (method === 'card') summary.card += amount;
      if (method === 'transfer') summary.transfer += amount;
      if (method === 'mixed' || method === 'other') summary.other += amount;
      return summary;
    }, { card: 0, transfer: 0, other: 0 })
  ), [posSales]);
  const cashCurrencySummary = useMemo(() => {
    const summary = {
      expectedNio: 0,
      expectedUsd: 0,
      openingNio: 0,
      openingUsd: 0,
      salesNio: 0,
      salesUsd: 0,
      changeNio: 0,
      manualInNio: 0,
      manualOutNio: 0,
      manualInUsd: 0,
      manualOutUsd: 0,
      exchangeRate: Number(closingExchangeRate || openingExchangeRate || DEFAULT_EXCHANGE_RATE) || DEFAULT_EXCHANGE_RATE,
    };

    (cashMovements || []).forEach((movement) => {
      if ((movement.paymentMethod || 'cash') !== 'cash') return;
      if (movement.movementKind === 'sale') return;

      const parsed = parseJsonNote(movement.notes);
      const amount = Number(movement.amount || 0);

      if (movement.movementKind === 'opening') {
        const nioTotal = Number(parsed?.nioTotal ?? amount);
        const usdTotal = Number(parsed?.usdTotal ?? 0);
        summary.openingNio += nioTotal;
        summary.openingUsd += usdTotal;
        summary.expectedNio += nioTotal;
        summary.expectedUsd += usdTotal;
        if (parsed?.exchangeRate) summary.exchangeRate = Number(parsed.exchangeRate) || summary.exchangeRate;
        return;
      }

      const direction = movement.type === 'out' ? -1 : 1;
      const currency = parsed?.currency === 'USD' ? 'USD' : 'NIO';
      const originalAmount = Number(parsed?.amountOriginal ?? (currency === 'USD' ? 0 : amount));

      if (currency === 'USD') {
        summary.expectedUsd += direction * originalAmount;
        if (movement.type === 'out') summary.manualOutUsd += originalAmount;
        else summary.manualInUsd += originalAmount;
        if (parsed?.exchangeRate) summary.exchangeRate = Number(parsed.exchangeRate) || summary.exchangeRate;
        return;
      }

      summary.expectedNio += direction * amount;
      if (movement.type === 'out') summary.manualOutNio += amount;
      else summary.manualInNio += amount;
    });

    (posSales || []).forEach((sale) => {
      if ((sale.paymentMethod || 'cash') !== 'cash') return;
      const parsed = parseJsonNote(sale.notes);
      const paymentMeta = parsed?.paymentMeta;
      const saleAmount = Number(sale.subtotal || 0);

      if (paymentMeta?.currency === 'USD') {
        const receivedUsd = Number(paymentMeta.receivedUsd || 0);
        const changeNio = Number(paymentMeta.changeNio || 0);
        summary.expectedUsd += receivedUsd;
        summary.expectedNio -= changeNio;
        summary.salesUsd += receivedUsd;
        summary.changeNio += changeNio;
        if (paymentMeta.exchangeRate) summary.exchangeRate = Number(paymentMeta.exchangeRate) || summary.exchangeRate;
        return;
      }

      summary.expectedNio += saleAmount;
      summary.salesNio += saleAmount;
    });

    summary.expectedNio = roundMoney(summary.expectedNio);
    summary.expectedUsd = roundMoney(summary.expectedUsd);
    summary.expectedEquivalent = roundMoney(summary.expectedNio + (summary.expectedUsd * summary.exchangeRate));
    return summary;
  }, [cashMovements, closingExchangeRate, openingExchangeRate, posSales]);
  const totalSalesSummary = cashSummary.sales + systemPaymentSummary.card + systemPaymentSummary.transfer + systemPaymentSummary.other;
  const closingCardCounted = Number(closingCardAmount || 0);
  const closingTransferCounted = Number(closingTransferAmount || 0);
  const closingDifferences = {
    cash: closingTotals.total - cashCurrencySummary.expectedEquivalent,
    nio: closingTotals.nioTotal - cashCurrencySummary.expectedNio,
    usd: closingTotals.usdTotal - cashCurrencySummary.expectedUsd,
    card: closingCardCounted - systemPaymentSummary.card,
    transfer: closingTransferCounted - systemPaymentSummary.transfer,
  };
  const isBalancedClose = Math.abs(closingDifferences.nio) < 0.01
    && Math.abs(closingDifferences.usd) < 0.01
    && Math.abs(closingDifferences.card) < 0.01
    && Math.abs(closingDifferences.transfer) < 0.01;
  const shouldShowOpeningModal = !cashSession && !openingModalSuppressed;

  const filtered = useMemo(() => (
    (services || []).filter((service) => (
      service.category === 'Producto'
      && service.name.toLowerCase().includes(normalizedSearch)
    ))
  ), [services, normalizedSearch]);
  const selectedClient = useMemo(
    () => (clients || []).find((client) => String(client.id) === String(selectedClientId || '')) || null,
    [clients, selectedClientId],
  );
  const filteredTicketClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    const phoneQuery = getPhoneDigits(clientSearch);
    if (!query && !phoneQuery) return (clients || []).slice(0, 6);
    return (clients || [])
      .filter((client) => {
        const name = `${client.name || ''}`.toLowerCase();
        const phone = getPhoneDigits(client.phone || '');
        return name.includes(query) || (phoneQuery && phone.includes(phoneQuery));
      })
      .slice(0, 8);
  }, [clientSearch, clients]);

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
  const activeSaleExchangeRate = Math.max(Number(saleExchangeRate || 0), 0);
  const nioReceivedAmount = Math.max(Number(nioReceived || 0), 0);
  const nioChangeNio = Math.max(roundMoney(nioReceivedAmount - totalToCharge), 0);
  const nioPaymentIsEnough = cashPaymentCurrency !== 'NIO' || nioReceivedAmount + 0.01 >= totalToCharge;
  const usdReceivedAmount = Math.max(Number(usdReceived || 0), 0);
  const usdReceivedEquivalent = roundMoney(usdReceivedAmount * activeSaleExchangeRate);
  const usdChangeNio = Math.max(roundMoney(usdReceivedEquivalent - totalToCharge), 0);
  const usdPaymentIsEnough = cashPaymentCurrency !== 'USD' || usdReceivedEquivalent + 0.01 >= totalToCharge;
  const cashPaymentIsEnough = paymentMethod !== 'cash' || (cashPaymentCurrency === 'USD' ? usdPaymentIsEnough : nioPaymentIsEnough);
  const applicablePromotionIds = useMemo(
    () => new Set(
      savedPromotions
        .filter((promotion) => calculatePromotionDiscount(promotion, cart).amount > 0)
        .map((promotion) => String(promotion.id)),
    ),
    [savedPromotions, cart],
  );
  const userNameById = useMemo(() => (
    new Map((users || []).map((user) => [
      String(user.id),
      user.fullName || user.email || 'Usuario',
    ]))
  ), [users]);
  const resolveUserName = useCallback((userId) => {
    if (!userId) return 'Sistema';
    return userNameById.get(String(userId)) || 'Usuario';
  }, [userNameById]);
  const dayMovements = useMemo(() => {
    const saleReferenceIds = new Set((posSales || []).map((sale) => String(sale.id)));
    const voidedReferenceIds = new Set(
      (cashMovements || [])
        .filter((movement) => ['pos_sale_void', 'cash_movement_void'].includes(movement.referenceType))
        .map((movement) => String(movement.referenceId || '')),
    );
    const saleRows = (posSales || []).map((sale) => {
      const firstItem = Array.isArray(sale.items) && sale.items.length ? sale.items[0] : null;
      const itemCount = Array.isArray(sale.items) ? sale.items.length : 0;
      const incomeType = getSaleIncomeType(sale);
      return {
        id: `sale-${sale.id}`,
        rawId: sale.id,
        kind: 'sale',
        title: repairDisplayText(incomeType),
        detail: repairDisplayText(itemCount > 1 ? `${itemCount} ítems cobrados` : (firstItem?.name || 'Cobro')),
        sourceDetail: summarizeSaleMovementSource(sale),
        incomeType,
        clientLabel: repairDisplayText(getSaleClientLabel(sale)),
        barberLabel: repairDisplayText(getSaleBarberLabel(sale)),
        method: sale.paymentMethod || 'cash',
        amount: Number(sale.subtotal || 0),
        productTotal: Number(sale.productTotal || 0),
        serviceTotal: Number(sale.serviceTotal || 0),
        discountTotal: Number(sale.discountTotal || 0),
        ticketNumber: sale.ticketNumber || 0,
        items: Array.isArray(sale.items) ? sale.items : [],
        clientId: sale.clientId || null,
        clientName: sale.clientName || '',
        createdBy: sale.createdBy || null,
        createdAt: sale.createdAt,
        isVoidedOriginal: voidedReferenceIds.has(String(sale.id)),
        isReversal: false,
        canCancel: Boolean(cashSession && !voidedReferenceIds.has(String(sale.id))),
      };
    });
    const movementRows = (cashMovements || [])
      .filter((movement) => (
        movement.referenceType?.includes('void')
        ||
        movement.movementKind !== 'sale'
        || !movement.referenceId
        || !saleReferenceIds.has(String(movement.referenceId))
      ))
      .map((movement) => {
        const ticketNumber = movement.ticketNumber || getMovementTicketNumber(movement);
        const ticketLabel = formatTicketNumber(ticketNumber);
        const movementLabel = getNoteLabel(movement.notes, movement.type === 'out' ? 'Salida manual' : 'Entrada manual');
        const isPayrollPayment = movement.movementKind === 'payroll_payment';
        const isCashAdvance = movement.movementKind === 'cash_advance' || movement.referenceType === 'cash_advance';
        const payrollBarberLabel = isPayrollPayment
          ? String(movement.notes || '').replace(/^Pago de n[oó]mina\s*-\s*/i, '').trim()
          : '';
        const advanceBarberLabel = isCashAdvance
          ? String(movement.notes || '').replace(/^Adelanto a barbero\s*-\s*/i, '').split(' - ')[0].trim()
          : '';
        return {
          id: `movement-${movement.id}`,
          rawId: movement.id,
          kind: movement.movementKind || 'manual',
          type: movement.type || 'in',
          title: repairDisplayText(movement.referenceType === 'pos_sale_void'
            ? `Anulación de venta${ticketLabel ? ` #${ticketLabel}` : ''}`
            : (movement.referenceType === 'cash_movement_void'
              ? 'Anulación de movimiento'
              : (movement.movementKind === 'opening'
                ? 'Apertura de caja'
                : (movement.movementKind === 'sale'
                  ? (movement.notes || 'Venta sin detalle')
                  : (isPayrollPayment
                    ? 'Pago de nómina'
                    : movementLabel))))),
          detail: repairDisplayText(movement.referenceType?.includes('void')
            ? 'Reverso / auditoría'
            : (movement.movementKind === 'opening'
              ? 'Fondo inicial'
              : (movement.movementKind === 'sale'
                ? 'Venta registrada en caja'
                : (isPayrollPayment
                  ? 'Salida por pago al equipo'
                  : (isCashAdvance
                    ? 'Salida por adelanto'
                    : (movement.type === 'out' ? 'Salida de efectivo' : 'Entrada de efectivo')))))),
          sourceDetail: repairDisplayText(movement.referenceType?.includes('void')
            ? (movement.notes || 'Reverso de auditoría')
            : (movement.movementKind === 'opening'
              ? 'Fondo inicial de caja'
              : (movement.movementKind === 'sale'
                ? 'Sin detalle guardado'
                : (isPayrollPayment
                  ? 'Pago de nómina'
                  : movementLabel)))),
          method: movement.paymentMethod || 'cash',
          amount: Number(movement.amount || 0),
          ticketNumber,
          notes: movement.notes || '',
          referenceType: movement.referenceType || null,
          referenceId: movement.referenceId || null,
          clientLabel: '-',
          barberLabel: repairDisplayText(payrollBarberLabel || advanceBarberLabel || '-'),
          createdBy: movement.createdBy || null,
          createdAt: movement.createdAt,
          isVoidedOriginal: voidedReferenceIds.has(String(movement.id)),
          isReversal: Boolean(movement.referenceType?.includes('void')),
          canCancel: Boolean(cashSession && movement.movementKind === 'manual' && !movement.referenceType?.includes('void') && !voidedReferenceIds.has(String(movement.id))),
        };
      });

    return [...saleRows, ...movementRows]
      .sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  }, [cashMovements, cashSession, posSales]);
  const filteredDayMovements = useMemo(() => {
    if (!normalizedMovementSearch) return dayMovements;
    return dayMovements.filter((entry) => {
      const userLabel = resolveUserName(entry.createdBy);
      const text = [
        entry.title,
        entry.sourceDetail,
        entry.detail,
        entry.method,
        entry.clientName,
        entry.clientLabel,
        entry.barberLabel,
        userLabel,
        entry.ticketNumber ? `ticket ${entry.ticketNumber}` : '',
        String(entry.amount || ''),
      ].join(' ').toLowerCase();
      return text.includes(normalizedMovementSearch);
    });
  }, [dayMovements, normalizedMovementSearch, resolveUserName]);
  const exportMovementsToExcel = () => {
    if (!filteredDayMovements.length) return;

    const normalizeExcelText = (value) => `${value ?? ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const escapeCsv = (value) => `"${normalizeExcelText(value).replace(/"/g, '""')}"`;
    const formatMethodLabel = (entry) => {
      if (entry.kind === 'opening') return 'Fondo inicial';
      if (entry.method === 'card') return 'POS / tarjeta';
      if (entry.method === 'transfer') return 'Transferencia';
      return 'Efectivo';
    };
    const rows = filteredDayMovements.map((entry) => {
      const timeLabel = entry.createdAt
        ? new Date(entry.createdAt).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' })
        : '';
      const clientLabel = entry.clientLabel || entry.clientName || '-';
      const barberLabel = entry.barberLabel || '-';
      const ticketLabel = formatTicketNumber(entry.ticketNumber) || '-';
      const amount = Number(entry.amount || 0) * (entry.type === 'out' ? -1 : 1);
      return [
        timeLabel,
        ticketLabel,
        entry.title,
        entry.sourceDetail || entry.detail,
        clientLabel,
        barberLabel,
        resolveUserName(entry.createdBy),
        formatMethodLabel(entry),
        amount,
        entry.isReversal ? 'Reverso' : (entry.isVoidedOriginal ? 'Anulado' : (entry.canCancel ? 'Anulable' : (entry.kind === 'opening' ? 'Base' : 'Bloqueado'))),
      ].map(escapeCsv).join(',');
    });
    const headers = ['Fecha y hora', 'Ticket', 'Concepto', 'Detalle', 'Cliente', 'Barbero', 'Usuario', 'Metodo', 'Monto', 'Estado'];
    const csv = `\uFEFFsep=,\r\n${headers.map(escapeCsv).join(',')}\r\n${rows.join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const fileDate = new Date().toISOString().slice(0, 10);
    link.href = URL.createObjectURL(blob);
    link.download = `movimientos-caja-${fileDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };
  const closedCashSessions = useMemo(() => (
    (cashSessions || [])
      .filter((session) => session.status === 'closed' || session.closedAt)
      .sort((left, right) => new Date(right.closedAt || right.openedAt || 0) - new Date(left.closedAt || left.openedAt || 0))
  ), [cashSessions]);
  const cashHistoryRows = useMemo(() => (
    closedCashSessions.map((session) => {
      const sessionMovements = (allCashMovements || []).filter((movement) => (
        String(movement.cashSessionId || '') === String(session.id || '')
      ));
      const sessionSales = (allPosSales || []).filter((sale) => (
        String(sale.cashSessionId || '') === String(session.id || '')
        && !sale.canceledAt
      ));
      const systemCash = sessionMovements.reduce((total, movement) => {
        if ((movement.paymentMethod || 'cash') !== 'cash') return total;
        const amount = Number(movement.amount || 0);
        return movement.type === 'out' ? total - amount : total + amount;
      }, 0);
      const cardTotal = sessionSales.reduce((total, sale) => (
        sale.paymentMethod === 'card' ? total + Number(sale.subtotal || 0) : total
      ), 0);
      const transferTotal = sessionSales.reduce((total, sale) => (
        sale.paymentMethod === 'transfer' ? total + Number(sale.subtotal || 0) : total
      ), 0);
      const saleTotal = sessionSales.reduce((total, sale) => total + Number(sale.subtotal || 0), 0);
      const closureNotes = parseJsonNote(session.notes);
      const expectedCash = Number(closureNotes?.expectedCashAmount ?? session.expectedCashAmount ?? systemCash);
      const countedCash = Number(closureNotes?.countedCashAmount ?? session.countedCashAmount ?? session.closingAmount ?? 0);
      const difference = Number(session.differenceAmount ?? (countedCash - expectedCash));

      return {
        ...session,
        movementCount: sessionMovements.length,
        saleCount: sessionSales.length,
        saleTotal,
        expectedCash,
        countedCash,
        difference,
        cardTotal,
        transferTotal,
        openedByLabel: resolveUserName(session.openedBy),
        closedByLabel: resolveUserName(session.closedBy),
      };
    })
  ), [allCashMovements, allPosSales, closedCashSessions, resolveUserName]);

  const handleCancelMovementEntry = async (entry) => {
    if (!entry?.canCancel) return;
    const confirmed = await confirmAction?.({
      title: entry.kind === 'sale' ? 'Anular venta' : 'Anular movimiento',
      message: entry.kind === 'sale'
        ? `¿Deseas anular esta venta por ${formatCurrency(entry.amount)}? Se registrará un reverso de auditoría.`
        : `¿Deseas anular este movimiento por ${formatCurrency(entry.amount)}? Se registrará un reverso de auditoría.`,
      confirmLabel: 'Anular',
      cancelLabel: 'Volver',
    });
    if (!confirmed) return;
    const reason = window.prompt('Motivo de anulación');
    if (!reason?.trim()) return;

    if (entry.kind === 'sale') {
      await onCancelSale?.(entry.rawId, reason.trim());
      return;
    }
    await onCancelCashMovement?.(entry.rawId, reason.trim());
  };


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

  const updateOpeningDenomination = (group, denomination, value) => {
    const nextValue = Math.max(Number.parseInt(value || '0', 10) || 0, 0);
    setOpeningBreakdown((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [denomination]: nextValue,
      },
    }));
  };

  const updateClosingDenomination = (group, denomination, value) => {
    const nextValue = Math.max(Number.parseInt(value || '0', 10) || 0, 0);
    setClosingBreakdown((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [denomination]: nextValue,
      },
    }));
  };

  const handleOpenCash = async () => {
    if (openingBusy) return;
    setOpeningBusy(true);
    setOpeningFeedback('Abriendo caja...');
    const slowTimer = window.setTimeout(() => {
      setOpeningFeedback('La apertura sigue esperando respuesta de Supabase. No cierres esta pantalla todavía.');
    }, 8000);

    try {
      const result = await onOpenCashSession?.({
        openingAmount: openingTotals.total,
        notes: JSON.stringify({
          source: 'Apertura desde caja POS',
          nioBills: openingBreakdown.nioBills,
          nioCoins: openingBreakdown.nioCoins,
          usdBills: openingBreakdown.usdBills,
          exchangeRate: openingTotals.exchangeRate,
          nioTotal: openingTotals.nioTotal,
          usdTotal: openingTotals.usdTotal,
          convertedUsdTotal: openingTotals.convertedUsdTotal,
        }),
      });
      if (result) {
        setOpeningBreakdown({ nioBills: {}, nioCoins: {}, usdBills: {} });
        setOpeningFeedback('');
        setOpeningModalSuppressed(true);
      } else {
        setOpeningFeedback('No se pudo abrir la caja. Revisa si hay una alerta del sistema o si la sucursal está activa.');
      }
    } catch (error) {
      setOpeningFeedback(error?.message || 'No se pudo abrir la caja.');
    } finally {
      window.clearTimeout(slowTimer);
      setOpeningBusy(false);
    }
  };

  const handleManualMovement = async () => {
    const originalAmount = Math.max(Number(movementAmount || 0), 0);
    const exchangeRate = Math.max(Number(movementExchangeRate || 0), 0);
    const movementAmountNio = movementCurrency === 'USD'
      ? roundMoney(originalAmount * exchangeRate)
      : originalAmount;
    const label = movementNotes.trim() || (movementType === 'out' ? 'Salida manual' : 'Entrada manual');
    const result = await onCashMovement?.({
      type: movementType,
      amount: movementAmountNio,
      notes: JSON.stringify({
        label,
        currency: movementCurrency,
        amountOriginal: originalAmount,
        exchangeRate: movementCurrency === 'USD' ? exchangeRate : null,
        amountNio: movementAmountNio,
      }),
    });
    if (result) {
      setMovementAmount('');
      setMovementNotes('');
      setMovementCurrency('NIO');
    }
  };

  const handleCloseCash = async () => {
    let differenceReason = '';
    if (!isBalancedClose) {
      const reason = window.prompt('La caja tiene diferencia. Escribe el motivo para cerrar.');
      if (!reason?.trim()) return;
      differenceReason = reason.trim();
    }
    const result = await onCloseCashSession?.({
      countedCashAmount: closingTotals.total,
      notes: JSON.stringify({
        source: 'Cierre desde caja POS',
        nioBills: closingBreakdown.nioBills,
        nioCoins: closingBreakdown.nioCoins,
        usdBills: closingBreakdown.usdBills,
        exchangeRate: closingTotals.exchangeRate,
        countedCashAmount: closingTotals.total,
        expectedCashAmount: cashCurrencySummary.expectedEquivalent,
        expectedNioAmount: cashCurrencySummary.expectedNio,
        countedNioAmount: closingTotals.nioTotal,
        expectedUsdAmount: cashCurrencySummary.expectedUsd,
        countedUsdAmount: closingTotals.usdTotal,
        countedCardAmount: closingCardCounted,
        expectedCardAmount: systemPaymentSummary.card,
        countedTransferAmount: closingTransferCounted,
        expectedTransferAmount: systemPaymentSummary.transfer,
        differences: closingDifferences,
        differenceReason,
      }),
    });
    if (result) {
      setClosingBreakdown({ nioBills: {}, nioCoins: {}, usdBills: {} });
      setClosingCardAmount('');
      setClosingTransferAmount('');
      setClosingModalOpen(false);
      setOpeningModalSuppressed(true);
    }
  };

  const handleCompleteSale = async () => {
    if (paymentMethod === 'cash' && !cashPaymentIsEnough) return;
    const saleClientName = genericClientSale
      ? 'Cliente gen\u00e9rico'
      : (selectedClient?.name || '');
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
    const result = await onSale({
      items: cart,
      rawSubtotal: subtotal,
      discountTotal: promotionDiscount,
      subtotal: totalToCharge,
      paymentMethod,
      clientId: genericClientSale ? null : (selectedClient?.id || null),
      clientName: saleClientName,
      promotion: selectedPromotion ? { id: selectedPromotion.id, name: selectedPromotion.name } : null,
      notes: JSON.stringify({ paymentMeta }),
    });

    if (result) {
      setCart([]);
      setSelectedPromotionId('');
      setPaymentMethod('cash');
      setCashPaymentCurrency('NIO');
      setNioReceived('');
      setUsdReceived('');
      setSelectedClientId('');
      setClientSearch('');
      setClientPickerOpen(false);
      setGenericClientSale(false);
      setPromotionPickerOpen(false);
      setTicketOpen(false);
    }
  };

  return (
    <div className="pos-view relative h-full flex flex-col bg-[#020617] text-[#f8fafc] animate-in fade-in no-print">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="p-4 md:p-8 space-y-4 md:space-y-6 border-b border-[#1e293b] bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900">
          <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
            <div className="rounded-[2rem] border border-[#334155] bg-slate-950 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.55)]">
              <div className="flex h-full min-h-[210px] flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between">
                <div className="flex flex-col justify-center lg:min-w-[220px] lg:flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#38bdf8]">Caja operativa</p>
                  <h3 className="mt-2 text-2xl font-black uppercase italic tracking-tighter text-[#f8fafc]">
                    {cashSession ? 'Caja abierta' : 'Abrir caja'}
                  </h3>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">
                    {cashSession ? `Desde ${new Date(cashSession.openedAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}` : 'Necesaria para vender'}
                  </p>
                </div>

                {!cashSession ? (
                  <div className="flex flex-col items-stretch gap-3 rounded-[1.6rem] border border-[#334155] bg-[#0f172a] px-5 py-4 text-right sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => setOpeningModalSuppressed(false)}
                      className="rounded-2xl bg-[#059669] px-5 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-white shadow-[0_14px_28px_rgba(114,183,155,0.24)] transition-all hover:bg-[#047857] active:scale-95"
                    >
                      Abrir caja
                    </button>
                    <div className="flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Pendiente de apertura</p>
                    <p className="mt-1 text-sm font-black italic text-[#38bdf8]">Completa el arqueo inicial</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:flex-[1.45] lg:content-stretch">
                    <div className="flex min-h-[78px] flex-col justify-center rounded-[1.25rem] border border-[#334155] bg-[#0f172a] px-4 py-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Efectivo caja</p>
                      <p className="mt-1 text-lg font-black italic text-[#34d399]">{formatCurrency(cashCurrencySummary.expectedEquivalent)}</p>
                      <p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">C$ {Number(cashCurrencySummary.expectedNio || 0).toLocaleString('es-NI')} · $ {Number(cashCurrencySummary.expectedUsd || 0).toLocaleString('es-NI')}</p>
                    </div>
                    <div className="flex min-h-[78px] flex-col justify-center rounded-[1.25rem] border border-[#334155] bg-[#0f172a] px-4 py-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Ventas total</p>
                      <p className="mt-1 text-lg font-black italic text-[#38bdf8]">{formatCurrency(totalSalesSummary)}</p>
                    </div>
                    <div className="flex min-h-[78px] flex-col justify-center rounded-[1.25rem] border border-[#334155] bg-[#0f172a] px-4 py-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">POS / tarjeta</p>
                      <p className="mt-1 text-lg font-black italic text-[#34d399]">{formatCurrency(systemPaymentSummary.card)}</p>
                    </div>
                    <div className="flex min-h-[78px] flex-col justify-center rounded-[1.25rem] border border-[#334155] bg-[#0f172a] px-4 py-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Transferencia</p>
                      <p className="mt-1 text-lg font-black italic text-[#34d399]">{formatCurrency(systemPaymentSummary.transfer)}</p>
                    </div>
                    <div className="flex min-h-[78px] flex-col justify-center rounded-[1.25rem] border border-[#334155] bg-[#0f172a] px-4 py-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Entradas</p>
                      <p className="mt-1 text-lg font-black italic text-[#34d399]">{formatCurrency(cashCurrencySummary.manualInNio + (cashCurrencySummary.manualInUsd * cashCurrencySummary.exchangeRate))}</p>
                      <p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">C$ {Number(cashCurrencySummary.manualInNio || 0).toLocaleString('es-NI')} · $ {Number(cashCurrencySummary.manualInUsd || 0).toLocaleString('es-NI')}</p>
                    </div>
                    <div className="flex min-h-[78px] flex-col justify-center rounded-[1.25rem] border border-[#334155] bg-[#0f172a] px-4 py-3">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Salidas</p>
                      <p className="mt-1 text-lg font-black italic text-[#fb7185]">{formatCurrency(cashCurrencySummary.manualOutNio + (cashCurrencySummary.manualOutUsd * cashCurrencySummary.exchangeRate))}</p>
                      <p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">C$ {Number(cashCurrencySummary.manualOutNio || 0).toLocaleString('es-NI')} · $ {Number(cashCurrencySummary.manualOutUsd || 0).toLocaleString('es-NI')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#334155] bg-slate-950 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.45)]">
              {cashSession ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setMovementType('in')} className={`flex-1 rounded-2xl px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] transition-all ${movementType === 'in' ? 'bg-[#059669] text-white' : 'border border-[#475569] text-[#94a3b8]'}`}><ArrowUp size={14} className="inline" /> Entrada</button>
                    <button type="button" onClick={() => setMovementType('out')} className={`flex-1 rounded-2xl px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] transition-all ${movementType === 'out' ? 'bg-[#e11d48] text-white' : 'border border-[#475569] text-[#94a3b8]'}`}><ArrowDown size={14} className="inline" /> Salida</button>
                  </div>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                      <div className="flex overflow-hidden rounded-2xl border border-[#475569] bg-[#0f172a] focus-within:border-[#4f46e5]">
                        <select value={movementCurrency} onChange={(event) => setMovementCurrency(event.target.value)} className="w-20 shrink-0 border-r border-[#475569] bg-slate-950 px-3 py-3 text-sm font-black text-[#67e8f9] outline-none">
                          <option value="NIO">C$</option>
                          <option value="USD">US$</option>
                        </select>
                        <input type="number" min="0" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} placeholder={movementCurrency === 'USD' ? 'Monto en US$' : 'Monto en C$'} className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-black outline-none" />
                      </div>
                    {movementCurrency === 'USD' ? (
                      <input type="number" min="0" step="0.01" value={movementExchangeRate} onChange={(event) => setMovementExchangeRate(event.target.value)} placeholder="Tasa" className="rounded-2xl border border-[#475569] bg-[#0f172a] px-4 py-3 text-sm font-black outline-none focus:border-[#4f46e5]" />
                    ) : null}
                    </div>
                    <input type="text" value={movementNotes} onChange={(event) => setMovementNotes(event.target.value)} placeholder="Nota" className="block w-full rounded-2xl border border-[#475569] bg-[#0f172a] px-4 py-3 text-sm font-bold outline-none focus:border-[#4f46e5]" />
                  </div>
                  <button type="button" onClick={handleManualMovement} className="w-full rounded-2xl border border-[#059669]/40 bg-[#052e2b] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#34d399] transition-all hover:bg-[#064e3b]">
                    Registrar movimiento
                  </button>
                  <button type="button" onClick={() => setClosingModalOpen(true)} className="w-full rounded-2xl border border-[#334155] bg-[#111827] px-5 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-[#67e8f9] shadow-[0_12px_24px_rgba(217,79,131,0.14)] transition-all hover:bg-[#1e293b] active:scale-95">
                    Arqueo y cierre
                  </button>
                </div>
              ) : (
                <div className="flex h-full min-h-32 items-center justify-center rounded-[1.6rem] border border-dashed border-[#475569] bg-[#0f172a] p-6 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">Abre caja para activar ventas, entradas y cierre</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative overflow-hidden rounded-[1.7rem] border border-slate-800 bg-slate-950 px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.35)]">
              <div className="absolute inset-x-0 top-0 h-px bg-slate-800" />
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                <ShoppingBag size={18} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] italic text-emerald-400 leading-none">Catálogo de productos</p>
            </div>
            <div className="flex items-center gap-3">
              {cashSession ? (
                <button
                  type="button"
                  onClick={() => {
                    setMovementsSummaryCollapsed(false);
                    setMovementsModalOpen(true);
                  }}
                  className="flex items-center gap-3 rounded-[1.6rem] border border-[#475569] bg-slate-950 px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#67e8f9] transition-all hover:bg-[#111827] active:scale-95"
                >
                  <ListChecks size={16} />
                  Movimientos
                  <span className="rounded-full bg-[#111827] px-2 py-0.5 text-[8px] text-[#38bdf8]">{dayMovements.length}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setCashHistorySummaryCollapsed(false);
                  setCashHistoryOpen(true);
                }}
                className="flex items-center gap-3 rounded-[1.6rem] border border-[#475569] bg-slate-950 px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-[#67e8f9] transition-all hover:bg-[#111827] active:scale-95"
              >
                <Clock size={16} />
                Historial
              </button>
              <div className="relative">
                <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={18} />
                <input type="text" placeholder="Buscar producto" className="w-full rounded-2xl border border-[#475569] bg-slate-950 py-4 pl-8 pr-16 text-sm font-black text-[#f8fafc] outline-none transition-all placeholder:text-[#64748b] focus:border-[#4f46e5] md:w-80" value={search} onChange={(event) => setSearch(event.target.value)} />
              </div>
              <button
                type="button"
                onClick={() => setTicketOpen(true)}
                disabled={cart.length === 0}
                className={`hidden md:flex items-center gap-3 rounded-[1.6rem] border px-5 py-4 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${cart.length > 0 ? 'border-[#4f46e5]/35 bg-[#4f46e5] text-white hover:bg-[#4338ca]' : 'cursor-not-allowed border-[#475569] bg-[#111827] text-[#64748b] opacity-70'}`}
              >
                <ShoppingBag size={16} />
                {cart.length > 0 ? `Carrito (${cart.length})` : 'Carrito vacío'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 md:p-8 custom-scrollbar">
          <div className="grid grid-cols-2 content-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 md:gap-6">
            {filtered.length === 0 && (
              <div className="col-span-full rounded-[2rem] border border-dashed border-[#475569] bg-slate-950/70 p-10 text-center text-[#94a3b8]">
                <p className="text-[10px] font-black uppercase tracking-[0.22em]">No se encontraron productos</p>
              </div>
            )}
            {filtered.map((service) => (
              <ProductCard key={service.id} service={service} onAdd={addItem} />
            ))}
            </div>
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

      {shouldShowOpeningModal ? createPortal((
        <div className="fixed inset-0 z-[220] flex min-h-screen items-center justify-center bg-[#020617]/85 p-3 backdrop-blur-xl md:p-5">
          <div className="flex max-h-[calc(100vh-0.75rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-[#475569] bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-[#f8fafc] shadow-[0_35px_120px_rgba(0,0,0,0.7)]">
            <div className="border-b border-[#1e293b] px-5 py-3 md:px-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#38bdf8]">Apertura de caja</p>
                  <h3 className="mt-1 text-3xl font-black uppercase italic tracking-tighter text-[#f8fafc]">Arqueo inicial</h3>
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Cuenta el efectivo antes de iniciar ventas</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-[1.4rem] border border-[#334155] bg-slate-950 px-4 py-2.5 text-right">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">Monto inicial</p>
                    <p className="mt-0.5 text-2xl font-black italic text-[#34d399]">{formatCurrency(openingTotals.total)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpeningModalSuppressed(true)}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#475569] bg-slate-950 text-[#67e8f9] transition-all hover:bg-[#111827]"
                    aria-label="Cerrar apertura de caja"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid flex-1 gap-3 overflow-y-auto p-3 custom-scrollbar md:p-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <section className="rounded-[1.6rem] border border-[#334155] bg-slate-950/70 p-2.5">
                <div className="mb-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#38bdf8]">Conteo de efectivo</p>
                  <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#94a3b8]">Billetes, monedas y dólares</p>
                </div>
                <div className="grid gap-2.5 lg:grid-cols-3">
                  <DenominationGrid compact title="Billetes C$" currency="C$" denominations={NIO_BILL_DENOMINATIONS} values={openingBreakdown.nioBills} onChange={(denomination, value) => updateOpeningDenomination('nioBills', denomination, value)} />
                  <DenominationGrid compact title="Monedas C$" currency="C$" denominations={NIO_COIN_DENOMINATIONS} values={openingBreakdown.nioCoins} onChange={(denomination, value) => updateOpeningDenomination('nioCoins', denomination, value)} />
                  <DenominationGrid compact title="Dólares" currency="$" denominations={USD_BILL_DENOMINATIONS} values={openingBreakdown.usdBills} onChange={(denomination, value) => updateOpeningDenomination('usdBills', denomination, value)} />
                </div>
              </section>

              <div className="space-y-3">
                <div className="rounded-[1.6rem] border border-[#334155] bg-slate-950 p-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">Tasa dólar</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={openingExchangeRate}
                    onChange={(event) => setOpeningExchangeRate(event.target.value)}
                    className="mt-1.5 w-full rounded-2xl border border-[#475569] bg-[#0f172a] px-4 py-2.5 text-lg font-black text-[#f8fafc] outline-none focus:border-[#4f46e5]"
                  />
                </div>
                <div className="rounded-[1.6rem] border border-[#334155] bg-slate-950 p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">Resumen</p>
                  <div className="mt-3 space-y-2.5">
                    <div className="flex justify-between gap-3 text-sm font-black"><span>Córdobas</span><span>{formatCurrency(openingTotals.nioTotal)}</span></div>
                    <div className="flex justify-between gap-3 text-sm font-black"><span>Dólares</span><span>$ {openingTotals.usdTotal.toLocaleString('es-NI')}</span></div>
                    <div className="flex justify-between gap-3 text-sm font-black text-[#34d399]"><span>USD en C$</span><span>{formatCurrency(openingTotals.convertedUsdTotal)}</span></div>
                    <div className="border-t border-[#1e293b] pt-3">
                      <div className="flex justify-between gap-3 text-lg font-black italic text-[#38bdf8]"><span>Total</span><span>{formatCurrency(openingTotals.total)}</span></div>
                    </div>
                  </div>
                </div>
                {openingFeedback ? (
                  <div className="rounded-[1.25rem] border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-[9px] font-black uppercase leading-relaxed tracking-[0.14em] text-cyan-100">
                    {openingFeedback}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={handleOpenCash}
                  disabled={openingBusy}
                  className="flex w-full items-center justify-center gap-3 rounded-[1.6rem] bg-[#059669] px-5 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_18px_35px_rgba(114,183,155,0.32)] transition-all hover:bg-[#047857] active:scale-95 disabled:cursor-wait disabled:bg-slate-700 disabled:text-slate-300 disabled:shadow-none"
                >
                  {openingBusy ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />} {openingBusy ? 'Abriendo...' : 'Abrir caja'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body) : null}

      {closingModalOpen && cashSession ? createPortal((
        <div className="fixed inset-0 z-[230] flex min-h-screen items-center justify-center bg-[#020617]/85 p-3 backdrop-blur-xl md:p-5">
          <div className="flex max-h-[calc(100vh-0.75rem)] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-[#475569] bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-[#f8fafc] shadow-[0_35px_120px_rgba(0,0,0,0.7)]">
            <div className="border-b border-[#1e293b] px-5 py-3 md:px-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#38bdf8]">Cierre de caja</p>
                  <h3 className="mt-1 text-3xl font-black uppercase italic tracking-tighter text-[#f8fafc]">Arqueo final</h3>
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Debe coincidir efectivo, POS y transferencia</p>
                </div>
                <button
                  type="button"
                  onClick={() => setClosingModalOpen(false)}
                  className="h-12 rounded-2xl border border-[#475569] bg-slate-950 px-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#67e8f9] transition-all hover:bg-[#111827]"
                >
                  Revisar luego
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar md:p-4">
              <div className="mb-3 grid gap-2.5 md:grid-cols-4">
                {[
                  { label: 'Efectivo C$', system: cashCurrencySummary.expectedNio, counted: closingTotals.nioTotal, diff: closingDifferences.nio, formatter: formatCurrency },
                  { label: 'Dólares', system: cashCurrencySummary.expectedUsd, counted: closingTotals.usdTotal, diff: closingDifferences.usd, formatter: (value) => `$ ${Number(value || 0).toLocaleString('es-NI')}` },
                  { label: 'POS / tarjeta', system: systemPaymentSummary.card, counted: closingCardCounted, diff: closingDifferences.card },
                  { label: 'Transferencia', system: systemPaymentSummary.transfer, counted: closingTransferCounted, diff: closingDifferences.transfer },
                ].map((row) => (
                  <div key={row.label} className="rounded-[1.25rem] border border-[#334155] bg-slate-950 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">{row.label}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] ${Math.abs(row.diff) < 0.01 ? 'bg-[#052e2b] text-[#34d399]' : 'bg-[#111827] text-[#fb7185]'}`}>
                        {Math.abs(row.diff) < 0.01 ? 'Cuadra' : 'Diferencia'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-black">
                      <div><p className="uppercase tracking-[0.12em] text-[#94a3b8]">Sistema</p><p className="mt-1 text-[#34d399]">{(row.formatter || formatCurrency)(row.system)}</p></div>
                      <div><p className="uppercase tracking-[0.12em] text-[#94a3b8]">Contado</p><p className="mt-1 text-[#f8fafc]">{(row.formatter || formatCurrency)(row.counted)}</p></div>
                      <div><p className="uppercase tracking-[0.12em] text-[#94a3b8]">Dif.</p><p className={`mt-1 ${Math.abs(row.diff) < 0.01 ? 'text-[#34d399]' : 'text-[#fb7185]'}`}>{(row.formatter || formatCurrency)(row.diff)}</p></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
                <section className="rounded-[1.6rem] border border-[#334155] bg-slate-950/70 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#38bdf8]">Conteo de efectivo</p>
                      <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-[#94a3b8]">Billetes, monedas y dólares</p>
                    </div>
                    <div className="rounded-xl border border-[#334155] bg-slate-950 px-3 py-1.5 text-right">
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-[#94a3b8]">Total contado</p>
                      <p className="text-lg font-black italic text-[#34d399]">{formatCurrency(closingTotals.total)}</p>
                    </div>
                  </div>
                  <div className="grid gap-2.5 lg:grid-cols-3">
                    <DenominationGrid compact title="Billetes C$" currency="C$" denominations={NIO_BILL_DENOMINATIONS} values={closingBreakdown.nioBills} onChange={(denomination, value) => updateClosingDenomination('nioBills', denomination, value)} />
                    <DenominationGrid compact title="Monedas C$" currency="C$" denominations={NIO_COIN_DENOMINATIONS} values={closingBreakdown.nioCoins} onChange={(denomination, value) => updateClosingDenomination('nioCoins', denomination, value)} />
                    <DenominationGrid compact title="Dólares" currency="$" denominations={USD_BILL_DENOMINATIONS} values={closingBreakdown.usdBills} onChange={(denomination, value) => updateClosingDenomination('usdBills', denomination, value)} />
                  </div>
                </section>

                <aside className="space-y-3">
                  <section className="rounded-[1.6rem] border border-[#334155] bg-slate-950 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#38bdf8]">Configuración</p>
                    <label className="mt-3 block text-[9px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Tasa dólar</label>
                    <input type="number" min="0" step="0.01" value={closingExchangeRate} onChange={(event) => setClosingExchangeRate(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-[#475569] bg-[#0f172a] px-4 py-2.5 text-lg font-black text-[#f8fafc] outline-none focus:border-[#4f46e5]" />
                  </section>

                  <section className="rounded-[1.6rem] border border-[#334155] bg-slate-950 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#38bdf8]">Pagos electrónicos</p>
                    <label className="mt-3 block text-[9px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">POS / tarjeta contado</label>
                    <input type="number" min="0" value={closingCardAmount} onChange={(event) => setClosingCardAmount(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-[#475569] bg-[#0f172a] px-4 py-2.5 text-base font-black text-[#f8fafc] outline-none focus:border-[#4f46e5]" placeholder="0" />
                    <label className="mt-3 block text-[9px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Transferencia contada</label>
                    <input type="number" min="0" value={closingTransferAmount} onChange={(event) => setClosingTransferAmount(event.target.value)} className="mt-1.5 w-full rounded-2xl border border-[#475569] bg-[#0f172a] px-4 py-2.5 text-base font-black text-[#f8fafc] outline-none focus:border-[#4f46e5]" placeholder="0" />
                  </section>
                </aside>
              </div>
            </div>

            <div className="border-t border-[#1e293b] bg-[#020617]/95 px-5 py-3 md:px-7">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className={`text-[10px] font-black uppercase tracking-[0.16em] ${isBalancedClose ? 'rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-[#34d399]' : 'rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-amber-200'}`}>
                  {isBalancedClose ? 'Arqueo cuadrado. Listo para cerrar.' : 'Hay diferencias. Se pedirá motivo al cerrar.'}
                </p>
                <button type="button" onClick={handleCloseCash} className={`flex items-center justify-center gap-3 rounded-[1.5rem] px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 ${isBalancedClose ? 'border border-emerald-300/30 bg-[#059669] text-white shadow-[0_18px_35px_rgba(5,150,105,0.28)] hover:bg-[#047857]' : 'border border-amber-300/30 bg-amber-500 text-slate-950 shadow-[0_18px_35px_rgba(245,158,11,0.22)] hover:bg-amber-400'}`}>
                  <Check size={18} /> Cerrar caja
                </button>
              </div>
            </div>
          </div>
        </div>
      ), document.body) : null}

      {movementsModalOpen && cashSession ? createPortal((
        <div className="barber-cash-movements fixed inset-0 z-[235] flex min-h-screen items-center justify-center bg-[#020617]/85 p-3 backdrop-blur-xl md:p-5">
          <div className="barber-cash-panel flex max-h-[calc(100vh-1rem)] w-full max-w-[min(98vw,100rem)] flex-col overflow-hidden rounded-[2rem] border border-[#475569] bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-[#f8fafc] shadow-[0_35px_120px_rgba(0,0,0,0.7)]">
            <div className="border-b border-[#1e293b] px-5 py-4 md:px-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#38bdf8]">Caja actual</p>
                  <h3 className="mt-1 text-3xl font-black uppercase italic tracking-tighter text-[#f8fafc]">Movimientos del día</h3>
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Ventas, servicios cobrados, entradas y salidas</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMovementsSummaryCollapsed(false);
                    setMovementsModalOpen(false);
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#475569] bg-slate-950 text-[#67e8f9] transition-all hover:bg-[#111827]"
                  aria-label="Cerrar movimientos"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={`grid grid-cols-2 gap-3 bg-slate-950/65 px-5 transition-all duration-300 md:grid-cols-4 md:border-b md:border-[#1e293b] md:px-7 md:py-3 ${movementsSummaryCollapsed ? 'max-md:max-h-0 max-md:overflow-hidden max-md:border-b-0 max-md:py-0 max-md:opacity-0' : 'max-md:max-h-[18rem] max-md:border-b max-md:border-[#1e293b] max-md:py-3 max-md:opacity-100'}`}>
              <div className="rounded-[1.3rem] border border-[#334155] bg-slate-950 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Esperado efectivo</p>
                <p className="mt-1 text-xl font-black italic text-[#34d399]">{formatCurrency(cashCurrencySummary.expectedEquivalent)}</p>
                <p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">C$ {Number(cashCurrencySummary.expectedNio || 0).toLocaleString('es-NI')} · $ {Number(cashCurrencySummary.expectedUsd || 0).toLocaleString('es-NI')}</p>
              </div>
              <div className="rounded-[1.3rem] border border-[#334155] bg-slate-950 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Ventas efectivo</p>
                <p className="mt-1 text-xl font-black italic text-[#38bdf8]">{formatCurrency(cashSummary.sales)}</p>
              </div>
              <div className="rounded-[1.3rem] border border-[#334155] bg-slate-950 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">POS / tarjeta</p>
                <p className="mt-1 text-xl font-black italic text-[#34d399]">{formatCurrency(systemPaymentSummary.card)}</p>
              </div>
              <div className="rounded-[1.3rem] border border-[#334155] bg-slate-950 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Transferencia</p>
                <p className="mt-1 text-xl font-black italic text-[#34d399]">{formatCurrency(systemPaymentSummary.transfer)}</p>
              </div>
            </div>

            <div className="border-b border-[#1e293b] bg-white/75 px-5 py-3 md:px-7">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8]" size={16} />
                <input
                  type="text"
                  value={movementSearch}
                  onChange={(event) => setMovementSearch(event.target.value)}
                  placeholder="Buscar por ticket, cliente, servicio, producto, usuario o método"
                  className="w-full rounded-2xl border border-[#475569] bg-slate-950 py-3 pl-5 pr-12 text-sm font-black text-[#f8fafc] outline-none placeholder:text-[#64748b] focus:border-[#4f46e5]"
                />
                </div>
                <button
                  type="button"
                  onClick={exportMovementsToExcel}
                  disabled={filteredDayMovements.length === 0}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition-all active:scale-95 ${filteredDayMovements.length > 0 ? 'border-[#059669]/45 bg-[#052e2b] text-[#34d399] hover:bg-[#064e3b]' : 'cursor-not-allowed border-[#334155] bg-[#020617] text-[#64748b] opacity-70'}`}
                >
                  <Save size={15} /> Exportar Excel
                </button>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto p-3 custom-scrollbar md:p-5"
              onScroll={(event) => {
                if (window.innerWidth >= 768) return;
                setMovementsSummaryCollapsed(event.currentTarget.scrollTop > 12);
              }}
            >
              {filteredDayMovements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#475569] bg-slate-950/70 p-10 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#94a3b8]">Sin movimientos para esta búsqueda</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#334155] bg-slate-950 custom-scrollbar">
                  <div className="grid min-w-[98rem] grid-cols-[5.2rem_6.5rem_minmax(12.5rem,1.12fr)_minmax(14.5rem,1.18fr)_minmax(8.5rem,0.75fr)_minmax(8.5rem,0.75fr)_minmax(7.5rem,0.7fr)_7.3rem_7.3rem_7.3rem] gap-3 border-b border-[#1e293b] bg-[#020617] px-5 py-3 text-[8px] font-black uppercase tracking-[0.15em] text-[#94a3b8] max-xl:hidden">
                    <span>Hora</span>
                    <span>Ticket</span>
                    <span>Concepto</span>
                    <span>Qué generó el movimiento</span>
                    <span>Cliente</span>
                    <span>Barbero</span>
                    <span>Usuario</span>
                    <span>Método</span>
                    <span className="text-right">Monto</span>
                    <span className="w-[6.4rem] justify-self-center text-center">Acción</span>
                  </div>

                  <div className="divide-y divide-[#1e293b]">
                    {filteredDayMovements.map((entry) => {
                      const isOut = entry.type === 'out';
                      const isSale = entry.kind === 'sale';
                      const isOpening = entry.kind === 'opening';
                      const isReversal = entry.isReversal;
                      const methodLabel = entry.method === 'card'
                        ? 'POS / tarjeta'
                        : (entry.method === 'transfer' ? 'Transferencia' : 'Efectivo');
                      const timeLabel = entry.createdAt
                        ? new Date(entry.createdAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })
                        : '--:--';
                      const detailText = repairDisplayText(entry.sourceDetail || entry.detail);
                      const clientLabel = repairDisplayText(entry.clientLabel || entry.clientName || '-');
                      const barberLabel = repairDisplayText(entry.barberLabel || '-');
                      const ticketLabel = formatTicketNumber(entry.ticketNumber) || '-';
                      const userLabel = resolveUserName(entry.createdBy);
                      const rowTone = isOpening
                        ? 'border-l-[#75a7b8] bg-[#f3f9fb]'
                        : (isReversal ? 'border-l-[#fb7185] bg-[#fff3f7]' : (isOut ? 'border-l-[#d65f7f] bg-[#fff6f8]' : 'border-l-[#059669] bg-[#f8fffb]'));
                      const iconTone = isOpening
                        ? 'bg-[#75a7b8] shadow-[#75a7b8]/20'
                        : (isReversal ? 'bg-[#fb7185] shadow-[#fb7185]/20' : (isOut ? 'bg-[#d65f7f] shadow-[#d65f7f]/20' : 'bg-[#059669] shadow-[#059669]/20'));
                      return (
                        <div key={entry.id} className={`grid min-w-[98rem] gap-3 border-l-4 px-5 py-3 text-sm transition-colors max-xl:min-w-0 max-xl:grid-cols-[minmax(0,1fr)] xl:grid-cols-[5.2rem_6.5rem_minmax(12.5rem,1.12fr)_minmax(14.5rem,1.18fr)_minmax(8.5rem,0.75fr)_minmax(8.5rem,0.75fr)_minmax(7.5rem,0.7fr)_7.3rem_7.3rem_7.3rem] xl:items-center ${rowTone}`}>
                          <p className="text-[12px] font-black text-[#f8fafc] max-xl:hidden">{timeLabel}</p>
                          <p className="truncate text-[9px] font-black uppercase tracking-[0.1em] text-[#67e8f9] max-xl:hidden">{ticketLabel}</p>
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-lg ${iconTone}`}>
                              {isReversal ? <RotateCcw size={15} /> : (isSale ? <ReceiptText size={15} /> : (isOut ? <ArrowDown size={15} /> : <ArrowUp size={15} />))}
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-2 text-[10px] font-black uppercase italic leading-snug text-[#f8fafc]">{entry.title}</p>
                              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#94a3b8] xl:hidden">{timeLabel} · Ticket: {ticketLabel} · {methodLabel} · Cliente: {clientLabel} · Barbero: {barberLabel}</p>
                            </div>
                          </div>
                          <p className="line-clamp-2 text-[9px] font-bold uppercase tracking-[0.06em] text-[#94a3b8] max-xl:rounded-2xl max-xl:border max-xl:border-[#334155] max-xl:bg-[#020617] max-xl:px-3 max-xl:py-2">{detailText}</p>
                          <p className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-[#34d399] max-xl:hidden">{clientLabel}</p>
                          <p className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-[#67e8f9] max-xl:hidden">{barberLabel}</p>
                          <p className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-[#67e8f9] max-xl:hidden">{userLabel}</p>
                          <span className={`rounded-full border px-3 py-1.5 text-center text-[8px] font-black uppercase tracking-[0.1em] max-lg:w-fit ${isOpening ? 'border-[#c4dce4] bg-slate-950 text-[#4f7b8b]' : (isReversal ? 'border-[#f3b8c8] bg-slate-950 text-[#fb7185]' : (isOut ? 'border-[#f3b8c8] bg-slate-950 text-[#b84868]' : 'border-[#cdeadd] bg-slate-950 text-[#34d399]'))}`}>
                            {isOpening ? 'Fondo inicial' : (isReversal ? 'Reverso' : methodLabel)}
                          </span>
                          <p className={`text-right text-lg font-black italic max-xl:text-left ${isOut ? 'text-[#fb7185]' : 'text-[#34d399]'}`}>
                            {isOut ? '-' : '+'}{formatCurrency(entry.amount)}
                          </p>
                          {entry.canCancel ? (
                            <button
                              type="button"
                              onClick={() => handleCancelMovementEntry(entry)}
                              className="flex min-w-[6.4rem] items-center justify-center gap-2 justify-self-center rounded-xl border border-[#334155] bg-slate-950 px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#67e8f9] transition-all hover:bg-[#111827] active:scale-95 max-xl:justify-self-start"
                            >
                              <RotateCcw size={14} /> Anular
                            </button>
                          ) : (
                            <span className="inline-flex min-w-[6.4rem] items-center justify-center justify-self-center rounded-xl border border-[#334155] bg-[#020617] px-3 py-2 text-center text-[8px] font-black uppercase tracking-[0.08em] text-[#64748b] max-xl:justify-self-start">
                              {isOpening ? 'Base' : (isReversal ? 'Reverso' : (entry.isVoidedOriginal ? 'Anulado' : 'Bloqueado'))}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ), document.body) : null}

      {cashHistoryOpen ? createPortal((
        <div className="fixed inset-0 z-[236] flex min-h-screen items-center justify-center bg-[#020617]/85 p-3 backdrop-blur-xl md:p-5">
          <div className="flex max-h-[calc(100vh-1rem)] w-full max-w-[min(96vw,86rem)] flex-col overflow-hidden rounded-[2rem] border border-[#475569] bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 text-[#f8fafc] shadow-[0_35px_120px_rgba(0,0,0,0.7)]">
            <div className="border-b border-[#1e293b] px-5 py-4 md:px-7">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#38bdf8]">Control de caja</p>
                  <h3 className="mt-1 text-3xl font-black uppercase italic tracking-tighter text-[#f8fafc]">Historial de cajas</h3>
                  <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Cierres, diferencias y usuarios responsables</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCashHistorySummaryCollapsed(false);
                    setCashHistoryOpen(false);
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#475569] bg-slate-950 text-[#67e8f9] transition-all hover:bg-[#111827]"
                  aria-label="Cerrar historial de caja"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={`grid grid-cols-2 gap-3 bg-slate-950/65 px-5 transition-all duration-300 md:grid-cols-4 md:border-b md:border-[#1e293b] md:px-7 md:py-3 ${cashHistorySummaryCollapsed ? 'max-md:max-h-0 max-md:overflow-hidden max-md:border-b-0 max-md:py-0 max-md:opacity-0' : 'max-md:max-h-[18rem] max-md:border-b max-md:border-[#1e293b] max-md:py-3 max-md:opacity-100'}`}>
              <div className="rounded-[1.3rem] border border-[#334155] bg-slate-950 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Cajas cerradas</p>
                <p className="mt-1 text-xl font-black italic text-[#34d399]">{cashHistoryRows.length}</p>
              </div>
              <div className="rounded-[1.3rem] border border-[#334155] bg-slate-950 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Ventas cerradas</p>
                <p className="mt-1 text-xl font-black italic text-[#38bdf8]">{formatCurrency(cashHistoryRows.reduce((total, row) => total + row.saleTotal, 0))}</p>
              </div>
              <div className="rounded-[1.3rem] border border-[#334155] bg-slate-950 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">POS / tarjeta</p>
                <p className="mt-1 text-xl font-black italic text-[#34d399]">{formatCurrency(cashHistoryRows.reduce((total, row) => total + row.cardTotal, 0))}</p>
              </div>
              <div className="rounded-[1.3rem] border border-[#334155] bg-slate-950 px-4 py-3">
                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#94a3b8]">Transferencias</p>
                <p className="mt-1 text-xl font-black italic text-[#34d399]">{formatCurrency(cashHistoryRows.reduce((total, row) => total + row.transferTotal, 0))}</p>
              </div>
            </div>

            <div
              className="flex-1 overflow-y-auto p-3 custom-scrollbar md:p-5"
              onScroll={(event) => {
                if (window.innerWidth >= 768) return;
                setCashHistorySummaryCollapsed(event.currentTarget.scrollTop > 12);
              }}
            >
              {cashHistoryRows.length === 0 ? (
                <div className="rounded-[1.8rem] border border-dashed border-[#475569] bg-slate-950/70 p-10 text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#94a3b8]">Todavía no hay cajas cerradas</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[1.8rem] border border-[#334155] bg-white">
                  <div className="grid grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_8rem_8rem_8rem_8rem_minmax(10rem,1fr)_8rem] gap-3 border-b border-[#1e293b] bg-[#020617] px-5 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-[#94a3b8] max-xl:hidden">
                    <span>Apertura</span>
                    <span>Cierre</span>
                    <span className="text-right">Esperado</span>
                    <span className="text-right">Contado</span>
                    <span className="text-right">Dif.</span>
                    <span className="text-right">Ventas</span>
                    <span>Usuarios</span>
                    <span className="text-right">Soporte</span>
                  </div>

                  <div className="divide-y divide-[#1e293b]">
                    {cashHistoryRows.map((row) => {
                      const openedLabel = row.openedAt
                        ? new Date(row.openedAt).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' })
                        : 'Sin apertura';
                      const closedLabel = row.closedAt
                        ? new Date(row.closedAt).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' })
                        : 'Sin cierre';
                      const balanced = Math.abs(row.difference) < 0.01;
                      return (
                        <div key={row.id} className={`grid gap-3 border-l-4 px-5 py-4 text-sm max-xl:grid-cols-1 xl:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_8rem_8rem_8rem_8rem_minmax(10rem,1fr)_8rem] xl:items-center ${balanced ? 'border-l-[#059669] bg-[#f8fffb]' : 'border-l-[#d65f7f] bg-[#fff6f8]'}`}>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#94a3b8] xl:hidden">Apertura</p>
                            <p className="font-black text-[#f8fafc]">{openedLabel}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#94a3b8] xl:hidden">Cierre</p>
                            <p className="font-black text-[#f8fafc]">{closedLabel}</p>
                          </div>
                          <p className="text-right font-black italic text-[#34d399] max-xl:text-left">{formatCurrency(row.expectedCash)}</p>
                          <p className="text-right font-black italic text-[#f8fafc] max-xl:text-left">{formatCurrency(row.countedCash)}</p>
                          <p className={`text-right font-black italic max-xl:text-left ${balanced ? 'text-[#34d399]' : 'text-[#fb7185]'}`}>{formatCurrency(row.difference)}</p>
                          <div className="text-right max-xl:text-left">
                            <p className="font-black italic text-[#38bdf8]">{formatCurrency(row.saleTotal)}</p>
                            <p className="mt-1 text-[8px] font-black uppercase tracking-[0.12em] text-[#94a3b8]">{row.saleCount} ventas · {row.movementCount} mov.</p>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-[#67e8f9]">Abrió: {row.openedByLabel}</p>
                            <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.1em] text-[#94a3b8]">Cerró: {row.closedByLabel}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onPrintCashClosure?.(row)}
                            className="flex items-center justify-center gap-2 justify-self-end rounded-2xl border border-[#059669]/45 bg-[#052e2b] px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-[#34d399] transition-all hover:bg-[#064e3b] active:scale-95 max-xl:justify-self-start"
                          >
                            <ReceiptText size={14} /> Ver
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ), document.body) : null}

      {ticketOpen && cart.length > 0 ? createPortal((
        <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/75 p-2 backdrop-blur-sm xl:items-center">
          <div className="max-h-[calc(100vh-0.25rem)] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#475569] bg-[#020617] text-[#f8fafc] shadow-[0_30px_120px_rgba(143,45,91,0.28)] xl:max-w-7xl">
            <div className="flex items-center justify-between gap-4 border-b border-[#334155] px-6 py-3.5 md:px-8">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/40">
                  <ShoppingBag size={22} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter text-[#f8fafc]">Ticket de venta</h3>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">Aplica promociones guardadas antes de completar la venta</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPromotionPickerOpen(false);
                  setTicketOpen(false);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#475569] bg-slate-950 text-[#94a3b8] transition-colors hover:bg-[#111827] hover:text-[#67e8f9]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_32rem]">
              <div className="max-h-[calc(100vh-6.25rem)] overflow-y-auto border-b border-[#334155] bg-white/45 p-4 md:p-5 xl:border-b-0 xl:border-r custom-scrollbar">
                <div className="space-y-4">
                  {cart.map((item) => (
                    <CartLine key={item.id} item={item} onRemove={removeItem} />
                  ))}
                </div>
              </div>

              <div className="flex max-h-[calc(100vh-6.25rem)] flex-col bg-[#020617] p-3.5 md:p-4">
                <div className="mb-2.5 rounded-[1.25rem] border border-emerald-500/20 bg-slate-950 p-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Promociones</p>
                      <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[#94a3b8]">
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

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPromotionPickerOpen(true)}
                      disabled={savedPromotions.length === 0}
                      className={`inline-flex items-center gap-2 rounded-[1rem] border px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.16em] transition-all ${savedPromotions.length > 0 ? 'border-[#b9dccd] bg-[#052e2b] text-[#34d399] hover:border-[#059669] hover:bg-[#e2f3ec]' : 'cursor-not-allowed border-[#ead4dd] bg-[#111827] text-[#64748b] opacity-70'}`}
                    >
                      Elegir promoción
                      <ChevronDown size={16} className="text-current" />
                    </button>

                    {selectedPromotion ? (
                      <button
                        type="button"
                        onClick={() => setSelectedPromotionId('')}
                        className="rounded-[1rem] border border-[#475569] bg-[#111827] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.16em] text-[#fb7185] transition-all hover:border-[#4f46e5]"
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

                <div className="mb-2.5 rounded-[1.25rem] border border-[#475569] bg-slate-950 px-4 py-2.5 text-[#f8fafc]">
                  <div className="flex justify-between items-center"><span className="text-[#94a3b8] text-[9px] font-black uppercase tracking-widest leading-none">Subtotal</span><span className="text-sm font-black italic">C$ {subtotal.toLocaleString('es-NI')}</span></div>
                  {selectedPromotion ? <div className="mt-2 flex justify-between items-center"><span className="text-[#34d399] text-[9px] font-black uppercase tracking-widest leading-none">{selectedPromotion.name}</span><span className="text-sm font-black italic text-[#34d399]">- C$ {promotionDiscount.toLocaleString('es-NI')}</span></div> : null}
                  <div className="mt-2 flex justify-between items-end border-t border-[#334155] pt-2"><span className="text-[#94a3b8] text-[9px] font-black uppercase tracking-widest leading-none">Monto Total</span><span className="text-3xl font-black italic tracking-tighter leading-none text-[#f8fafc]">C$ {totalToCharge.toLocaleString('es-NI')}</span></div>
                </div>

                <div className="mb-2.5 rounded-[1.25rem] border border-[#475569] bg-[#020617] p-2.5 shadow-[0_12px_28px_rgba(196,74,126,0.08)]">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">Cliente</p>
                    <label className="flex items-center gap-2 rounded-full border border-[#334155] bg-slate-950 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-[#cbd5e1]">
                      <input
                        type="checkbox"
                        checked={genericClientSale}
                        onChange={(event) => {
                          setGenericClientSale(event.target.checked);
                          if (event.target.checked) {
                            setSelectedClientId('');
                            setClientSearch('');
                            setClientPickerOpen(false);
                          }
                        }}
                        className="h-3 w-3 accent-[#059669]"
                      />
                      Genérico
                    </label>
                  </div>
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                    <input
                      type="text"
                      value={genericClientSale ? 'CLIENTE GENÉRICO' : clientSearch}
                      disabled={genericClientSale}
                      onChange={(event) => {
                        setClientSearch(event.target.value);
                        setSelectedClientId('');
                        setGenericClientSale(false);
                        setClientPickerOpen(true);
                      }}
                      onFocus={() => {
                        if (!genericClientSale) setClientPickerOpen(true);
                      }}
                      onBlur={() => {
                        window.setTimeout(() => setClientPickerOpen(false), 120);
                      }}
                      placeholder={selectedClient ? selectedClient.name : 'Buscar cliente por nombre o celular'}
                      className="w-full rounded-2xl border border-[#334155] bg-slate-950 px-11 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#f8fafc] outline-none transition-all placeholder:text-[#64748b] disabled:opacity-60 focus:border-[#4f46e5] focus:shadow-[0_0_0_3px_rgba(217,79,131,0.08)]"
                    />
                    {!genericClientSale && (selectedClientId || clientSearch) ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedClientId('');
                          setClientSearch('');
                          setClientPickerOpen(false);
                        }}
                        className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-xl text-[#94a3b8] transition-colors hover:bg-[#111827] hover:text-[#67e8f9]"
                      >
                        <X size={14} />
                      </button>
                    ) : null}

                    {clientPickerOpen && !genericClientSale ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-30 max-h-56 overflow-y-auto rounded-2xl border border-[#475569] bg-slate-950 shadow-[0_18px_45px_rgba(143,45,91,0.18)] custom-scrollbar">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClientId('');
                            setClientSearch('');
                            setClientPickerOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-3 border-b border-[#1e293b] px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.1em] transition-colors hover:bg-[#020617] ${selectedClientId ? 'text-[#94a3b8]' : 'bg-[#020617] text-[#67e8f9]'}`}
                        >
                          Sin cliente asignado
                          {!selectedClientId ? <Check size={14} /> : null}
                        </button>

                        {filteredTicketClients.length > 0 ? filteredTicketClients.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => {
                              setSelectedClientId(client.id);
                              setClientSearch(client.name || client.phone || 'Cliente');
                              setGenericClientSale(false);
                              setClientPickerOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-3 border-b border-[#1e293b] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#020617] ${String(selectedClientId) === String(client.id) ? 'bg-[#111827]' : 'bg-white'}`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[10px] font-black uppercase tracking-[0.1em] text-[#f8fafc]">{client.name || 'Cliente sin nombre'}</span>
                              <span className="mt-1 block truncate text-[8px] font-black uppercase tracking-[0.12em] text-[#94a3b8]">{client.phone || 'Sin celular'}</span>
                            </span>
                            {String(selectedClientId) === String(client.id) ? <Check size={14} className="shrink-0 text-[#4f46e5]" /> : null}
                          </button>
                        )) : (
                          <div className="px-4 py-4 text-[9px] font-black uppercase tracking-[0.14em] text-[#64748b]">
                            No hay clientes con esa búsqueda.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mb-2.5 rounded-[1.25rem] border border-[#475569] bg-[#020617] p-2.5 shadow-[0_12px_28px_rgba(196,74,126,0.08)]">
                  <p className="mb-2 text-[9px] font-black uppercase tracking-[0.18em] text-[#94a3b8]">Método de pago</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'cash', label: 'Efectivo', icon: DollarSign },
                      { id: 'card', label: 'Tarjeta', icon: CreditCard },
                      { id: 'transfer', label: 'Transferencia', icon: Wallet },
                    ].map((method) => {
                      const Icon = method.icon;
                      const active = paymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id)}
                          className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5 text-[8px] font-black uppercase tracking-[0.12em] transition-all active:scale-95 ${active ? 'border-[#059669] bg-[#059669] text-white shadow-[0_10px_20px_rgba(114,183,155,0.24)]' : 'border-[#334155] bg-slate-950 text-[#cbd5e1] hover:border-[#4f46e5] hover:bg-[#111827] hover:text-[#67e8f9]'}`}
                        >
                          <Icon size={14} />
                          {method.label}
                        </button>
                      );
                    })}
                  </div>
                  {paymentMethod === 'cash' ? (
                    <div className="mt-2 rounded-[1.2rem] border border-[#334155] bg-slate-950 p-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCashPaymentCurrency('NIO')}
                          className={`rounded-2xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] transition-all ${cashPaymentCurrency === 'NIO' ? 'bg-[#059669] text-white' : 'border border-[#475569] text-[#cbd5e1]'}`}
                        >
                          Paga C$
                        </button>
                        <button
                          type="button"
                          onClick={() => setCashPaymentCurrency('USD')}
                          className={`rounded-2xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] transition-all ${cashPaymentCurrency === 'USD' ? 'bg-[#059669] text-white' : 'border border-[#475569] text-[#cbd5e1]'}`}
                        >
                          Paga US$
                        </button>
                      </div>

                      {cashPaymentCurrency === 'NIO' ? (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={nioReceived}
                            onChange={(event) => setNioReceived(event.target.value)}
                            placeholder="C$ recibido"
                            className="rounded-2xl border border-[#475569] bg-[#0f172a] px-4 py-2.5 text-sm font-black outline-none focus:border-[#4f46e5]"
                          />
                          <div className={`rounded-2xl border px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] ${nioPaymentIsEnough ? 'border-[#059669] bg-[#052e2b] text-[#a7f3d0]' : 'border-[#4f46e5] bg-[#111827] text-[#fecdd3]'}`}>
                            <p className="text-[#f8fafc]">Cliente paga: {formatCurrency(nioReceivedAmount)}</p>
                            <p className={nioPaymentIsEnough ? 'text-[#2f6f5a]' : 'text-[#c0255a]'}>
                              {nioPaymentIsEnough ? `Vuelto sugerido: ${formatCurrency(nioChangeNio)}` : `Faltan: ${formatCurrency(Math.max(totalToCharge - nioReceivedAmount, 0))}`}
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {cashPaymentCurrency === 'USD' ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={usdReceived}
                            onChange={(event) => setUsdReceived(event.target.value)}
                            placeholder="US$ recibido"
                            className="rounded-2xl border border-[#475569] bg-[#0f172a] px-4 py-3 text-sm font-black outline-none focus:border-[#4f46e5]"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={saleExchangeRate}
                            onChange={(event) => setSaleExchangeRate(event.target.value)}
                            placeholder="Tasa"
                            className="rounded-2xl border border-[#475569] bg-[#0f172a] px-4 py-3 text-sm font-black outline-none focus:border-[#4f46e5]"
                          />
                          <div className={`col-span-2 rounded-2xl border px-4 py-3 text-[9px] font-black uppercase tracking-[0.12em] ${usdPaymentIsEnough ? 'border-[#059669] bg-[#052e2b] text-[#a7f3d0]' : 'border-[#4f46e5] bg-[#111827] text-[#fecdd3]'}`}>
                            <p className="text-[#f8fafc]">Recibido equivalente: {formatCurrency(usdReceivedEquivalent)}</p>
                            <p className={usdPaymentIsEnough ? 'text-[#2f6f5a]' : 'text-[#c0255a]'}>
                              {usdPaymentIsEnough ? `Vuelto sugerido C$: ${usdChangeNio.toLocaleString('es-NI')}` : 'El monto recibido no cubre el total'}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {!cashSession ? (
                  <p className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">
                    Abre caja antes de completar la venta.
                  </p>
                ) : null}

                <div className="mt-auto border-t border-[#334155] pt-3">
                  <button disabled={cart.length === 0 || !cashSession || !cashPaymentIsEnough} onClick={handleCompleteSale} className="w-full bg-[#4f46e5] hover:bg-[#4338ca] disabled:bg-[#1e293b] disabled:text-[#94a3b8] disabled:shadow-none py-3.5 rounded-[1.35rem] font-black uppercase italic text-xs shadow-[0_16px_34px_rgba(217,79,131,0.28)] active:scale-95 transition-all text-white flex items-center justify-center gap-3"><Check size={18} strokeWidth={3} /> COMPLETAR VENTA</button>
                </div>
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
      ), document.body) : null}
    </div>
  );
}

