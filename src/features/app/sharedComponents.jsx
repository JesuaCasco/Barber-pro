import { useEffect, useState } from 'react';
import { AlertCircle, Clock, History, Timer } from 'lucide-react';

export const BeardIcon = ({ size = 24, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M7 11c0 4 2 7 5 7s5-3 5-7" />
    <path d="M8 14c0 3 1.5 5 4 5s4-2 4-5" />
    <path d="M10 17c0 2 1 3 2 3s2-1 2-3" />
    <path d="M6 9c0-1 1-2 2-2h8c1 0 2 1 2 2v2H6V9z" />
  </svg>
);

export const ServiceTimer = ({ startedAt }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return undefined;
    const startTime = new Date(startedAt).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.floor((now - startTime) / 1000);
      setElapsed(diff > 0 ? diff : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
      <Clock size={12} className="text-emerald-400 animate-pulse" />
      <span className="text-[11px] font-black text-emerald-400 font-mono tracking-tighter">
        Serv: {formatTime(elapsed)}
      </span>
    </div>
  );
};

export const WaitTimer = ({ checkInAt, startedAt }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!checkInAt || startedAt) return undefined;

    const interval = setInterval(() => {
      const start = new Date(checkInAt).getTime();
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      setElapsed(diff > 0 ? diff : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [checkInAt, startedAt]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (startedAt) {
    const totalWait = Math.floor((new Date(startedAt).getTime() - new Date(checkInAt).getTime()) / 1000);
    return (
      <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
        <History size={12} className="text-slate-500" />
        <span className="text-[11px] font-black text-slate-500 font-mono">
          Espera: {formatTime(totalWait)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-xl">
      <Timer size={12} className="text-indigo-500 animate-pulse" />
      <span className="text-[11px] font-black text-indigo-500 font-mono">
        Espera: {formatTime(elapsed)}
      </span>
    </div>
  );
};

export const DelayTimer = ({ reservationTime, onExpired }) => {
  const [delaySec, setDelaySec] = useState(0);
  const [expiredTriggered, setExpiredTriggered] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const [h, m] = reservationTime.split(':').map(Number);
      const resDate = new Date();
      resDate.setHours(h, m, 0, 0);

      const diff = Math.floor((now.getTime() - resDate.getTime()) / 1000);

      if (diff > 0) {
        setDelaySec(diff);
        if (diff >= 900 && !expiredTriggered) {
          setExpiredTriggered(true);
          if (onExpired) onExpired();
        }
      } else {
        setDelaySec(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservationTime, onExpired, expiredTriggered]);

  if (delaySec <= 0) return null;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-xl animate-wiggle">
      <AlertCircle size={12} className="text-rose-500" />
      <span className="text-[11px] font-black text-rose-500 font-mono">
        Retraso: {formatTime(delaySec)}
      </span>
    </div>
  );
};
