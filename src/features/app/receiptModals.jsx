import React, { useState } from 'react';
import { Loader2, Printer, HandCoins } from 'lucide-react';

const noopConfirm = async () => false;

export function PaymentReceiptModal({ data, onClose, onConfirmPayment, confirmAction = noopConfirm }) {
  if (!data) return null;
  const { barber, nomina } = data;
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  const legalName = barber.fullName || barber.name;
  const legalId = barber.cedula?.trim() || `ID STAFF ${barber.id}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-white text-black w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh]">
        <div className="p-10 overflow-y-auto custom-scrollbar" id="printable-receipt">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black uppercase italic tracking-widest text-slate-900">BarberSoft</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Comprobante Oficial de Pago de Nómina</p>
            <div className="h-0.5 w-16 bg-indigo-600 mx-auto mt-4"></div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Nombre Completo:</span>
              <span className="font-black uppercase italic text-sm text-right">{legalName}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Cédula / Identificación:</span>
              <span className="font-bold text-sm text-right">{legalId}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Nombre Comercial:</span>
              <span className="font-bold text-sm text-right">{barber.name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Fecha de Emisión:</span>
              <span className="font-bold text-sm">{hoy}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-[2rem] space-y-3 mb-10">
            <div className="flex justify-between text-slate-600">
              <span className="text-[10px] font-black uppercase">Salario Base:</span>
              <span className="font-bold">C$ {nomina.base.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600 border-b border-slate-200 pb-3">
              <span className="text-[10px] font-black uppercase">Comisiones Generadas:</span>
              <span className="font-bold">C$ {nomina.comission.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-xs font-black uppercase text-slate-900">Total Neto Pagado:</span>
              <span className="text-2xl font-black text-indigo-600 italic tracking-tighter">C$ {nomina.total.toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-20 grid grid-cols-2 gap-12 text-center no-print-section">
            <div className="border-t border-slate-300 pt-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Administración</p>
            </div>
            <div className="border-t border-slate-300 pt-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Firma del Barbero</p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <p className="text-[8px] text-slate-400 italic font-medium leading-relaxed">
              Al firmar este documento, el barbero acepta que ha recibido la cantidad estipulada <br />
              en concepto de sus honorarios por el periodo correspondiente.
            </p>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col gap-3 no-print">
          <button
            onClick={async () => {
              const confirmed = await confirmAction({
                title: 'Confirmar pago',
                message: `¿Confirmas que has entregado C$ ${nomina.total.toLocaleString()} a ${legalName}? Esta acción liquidará las comisiones acumuladas.`,
                confirmLabel: 'Confirmar pago',
              });
              if (confirmed) {
                onConfirmPayment(barber.id);
              }
            }}
            className="w-full px-6 py-4 bg-indigo-600 text-white font-black uppercase italic text-[11px] rounded-2xl shadow-xl shadow-indigo-900/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <HandCoins size={18} /> CONFIRMAR Y LIQUIDAR PAGO
          </button>
          <div className="flex gap-4">
            <button onClick={onClose} className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-400 font-black uppercase italic text-[10px] rounded-2xl hover:bg-slate-100 transition-all">Cancelar</button>
            <button onClick={handlePrint} className="flex-1 px-6 py-4 bg-emerald-600 text-white font-black uppercase italic text-[10px] rounded-2xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
              <Printer size={16} /> Imprimir Comprobante
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PosSaleReceiptModal({ data, onClose, onCancelSale, confirmAction = noopConfirm }) {
  const [isCancelling, setIsCancelling] = useState(false);
  if (!data?.sale) return null;

  const { sale, barbershopName, branchName } = data;
  const saleDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
  const issuedDate = saleDate.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const ticketNumber = String(Number(sale.ticketNumber || 0)).padStart(6, '0');

  const handlePrint = () => {
    window.print();
  };

  const handleCancelSale = async () => {
    if (isCancelling) return;

    const confirmed = await confirmAction({
      title: 'Cancelar venta',
      message: `¿Deseas cancelar la venta del ticket ${ticketNumber}? Esta acción eliminará el registro de la venta.`,
      confirmLabel: 'Cancelar venta',
      cancelLabel: 'Volver',
    });

    if (confirmed) {
      setIsCancelling(true);
      try {
        await onCancelSale?.(sale.id);
      } finally {
        setIsCancelling(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-white text-black w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh]">
        <div className="p-10 overflow-y-auto custom-scrollbar" id="printable-receipt">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black uppercase italic tracking-widest text-slate-900">{barbershopName || 'BarberSoft'}</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Ticket de Venta POS</p>
            <div className="h-0.5 w-16 bg-emerald-600 mx-auto mt-4"></div>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Barbería:</span>
              <span className="font-black uppercase italic text-sm text-right">{barbershopName || 'Sin nombre'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Sucursal:</span>
              <span className="font-bold text-sm text-right">{branchName || 'General'}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Ticket:</span>
              <span className="font-bold text-sm text-right">{ticketNumber}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2">
              <span className="text-slate-500 text-[10px] font-black uppercase">Fecha:</span>
              <span className="font-bold text-sm">{issuedDate}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-[2rem] mb-8">
            <div className="space-y-4">
              {(sale.items || []).map((item, index) => (
                <div key={`${item.id || item.name}-${index}`} className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                  <div>
                    <p className="text-sm font-black uppercase italic text-slate-900">{item.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                      {item.category || 'Producto'} • {item.qty} x C$ {Number(item.price || 0).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm font-black text-slate-900">C$ {(Number(item.price || 0) * Number(item.qty || 0)).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-[2rem] space-y-3 mb-6">
            {Number(sale.rawSubtotal || 0) > 0 ? (
              <div className="flex justify-between text-slate-600">
                <span className="text-[10px] font-black uppercase">Subtotal base:</span>
                <span className="font-bold">C$ {Number(sale.rawSubtotal || 0).toLocaleString()}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-slate-600">
              <span className="text-[10px] font-black uppercase">Servicios:</span>
              <span className="font-bold">C$ {Number(sale.serviceTotal || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600 border-b border-slate-200 pb-3">
              <span className="text-[10px] font-black uppercase">Productos:</span>
              <span className="font-bold">C$ {Number(sale.productTotal || 0).toLocaleString()}</span>
            </div>
            {Number(sale.discountTotal || 0) > 0 ? (
              <div className="flex justify-between text-emerald-700 border-b border-slate-200 pb-3">
                <span className="text-[10px] font-black uppercase">
                  {sale.discountLabel || sale.promotionName ? `${sale.discountLabel || sale.promotionName}` : 'Descuento'}
                </span>
                <span className="font-bold">- C$ {Number(sale.discountTotal || 0).toLocaleString()}</span>
              </div>
            ) : null}
            <div className="flex justify-between pt-2">
              <span className="text-xs font-black uppercase text-slate-900">Total Pagado:</span>
              <span className="text-2xl font-black text-emerald-600 italic tracking-tighter">C$ {Number(sale.subtotal || 0).toLocaleString()}</span>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[8px] text-slate-400 italic font-medium leading-relaxed">
              Gracias por su compra. Este ticket sirve como comprobante interno de la venta registrada.
            </p>
          </div>
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 no-print">
          <button
            onClick={handleCancelSale}
            disabled={isCancelling}
            className="flex-1 px-6 py-4 bg-rose-50 border border-rose-200 text-rose-500 font-black uppercase italic text-[10px] rounded-2xl hover:bg-rose-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCancelling ? <Loader2 size={16} className="animate-spin" /> : null}
            {isCancelling ? 'Cancelando...' : 'Cancelar venta'}
          </button>
          <button
            onClick={onClose}
            disabled={isCancelling}
            className="flex-1 px-6 py-4 bg-white border border-slate-200 text-slate-500 font-black uppercase italic text-[10px] rounded-2xl hover:bg-slate-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Aceptar
          </button>
          <button
            onClick={handlePrint}
            disabled={isCancelling}
            className="flex-1 px-6 py-4 bg-emerald-600 text-white font-black uppercase italic text-[10px] rounded-2xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Printer size={16} /> Imprimir Ticket
          </button>
        </div>
      </div>
    </div>
  );
}

export function StaffSettlementModal({ data, onClose, onConfirmSettlement, confirmAction = noopConfirm }) {
  if (!data) return null;

  const { rows = [], summary } = data;
  const hoy = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  const handlePrint = () => {
    window.print();
  };

  const handleConfirm = async () => {
    if (!rows.length) return;
    const confirmed = await confirmAction({
      title: 'Liquidar planilla',
      message: `¿Confirmas que deseas liquidar C$ ${summary.total.toLocaleString()} a todo el staff? Esta acción marcará como pagadas todas las citas finalizadas pendientes.`,
      confirmLabel: 'Liquidar',
    });
    if (confirmed) {
      onConfirmSettlement(rows.map((row) => row.barber.id));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-white text-black w-full max-w-7xl rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh]">
        <div className="p-4 md:p-10 overflow-y-auto custom-scrollbar" id="printable-staff-settlement">
          <div className="flex items-start justify-between gap-6 mb-8">
            <div>
              <h2 className="text-3xl font-black uppercase italic tracking-widest text-slate-900">BarberSoft</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Planilla Consolidada de Liquidación de Nómina</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase text-slate-400">Fecha de Emisión</p>
              <p className="text-sm font-bold">{hoy}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 mt-4">Staff Incluido</p>
              <p className="text-sm font-bold">{summary.staffCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase text-slate-400">Total Base</p>
              <p className="text-2xl font-black italic text-slate-900 mt-2">C$ {summary.base.toLocaleString()}</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase text-slate-400">Total Comisiones</p>
              <p className="text-2xl font-black italic text-emerald-600 mt-2">C$ {summary.comission.toLocaleString()}</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase text-slate-400">Servicios Pendientes</p>
              <p className="text-2xl font-black italic text-slate-900 mt-2">{summary.pendingServices}</p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-900 p-5">
              <p className="text-[10px] font-black uppercase text-slate-400">Total a Liquidar</p>
              <p className="text-2xl font-black italic text-white mt-2">C$ {summary.total.toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 overflow-x-auto custom-scrollbar">
            <table className="min-w-[1100px] w-full">
              <thead className="bg-slate-100">
                <tr className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-5 py-4 text-left">Barbero</th>
                  <th className="px-5 py-4 text-left">Desglose</th>
                  <th className="px-5 py-4 text-center">Base</th>
                  <th className="px-5 py-4 text-center">Comisiones</th>
                  <th className="px-5 py-4 text-center">Total</th>
                  <th className="px-5 py-4 text-center">Firma Física</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ barber, nomina }) => (
                  <tr key={barber.id} className="border-t border-slate-200">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-11 h-11 ${barber.bg} rounded-xl flex items-center justify-center font-black italic text-white`}>
                          {barber.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-black uppercase italic text-slate-900">{barber.fullName || barber.name}</p>
                          <p className="text-[10px] font-bold uppercase text-slate-400 mt-1">{barber.cedula?.trim() || `ID STAFF ${barber.id}`}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[11px] font-black uppercase text-slate-700">{nomina.modalityLabel}</p>
                      <p className="text-[11px] text-slate-500 mt-2">Servicios: {nomina.pendingServices}</p>
                      <p className="text-[11px] text-slate-500">Ventas base comisión: C$ {nomina.salesTotal.toLocaleString()}</p>
                    </td>
                    <td className="px-5 py-4 text-center text-sm font-black italic">C$ {nomina.base.toLocaleString()}</td>
                    <td className="px-5 py-4 text-center text-sm font-black italic text-emerald-600">C$ {nomina.comission.toLocaleString()}</td>
                    <td className="px-5 py-4 text-center text-base font-black italic">C$ {nomina.total.toLocaleString()}</td>
                    <td className="px-5 py-4 signature-cell">
                      <div className="h-full min-h-[70px] flex flex-col justify-end">
                        <div className="border-t border-slate-400 pt-2 text-center">
                          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Firma</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100">
                <tr>
                  <td colSpan="2" className="px-5 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Totales</td>
                  <td className="px-5 py-4 text-center text-sm font-black italic">C$ {summary.base.toLocaleString()}</td>
                  <td className="px-5 py-4 text-center text-sm font-black italic text-emerald-600">C$ {summary.comission.toLocaleString()}</td>
                  <td className="px-5 py-4 text-center text-base font-black italic">C$ {summary.total.toLocaleString()}</td>
                  <td className="px-5 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border-t border-slate-300 pt-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Administración</p>
            </div>
            <div className="border-t border-slate-300 pt-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vo. Bo. Gerencia</p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-4 no-print">
          <button onClick={onClose} className="md:w-auto px-6 py-4 bg-white border border-slate-200 text-slate-400 font-black uppercase italic text-[10px] rounded-2xl hover:bg-slate-100 transition-all">
            Cerrar
          </button>
          <button onClick={handlePrint} className="flex-1 px-6 py-4 bg-emerald-600 text-white font-black uppercase italic text-[10px] rounded-2xl shadow-xl shadow-emerald-900/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
            <Printer size={16} /> Imprimir Planilla
          </button>
          <button onClick={handleConfirm} className="flex-1 px-6 py-4 bg-indigo-600 text-white font-black uppercase italic text-[10px] rounded-2xl shadow-xl shadow-indigo-900/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
            <HandCoins size={16} /> Confirmar y Liquidar Todo
          </button>
        </div>
      </div>
    </div>
  );
}
