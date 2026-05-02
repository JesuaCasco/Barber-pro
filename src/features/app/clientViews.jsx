import React, { useMemo, useState } from 'react';
import {
  Award,
  CalendarCheck,
  CalendarDays,
  Crown,
  Edit2,
  Gift,
  Medal,
  Phone,
  Plus,
  Save,
  Scissors,
  Search,
  Star,
  User,
  UserCheck,
  X,
} from 'lucide-react';

import {
  formatPhoneNumber,
  getClientInsights,
  getPhoneDigits,
  getTodayString,
} from './shared';

export function ClientsTableView({ clients, appointments, barbers, onRowClick, onNewApt }) {
  const [search, setSearch] = useState('');
  const tableData = useMemo(() => {
    return (clients || []).map((client) => {
      const insights = getClientInsights(client, appointments, clients, barbers, {
        emptyFavoriteBarber: 'N/A',
      });
      const visits = Number(insights.completedVisits || 0);
      const totalSpent = Number(insights.totalSpent || 0);
      const favBarber = insights.favoriteBarberName || 'N/A';
      const lastVisit = insights.lastVisitAt || 'N/A';
      let type = { label: 'Bronce', color: 'text-white', bg: 'bg-orange-500', border: 'border-white' };
      if (visits >= 10) type = { label: 'Oro', color: 'text-yellow-950', bg: 'bg-yellow-400', border: 'border-yellow-600' };
      else if (visits >= 5) type = { label: 'Plata', color: 'text-slate-950', bg: 'bg-slate-100', border: 'border-white' };
      return { ...client, visits, spent: totalSpent, favBarber, type, lastVisit };
    });
  }, [clients, appointments, barbers]);

  const duplicatePhones = useMemo(() => {
    const phoneCounts = new Map();
    tableData.forEach((client) => {
      const digits = getPhoneDigits(client.phone);
      if (digits.length === 8) {
        phoneCounts.set(digits, (phoneCounts.get(digits) || 0) + 1);
      }
    });
    return [...phoneCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([digits]) => formatPhoneNumber(digits));
  }, [tableData]);

  const filtered = useMemo(() => {
    const phoneQuery = getPhoneDigits(search);
    return tableData.filter((client) =>
      client.name.toLowerCase().includes(search.toLowerCase())
      || (phoneQuery.length > 0 && getPhoneDigits(client.phone).includes(phoneQuery))
    );
  }, [tableData, search]);

  const downloadClientsReport = () => {
    if (!tableData.length) return;

    const escapeCsv = (value) => `"${`${value ?? ''}`.replace(/"/g, '""')}"`;
    const rows = tableData.map((client) => ([
      client.name,
      client.phone,
      client.type.label,
      client.visits,
      client.favBarber,
      client.lastVisit,
    ].map(escapeCsv).join(',')));

    const csv = `\uFEFFsep=,\r\n${['Cliente', 'Celular', 'Tipo', 'Visitas', 'Barbero favorito', 'Última visita'].map(escapeCsv).join(',')}\r\n${rows.join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-clientes-${getTodayString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="p-3 md:p-10 space-y-5 md:space-y-8 animate-in fade-in text-white no-print">
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-4 text-white">
        <div>
          <h3 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter leading-none text-white">Directorio de Clientes</h3>
          <p className="mobile-simplify-subtitle text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-1 italic leading-none">Gestión VIP y Fidelización</p>
        </div>
        <div className="flex w-full xl:w-auto flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 text-white">
          <button onClick={downloadClientsReport} disabled={!tableData.length} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase italic tracking-widest shadow-xl shadow-emerald-950/30 transition-all flex items-center justify-center gap-2 leading-none">
            <Save size={16} /> Exportar Excel
          </button>
          <div className="relative text-white w-full xl:w-auto">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input type="text" placeholder="BUSCAR POR NOMBRE O CELULAR" className="bg-black border border-slate-800 rounded-2xl pl-5 pr-16 py-4 text-sm font-bold w-full xl:w-96 outline-none focus:border-indigo-600 transition-all text-white italic leading-none placeholder:text-slate-500" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
      </div>
      {duplicatePhones.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 px-6 py-4 rounded-2xl text-amber-300 text-[11px] font-black uppercase italic tracking-wide leading-relaxed">
          Números repetidos detectados: {duplicatePhones.join(', ')}. El celular ahora es único, así que conviene editar o eliminar esos duplicados guardados.
        </div>
      )}
      <div className="lg:hidden space-y-4">
        {filtered.map((client) => (
          <div key={client.id} onClick={() => onRowClick(client)} className="rounded-[2rem] border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 shrink-0 bg-indigo-600/20 border border-indigo-600/30 rounded-2xl flex items-center justify-center font-black italic text-xl text-indigo-300">
                {client.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-black uppercase italic tracking-tighter text-white leading-none break-words">{client.name}</p>
                <p className="mt-2 text-xs font-bold text-slate-400">{client.phone}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`${client.type.bg} ${client.type.color} px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${client.type.border}`}>{client.type.label}</span>
                  <span className="px-4 py-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-[10px] font-black uppercase tracking-widest text-indigo-300">{client.visits} visitas</span>
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-3 rounded-[1.5rem] border border-white/5 bg-black/20 p-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Barbero favorito</p>
                <p className="mt-1 text-sm font-black italic text-white">{client.favBarber}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Última visita</p>
                <p className="mt-1 text-sm font-bold text-slate-300">{client.lastVisit}</p>
              </div>
            </div>
            <button onClick={(event) => { event.stopPropagation(); onNewApt(client); }} className="mt-4 w-full rounded-[1.4rem] bg-indigo-600 px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all">
              Nueva cita
            </button>
          </div>
        ))}
      </div>
      <div className="hidden lg:block bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-black/80 border-b border-slate-800 font-black uppercase text-[10px] text-slate-500 tracking-[0.2em] italic">
            <tr><th className="px-10 py-7">Cliente</th><th className="px-10 py-7 text-center">Tipo</th><th className="px-10 py-7 text-center">Visitas</th><th className="px-10 py-7 text-center">Barbero Fav</th><th className="px-10 py-7 text-center">Última Visita</th><th className="px-10 py-7 text-right">Acción</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filtered.map((client) => (
              <tr key={client.id} onClick={() => onRowClick(client)} className="hover:bg-indigo-600/[0.08] cursor-pointer transition-colors group text-white">
                <td className="px-10 py-6"><div className="flex items-center gap-4 text-white"><div className="w-12 h-12 bg-indigo-600/20 border border-indigo-600/30 rounded-xl flex items-center justify-center font-black italic text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg text-white">{client.name[0]}</div><div className="flex flex-col"><span className="text-base font-black uppercase italic tracking-tighter text-white leading-none">{client.name}</span><span className="text-[10px] text-slate-500 mt-1 font-bold leading-none">{client.phone}</span></div></div></td>
                <td className="px-10 py-6 text-center text-white"><span className={`${client.type.bg} ${client.type.color} px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border-2 ${client.type.border} shadow-lg leading-none inline-flex items-center justify-center min-w-[112px]`}>{client.type.label}</span></td>
                <td className="px-10 py-6 text-center font-black text-indigo-400 leading-none text-lg">{client.visits}</td>
                <td className="px-10 py-6 text-center text-slate-300 font-bold italic text-sm leading-none">{client.favBarber}</td>
                <td className="px-10 py-6 text-center text-slate-400 font-bold text-xs italic leading-none">{client.lastVisit}</td>
                <td className="px-10 py-6 text-right text-white"><button onClick={(event) => { event.stopPropagation(); onNewApt(client); }} className="p-3.5 bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white rounded-xl transition-all shadow-xl active:scale-95 text-white"><CalendarDays size={20} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ClientDetailModal({ client, clients, appointments, barbers, onClose, onEdit, onNewApt }) {
  const stats = useMemo(() => {
    const insights = getClientInsights(client, appointments, clients, barbers, {
      emptyFavoriteBarber: 'SIN REGISTRO',
      emptyFavoriteService: 'NINGUNO',
      historyLimit: 10,
    });
    const totalVisits = Number(insights.completedVisits || 0);
    const totalSpent = Number(insights.totalSpent || 0);
    const favBarberVal = insights.favoriteBarberName || 'SIN REGISTRO';
    const favServiceVal = insights.favoriteServiceName || 'NINGUNO';
    const lastVisitDateVal = insights.lastVisitAt || 'N/A';
    const rewardVisitsGoal = 10;
    const progressTowardRewardRaw = totalVisits % rewardVisitsGoal;
    const progressTowardReward = totalVisits > 0 && progressTowardRewardRaw === 0
      ? rewardVisitsGoal
      : progressTowardRewardRaw;
    let type = { label: 'Bronce', icon: Medal, color: 'text-orange-950', bg: 'bg-orange-500', border: 'border-orange-200' };
    if (totalVisits >= 10) type = { label: 'Oro', icon: Crown, color: 'text-yellow-950', bg: 'bg-yellow-400', border: 'border-yellow-100' };
    else if (totalVisits >= 5) type = { label: 'Plata', icon: Award, color: 'text-slate-950', bg: 'bg-slate-100', border: 'border-white' };

    return {
      totalSpent,
      favBarber: favBarberVal,
      favService: favServiceVal,
      totalVisits,
      type,
      lastVisitDate: lastVisitDateVal,
      progressTowardReward,
      rewardVisitsGoal,
    };
  }, [client, clients, appointments, barbers]);
  const TypeIcon = stats.type.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in text-white overflow-hidden no-print">
      <div className="bg-slate-950 w-full max-w-6xl rounded-[2rem] md:rounded-[3rem] shadow-2xl border border-slate-800 animate-in zoom-in-95 h-[92vh] flex flex-col text-white overflow-hidden">
        <div className="flex flex-col md:flex-row h-full text-white overflow-hidden rounded-[2rem] md:rounded-[3rem]">
          <div className="w-full md:w-[34%] bg-black p-5 md:p-9 border-b md:border-b-0 md:border-r border-slate-900 flex flex-col items-center text-center text-white overflow-y-auto custom-scrollbar rounded-t-[2rem] md:rounded-l-[3rem] md:rounded-tr-none">
            <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-2xl mb-4 relative text-white">
              <User size={52} /><div className={`absolute -bottom-2 -right-2 p-2.5 rounded-2xl border shadow-lg ${stats.type.bg} ${stats.type.border} text-white`}><TypeIcon size={22} className={stats.type.color} /></div>
            </div>
            <div className={`border-2 px-6 py-2.5 rounded-2xl mb-3 ${stats.type.bg} ${stats.type.border} text-white`}><span className={`text-[11px] font-black uppercase italic tracking-[0.22em] ${stats.type.color}`}>CLIENTE {stats.type.label}</span></div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-3 text-white leading-none break-words">{client.name}</h3>
            <div className="bg-slate-900 border border-slate-800 px-5 py-3 rounded-2xl mb-3 flex items-center gap-3 text-white">
              <Phone size={18} className="text-indigo-400" />
              <span className="text-[12px] font-black text-slate-300 uppercase italic leading-none">Celular: {client.phone || 'Sin registrar'}</span>
            </div>
            <div className="bg-slate-900 border px-4 py-2 rounded-xl mb-5 flex items-center gap-2 text-white"><CalendarCheck size={14} className="text-emerald-400" /><span className="text-[10px] font-black text-slate-300 uppercase italic leading-none">Última Visita: {stats.lastVisitDate}</span></div>

            <div className="w-full bg-slate-900/60 p-4 rounded-[1.5rem] border border-indigo-500/20 mb-5 text-white">
              <div className="flex justify-between items-center mb-3 text-white"><span className="text-[9px] font-black text-indigo-400 uppercase italic tracking-widest flex items-center gap-2 leading-none"><Gift size={13} /> PROGRESO VIP</span><span className="text-[9px] font-black text-white italic leading-none">{stats.progressTowardReward} / {stats.rewardVisitsGoal}</span></div>
              <div className="flex gap-1.5 h-2.5 bg-black rounded-full overflow-hidden p-0.5 text-white">{[...Array(stats.rewardVisitsGoal)].map((_, index) => (<div key={index} className={`flex-1 rounded-full ${index < stats.progressTowardReward ? 'bg-indigo-500' : 'bg-slate-800'}`}></div>))}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full text-white">
              <div className="bg-slate-900 p-4 rounded-[1.5rem] flex flex-col items-center justify-center text-white border border-white/5"><p className="text-[8px] font-black text-slate-500 uppercase italic leading-none">VISITAS</p><h4 className="text-2xl font-black italic text-white leading-none mt-1">{stats.totalVisits}</h4></div>
              <div className="bg-slate-900 p-4 rounded-[1.5rem] flex flex-col items-center justify-center text-white border border-white/5"><p className="text-[8px] font-black text-slate-500 uppercase italic leading-none">GASTADO</p><h4 className="text-lg font-black text-emerald-400 italic mt-1 leading-none">C$ {stats.totalSpent}</h4></div>
            </div>
          </div>

          <div className="flex-1 p-5 md:p-8 flex flex-col bg-slate-950/50 text-white overflow-hidden text-white">
            <div className="flex-1 flex min-h-0 flex-col justify-center text-white md:translate-y-8">
            <div className="flex justify-between items-start mb-5 text-white">
              <div className="flex items-center gap-3 text-white">
                <Star size={24} className="text-amber-400 fill-amber-400" />
                <h4 className="text-xl font-black uppercase italic text-white tracking-tighter leading-none">DATOS DE LEALTAD</h4>
              </div>
              <button onClick={onClose} className="p-2.5 bg-slate-900 rounded-2xl text-slate-400 hover:text-rose-500 transition-all text-white"><X size={22} /></button>
            </div>

            <div className="overflow-y-auto custom-scrollbar pr-1">
              <div className="w-full space-y-4">
                <div className="space-y-3">
                  <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-[1.8rem] flex items-center justify-between gap-4 group hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 bg-indigo-600/10 rounded-2xl flex shrink-0 items-center justify-center text-indigo-400 border border-indigo-500/20">
                        <Scissors size={20} />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase italic tracking-[0.16em]">Servicio Favorito</span>
                    </div>
                    <span className="text-base font-black text-white uppercase italic tracking-tighter text-right">{stats.favService}</span>
                  </div>

                  <div className="bg-slate-900/40 border border-amber-500/20 p-4 rounded-[1.8rem] flex items-center justify-between gap-4 group hover:border-amber-500/40 transition-all">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 bg-amber-500/10 rounded-2xl flex shrink-0 items-center justify-center text-amber-500 border border-amber-500/20">
                        <UserCheck size={20} />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase italic tracking-[0.16em]">Barbero Favorito</span>
                    </div>
                    <span className="text-base font-black text-white uppercase italic tracking-tighter text-right">{stats.favBarber}</span>
                  </div>
                </div>

                <div className="pt-3 space-y-3">
                  <div className="flex items-center gap-3 px-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                    <label className="text-[10px] font-black text-indigo-400 uppercase italic tracking-[0.3em] leading-none">NOTAS TÉCNICAS DEL CLIENTE</label>
                  </div>

                  <div className="bg-black/40 border border-white/5 p-5 rounded-[1.8rem] shadow-inner relative overflow-hidden group min-h-[92px]">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
                    <p className="italic text-white text-sm leading-relaxed text-slate-200">
                      {client.notes || 'No hay notas técnicas registradas para este cliente. Utiliza el botón de editar para añadir preferencias de corte.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
              <button onClick={onNewApt} className="bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-2xl font-black uppercase italic text-[10px] transition-all flex items-center justify-center gap-3 text-white">
                <Plus size={18} /> NUEVA CITA
              </button>
              <button onClick={onEdit} className="bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-black uppercase italic text-[10px] transition-all flex items-center justify-center gap-3 text-white">
                <Edit2 size={16} /> EDITAR PERFIL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
