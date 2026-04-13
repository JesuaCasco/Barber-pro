export const styleTag = `
  @keyframes wiggle {
    0%, 100% { transform: translateX(0) rotate(0deg); }
    25% { transform: translateX(-1px) rotate(-0.5deg); }
    75% { transform: translateX(1px) rotate(0.5deg); }
  }
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(245, 158, 11, 0.2); }
    50% { box-shadow: 0 0 40px rgba(245, 158, 11, 0.6); }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
    50% { transform: translateY(-20px) scale(1.1); opacity: 0.6; }
  }
  @keyframes rotate-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes aurora {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes pulse-gold {
    0%, 100% { filter: drop-shadow(0 0 5px rgba(245, 158, 11, 0.3)); }
    50% { filter: drop-shadow(0 0 15px rgba(245, 158, 11, 0.7)); }
  }
  @keyframes spin-very-slow {
    from { transform: translate(-50%, -50%) rotate(0deg); }
    to { transform: translate(-50%, -50%) rotate(360deg); }
  }

  .animate-glow { animation: glow 3s ease-in-out infinite; }
  .animate-wiggle { animation: wiggle 0.3s ease-in-out infinite; }
  .animate-float { animation: float 6s ease-in-out infinite; }
  .animate-rotate-slow { animation: rotate-slow 20s linear infinite; }
  .animate-pulse-gold { animation: pulse-gold 2s ease-in-out infinite; }
  .animate-spin-very-slow { animation: spin-very-slow 60s linear infinite; }

  input::-webkit-calendar-picker-indicator {
    filter: invert(48%) sepia(79%) saturate(2476%) hue-rotate(120deg) brightness(118%) contrast(119%);
    cursor: pointer;
  }

  .inner-scrollbar::-webkit-scrollbar { width: 4px; }
  .inner-scrollbar::-webkit-scrollbar-thumb { background: #6366f1; border-radius: 10px; }

  .neon-border-indigo { border: 1px solid rgba(99, 102, 241, 0.5); box-shadow: 0 0 15px rgba(99, 102, 241, 0.1); }
  .neon-border-emerald { border: 1px solid rgba(16, 185, 129, 0.5); box-shadow: 0 0 15px rgba(16, 185, 129, 0.1); }
  .neon-border-amber { border: 1px solid rgba(245, 158, 11, 0.5); box-shadow: 0 0 15px rgba(245, 158, 11, 0.1); }
  .gold-gradient { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }

  .bg-mesh-amber {
    background-color: #020617;
    background-image:
      radial-gradient(at 0% 0%, rgba(245, 158, 11, 0.3) 0px, transparent 50%),
      radial-gradient(at 100% 100%, rgba(245, 158, 11, 0.2) 0px, transparent 50%),
      url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40' stroke='%23f59e0b' stroke-opacity='0.08' stroke-width='1' fill='none'/%3E%3C/svg%3E");
    background-size: 100% 100%, 100% 100%, 60px 60px;
  }

  .aurora-effect {
    background: linear-gradient(270deg, rgba(245, 158, 11, 0.2), rgba(0, 0, 0, 0), rgba(245, 158, 11, 0.2));
    background-size: 200% 200%;
    animation: aurora 8s ease infinite;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #4f46e5;
    border-radius: 10px;
  }

  @media print {
    body {
      background: white !important;
      color: black !important;
    }
    aside, main, header, .no-print {
      display: none !important;
    }
    .fixed.inset-0 {
      position: absolute !important;
      display: block !important;
      background: white !important;
      padding: 0 !important;
      margin: 0 !important;
      overflow: visible !important;
    }
    #printable-receipt {
      visibility: visible !important;
      display: block !important;
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      background: white !important;
      color: black !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    #printable-receipt * {
      visibility: visible !important;
      color: black !important;
    }
    #printable-staff-settlement {
      visibility: visible !important;
      display: block !important;
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 100% !important;
      background: white !important;
      color: black !important;
      margin: 0 !important;
      padding: 24px !important;
    }
    #printable-staff-settlement * {
      visibility: visible !important;
      color: black !important;
    }
    #printable-staff-settlement table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    #printable-staff-settlement th,
    #printable-staff-settlement td {
      border: 1px solid #cbd5e1 !important;
      padding: 10px !important;
      vertical-align: top !important;
    }
    #printable-staff-settlement .signature-cell {
      min-width: 180px !important;
      height: 70px !important;
    }
  }
`;

export const MOCK_BARBERS = [
  { id: 1, name: 'Juan "El Master"', fullName: 'Juan Carlos Martínez López', cedula: '', avatar: 'JM', color: 'border-indigo-500', bg: 'bg-indigo-600', shadow: 'shadow-indigo-500/50', paymentMode: 'salario', commission: 0, paymentFrequency: 'Quincenal' },
  { id: 2, name: 'Luis "Barbas"', fullName: 'Luis Alberto García Reyes', cedula: '', avatar: 'LB', color: 'border-amber-500', bg: 'bg-amber-600', shadow: 'shadow-amber-500/50', paymentMode: 'salario', commission: 0, paymentFrequency: 'Mensual' },
  { id: 3, name: 'Mario "Fade"', fullName: 'Mario José Hernández Ruiz', cedula: '', avatar: 'MF', color: 'border-emerald-500', bg: 'bg-emerald-600', shadow: 'shadow-emerald-500/50', paymentMode: 'porcentaje', commission: 12, paymentFrequency: 'Semanal' },
  { id: 4, name: 'Alex "Tijeras"', fullName: 'Alex Manuel Torres Silva', cedula: '', avatar: 'AT', color: 'border-rose-500', bg: 'bg-rose-600', shadow: 'shadow-rose-500/50', paymentMode: 'salario', commission: 0, paymentFrequency: 'Mensual' },
  { id: 5, name: 'Pedro "Style"', fullName: 'Pedro Antonio Castillo Vega', cedula: '', avatar: 'PS', color: 'border-violet-500', bg: 'bg-violet-600', shadow: 'shadow-violet-500/50', paymentMode: 'salario', commission: 0, paymentFrequency: 'Quincenal' },
  { id: 6, name: 'Dani "Clipper"', fullName: 'Daniel Enrique Morales Soto', cedula: '', avatar: 'DC', color: 'border-cyan-500', bg: 'bg-cyan-600', shadow: 'shadow-cyan-500/50', paymentMode: 'porcentaje', commission: 15, paymentFrequency: 'Diario' },
];

const LEGACY_BARBER_NAME_BY_ID = {
  1: 'Juan "El Master"',
  2: 'Luis "Barbas"',
  3: 'Mario "Fade"',
  4: 'Alex "Tijeras"',
  5: 'Pedro "Style"',
  6: 'Dani "Clipper"',
  '3d02d755-7a44-4541-a31e-f71dd64e61a5': 'Juan "El Master"',
  '7f323064-3103-4ffa-8590-a8796ae8a160': 'Luis "Barbas"',
  '55659cbb-d06b-4b91-9909-cf0a2ae07947': 'Mario "Fade"',
  '7e7545df-5e54-4518-9d78-b0ffca124991': 'Alex "Tijeras"',
  '6e3ca6fa-d800-4114-8170-c4134387d1b8': 'Pedro "Style"',
  '699c5f2b-512a-455c-a971-bb7aa2b1ab6b': 'Dani "Clipper"',
};

export const BARBER_THEME_PALETTE = [
  { id: 'indigo', label: 'Indigo', color: 'border-indigo-500', bg: 'bg-indigo-600', shadow: 'shadow-indigo-500/50' },
  { id: 'amber', label: 'Amber', color: 'border-amber-500', bg: 'bg-amber-600', shadow: 'shadow-amber-500/50' },
  { id: 'emerald', label: 'Emerald', color: 'border-emerald-500', bg: 'bg-emerald-600', shadow: 'shadow-emerald-500/50' },
  { id: 'rose', label: 'Rose', color: 'border-rose-500', bg: 'bg-rose-600', shadow: 'shadow-rose-500/50' },
  { id: 'violet', label: 'Violet', color: 'border-violet-500', bg: 'bg-violet-600', shadow: 'shadow-violet-500/50' },
  { id: 'cyan', label: 'Cyan', color: 'border-cyan-500', bg: 'bg-cyan-600', shadow: 'shadow-cyan-500/50' },
  { id: 'lime', label: 'Lime', color: 'border-lime-500', bg: 'bg-lime-600', shadow: 'shadow-lime-500/50' },
  { id: 'teal', label: 'Teal', color: 'border-teal-500', bg: 'bg-teal-600', shadow: 'shadow-teal-500/50' },
  { id: 'fuchsia', label: 'Fuchsia', color: 'border-fuchsia-500', bg: 'bg-fuchsia-600', shadow: 'shadow-fuchsia-500/50' },
  { id: 'amber-dark', label: 'Orange', color: 'border-orange-500', bg: 'bg-orange-600', shadow: 'shadow-orange-500/50' },
  { id: 'sky', label: 'Sky', color: 'border-sky-500', bg: 'bg-sky-600', shadow: 'shadow-sky-500/50' },
  { id: 'stone', label: 'Stone', color: 'border-stone-500', bg: 'bg-stone-600', shadow: 'shadow-stone-500/50' },
];

export const standardizeDate = (dateStr) => {
  if (!dateStr) return '';
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr;
};

export const parseLocalDate = (dateStr) => {
  const normalized = standardizeDate(dateStr);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const getPhoneDigits = (value = '') => `${value ?? ''}`.replace(/\D+/g, '').slice(0, 8);

export const formatPhoneNumber = (value = '') => {
  const digits = getPhoneDigits(value);
  if (digits.length <= 4) return digits;
  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

export const mergeEntitiesById = (...collections) => {
  const merged = new Map();

  collections.flat().forEach((item) => {
    if (!item) return;
    const key = item.id ?? `${item.clientId || ''}-${item.date || ''}-${item.time || ''}`;
    if (!merged.has(String(key))) {
      merged.set(String(key), item);
    }
  });

  return [...merged.values()];
};

export const getMatchingClientAppointments = (client, appointments = [], clients = []) => {
  const clientId = String(client?.id ?? '');
  const clientPhoneDigits = getPhoneDigits(client?.phone);

  return (appointments || []).filter((appointment) => {
    if (String(appointment?.clientId ?? '') === clientId) return true;

    const linkedClient = (clients || []).find(
      (candidate) => String(candidate?.id ?? '') === String(appointment?.clientId ?? '')
    );
    if (!linkedClient) return false;

    return clientPhoneDigits.length === 8 && getPhoneDigits(linkedClient.phone) === clientPhoneDigits;
  });
};

export const normalizeLegacyBarberIdForDirectory = (barberId, barbers = []) => {
  if (barberId === null || barberId === undefined || barberId === '') return null;

  const normalizedBarbers = Array.isArray(barbers) ? barbers : [];
  const exactMatch = normalizedBarbers.find((barber) => String(barber.id) === String(barberId));
  if (exactMatch) return String(exactMatch.id);

  const legacyIndex = Number.parseInt(String(barberId), 10);
  if (!Number.isNaN(legacyIndex) && legacyIndex > 0 && normalizedBarbers[legacyIndex - 1]) {
    return String(normalizedBarbers[legacyIndex - 1].id);
  }

  return String(barberId);
};

export const resolveFavoriteBarberName = (appointments = [], barbers = [], emptyLabel = 'N/A') => {
  if (!appointments.length) return emptyLabel;

  const barberCounts = {};
  appointments.forEach((appointment) => {
    const sourceBarberId = appointment?.rawBarberId ?? appointment?.barberId;
    const normalizedBarberId = normalizeLegacyBarberIdForDirectory(sourceBarberId, barbers);
    const legacyIndex = Number.parseInt(String(sourceBarberId ?? ''), 10);
    const resolvedName =
      (barbers || []).find((barber) => String(barber.id) === String(normalizedBarberId))?.name
      || appointment?.barberName
      || LEGACY_BARBER_NAME_BY_ID[String(sourceBarberId ?? '')]
      || ((!Number.isNaN(legacyIndex) && legacyIndex > 0) ? MOCK_BARBERS[legacyIndex - 1]?.name : '')
      || '';

    if (!resolvedName) return;
    barberCounts[resolvedName] = (barberCounts[resolvedName] || 0) + 1;
  });

  const topBarberName = Object.keys(barberCounts).reduce((bestName, currentName) => (
    !bestName || barberCounts[currentName] > barberCounts[bestName] ? currentName : bestName
  ), null);

  return topBarberName || emptyLabel;
};

export const normalizeFavoriteServiceName = (value = '') => {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  const withoutPromotionSuffix = rawValue
    .replace(/\s*[·|-]\s*promo\s*:\s*.+$/i, '')
    .replace(/\s*[·|-]\s*promocion\s*:\s*.+$/i, '')
    .trim();

  if (!withoutPromotionSuffix) return '';

  if (/^(promo|promocion|descuento)/i.test(withoutPromotionSuffix)) {
    return '';
  }

  return withoutPromotionSuffix;
};

export const getFavoriteServiceName = (appointments = [], emptyLabel = 'N/A') => {
  if (!appointments.length) return emptyLabel;

  const serviceCounts = {};
  appointments.forEach((appointment) => {
    const serviceName = normalizeFavoriteServiceName(appointment?.service || '');
    if (!serviceName) return;
    serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;
  });

  const topServiceName = Object.keys(serviceCounts).reduce((bestName, currentName) => (
    !bestName || serviceCounts[currentName] > serviceCounts[bestName] ? currentName : bestName
  ), null);

  return topServiceName || emptyLabel;
};

export const getClientInsights = (
  client,
  appointments = [],
  clients = [],
  barbers = [],
  options = {},
) => {
  const {
    emptyFavoriteBarber = 'N/A',
    emptyFavoriteService = 'N/A',
    historyLimit = 10,
  } = options;

  const clientAppointments = getMatchingClientAppointments(client, appointments, clients);
  const finishedAppointments = clientAppointments.filter((appointment) => appointment.status === 'Finalizada');
  const sortedHistory = [...clientAppointments].sort((a, b) => {
    const aDate = `${standardizeDate(a?.date || '')} ${`${a?.time || '00:00'}`.slice(0, 5)}`;
    const bDate = `${standardizeDate(b?.date || '')} ${`${b?.time || '00:00'}`.slice(0, 5)}`;
    return new Date(bDate) - new Date(aDate);
  });
  const sortedFinishedAppointments = sortedHistory.filter((appointment) => appointment.status === 'Finalizada');
  const hasStoredInsights = (
    client?.completedVisits !== undefined
    || client?.totalSpent !== undefined
    || client?.lastVisitAt
    || client?.favoriteBarberName
    || client?.favoriteServiceName
  );

  return {
    completedVisits: hasStoredInsights ? Number(client?.completedVisits || 0) : finishedAppointments.length,
    totalSpent: hasStoredInsights
      ? Number(client?.totalSpent || 0)
      : finishedAppointments.reduce((sum, appointment) => sum + (Number(appointment?.price) || 0), 0),
    lastVisitAt: hasStoredInsights
      ? client?.lastVisitAt || null
      : (sortedFinishedAppointments[0]?.date || null),
    favoriteBarberId: hasStoredInsights
      ? client?.favoriteBarberId || null
      : normalizeLegacyBarberIdForDirectory(
        sortedFinishedAppointments[0]?.rawBarberId ?? sortedFinishedAppointments[0]?.barberId ?? null,
        barbers,
      ),
    favoriteBarberName: hasStoredInsights
      ? client?.favoriteBarberName || emptyFavoriteBarber
      : resolveFavoriteBarberName(finishedAppointments, barbers, emptyFavoriteBarber),
    favoriteServiceName: hasStoredInsights
      ? normalizeFavoriteServiceName(client?.favoriteServiceName || '') || emptyFavoriteService
      : getFavoriteServiceName(finishedAppointments, emptyFavoriteService),
    statsUpdatedAt: client?.statsUpdatedAt || null,
    history: sortedHistory.slice(0, historyLimit),
  };
};

export const isValidPhoneNumber = (value = '') => getPhoneDigits(value).length === 8;

export const findClientByPhone = (clients = [], phone = '', excludeId = null) => {
  const digits = getPhoneDigits(phone);
  if (digits.length !== 8) return null;
  return (clients || []).find((client) =>
    getPhoneDigits(client.phone) === digits
    && (excludeId === null || excludeId === undefined || String(client.id) !== String(excludeId))
  ) || null;
};

export const getThemeByIndex = (index) => BARBER_THEME_PALETTE[index % BARBER_THEME_PALETTE.length];

export const ensureBarberTheme = (barber, index) => {
  const theme = barber.color && barber.bg
    ? { color: barber.color, bg: barber.bg, shadow: barber.shadow || 'shadow-indigo-500/50' }
    : getThemeByIndex(index);

  return {
    ...barber,
    color: theme.color,
    bg: theme.bg,
    shadow: theme.shadow,
    avatar: barber.avatar || barber.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?',
    fullName: barber.fullName || barber.name || '',
    cedula: barber.cedula || '',
    salary: Number(barber.salary || 0),
    commission: Number(barber.commission || 0),
    paymentMode: barber.paymentMode || 'salario',
    paymentFrequency: barber.paymentFrequency || 'Quincenal',
    level: barber.level || 'Junior',
    phone: formatPhoneNumber(barber.phone || ''),
  };
};

export const makeId = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);

export const PROMOTION_CATEGORY = 'Promocion';

export const CATEGORIES = ['Cortes', 'Barba', 'Producto', 'Combo', PROMOTION_CATEGORY];

export const CATEGORY_LABELS = {
  Cortes: 'Cortes',
  Barba: 'Barba',
  Producto: 'Producto',
  Combo: 'Combo',
  [PROMOTION_CATEGORY]: 'Promociones',
};

export const PROMOTION_APPLIES_TO_OPTIONS = ['General'];

export const PROMOTION_DISCOUNT_TYPES = [
  { id: 'percentage', label: 'Porcentaje' },
  { id: 'fixed', label: 'Monto fijo' },
];

export const clampPromotionDiscountValue = (discountType, rawValue) => {
  const numericValue = Number(rawValue);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;

  if (discountType === 'percentage') {
    return Math.min(Math.max(safeValue, 0), 100);
  }

  return Math.max(safeValue, 0);
};

export const isPromotionService = (service) => service?.category === PROMOTION_CATEGORY;

export const getChargeableServices = (services = [], appliesTo = null) => {
  const normalizedServices = Array.isArray(services) ? services : [];

  return normalizedServices.filter((service) => {
    if (!service || isPromotionService(service)) return false;
    if (appliesTo === 'Producto') return service.category === 'Producto';
    if (appliesTo === 'Servicio') return service.category !== 'Producto';
    return true;
  });
};

export const getPromotionTargetIds = () => [];

export const getPromotionEligibleItems = (promotion, items = []) => {
  if (!promotion) return [];

  const eligibleCategories = Array.isArray(promotion.eligibleCategories)
    ? promotion.eligibleCategories.filter(Boolean)
    : [];

  return (Array.isArray(items) ? items : []).filter((item) => {
    if (!item) return false;

    const itemCategory = item.category || '';
    if (itemCategory === PROMOTION_CATEGORY) return false;
    if (eligibleCategories.length > 0 && !eligibleCategories.includes(itemCategory)) return false;
    return true;
  });
};

export const calculatePromotionDiscount = (promotion, items = []) => {
  const eligibleItems = getPromotionEligibleItems(promotion, items);
  const eligibleSubtotal = eligibleItems.reduce(
    (sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 1)),
    0,
  );

  if (!promotion || eligibleSubtotal <= 0) {
    return { amount: 0, eligibleSubtotal, eligibleItems };
  }

  const discountType = promotion.discountType || 'percentage';
  const discountValue = Number(promotion.discountValue || 0);
  const safeDiscountValue = Number.isFinite(discountValue) ? discountValue : 0;

  const rawAmount = discountType === 'fixed'
    ? Math.min(safeDiscountValue, eligibleSubtotal)
    : eligibleSubtotal * (Math.min(Math.max(safeDiscountValue, 0), 100) / 100);

  const amount = Math.round(rawAmount * 100) / 100;
  return { amount, eligibleSubtotal, eligibleItems };
};

export const getApplicablePromotions = (services = [], items = []) =>
  (Array.isArray(services) ? services : [])
    .filter((service) => isPromotionService(service))
    .filter((promotion) => getPromotionEligibleItems(promotion, items).length > 0);

export const formatPromotionValue = (promotion) => {
  const discountValue = Number(promotion?.discountValue || 0);
  if ((promotion?.discountType || 'percentage') === 'fixed') {
    return `C$ ${discountValue.toLocaleString('es-NI')}`;
  }
  return `${discountValue}%`;
};

export const HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00',
];

export const PASSWORD_MIN_LENGTH = 6;
export const LOYALTY_REWARD_VISITS = 10;

export const ROLE_META = {
  super_admin: { label: 'Super Admin', badge: 'bg-rose-500 text-white border-rose-300' },
  admin: { label: 'Administrador', badge: 'bg-amber-500 text-amber-950 border-amber-200' },
  cashier: { label: 'Caja', badge: 'bg-emerald-500 text-emerald-950 border-emerald-200' },
};

export const BUSINESS_PLANS = ['Starter', 'Growth', 'Scale'];

export const getPrimaryRole = (user) => {
  const roles = user?.roles || [];
  if (roles.includes('super_admin')) return 'super_admin';
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('cashier')) return 'cashier';
  return null;
};

export const formatLocalDateYmd = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const getTodayString = () => formatLocalDateYmd(new Date());

export const getCurrentTimeHHmm = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

export const getBarberNominaData = (barber, appointments = []) => {
  const finishedApts = (appointments || []).filter(
    (a) => String(a.barberId) === String(barber.id) && a.status === 'Finalizada' && !a.isPaid
  );
  const totalComissionSales = finishedApts.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
  const commissionRate = Number(barber.commission || 0);
  const comission = barber.paymentMode === 'porcentaje' ? totalComissionSales * (commissionRate / 100) : 0;
  const base = barber.paymentMode === 'salario' ? Number(barber.salary || 0) : 0;

  return {
    base,
    comission,
    total: base + comission,
    pendingServices: finishedApts.length,
    salesTotal: totalComissionSales,
    commissionRate,
    modalityLabel: barber.paymentMode === 'salario' ? 'Salario fijo' : `Comisión ${commissionRate}%`,
  };
};
