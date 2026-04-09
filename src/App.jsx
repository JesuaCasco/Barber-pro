import React, { Suspense, createContext, lazy, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  createManagedUser,
  createPosSale,
  assignProfileBarbershop,
  deleteBarberRecord,
  deleteClientRecord,
  deletePosSaleRecord,
  deleteServiceRecord,
  fetchAccessControlSnapshot,
  fetchBarbershopSnapshot,
  fetchClientDirectorySnapshot,
  fetchScopedBarbers,
  fetchScopedClients,
  resetManagedUserPassword,
  replaceUserRoles,
  syncServiceComboItems,
  upsertBranch,
  upsertBarbershop,
  upsertAppointments,
  upsertBarbers,
  upsertClients,
  upsertServices,
  updateManagedUserProfile,
} from './lib/barbershopApi';
import {
  hasSupabaseConfig,
  isLocalDevModeEnabled,
  shouldBlockWithoutSupabase,
  shouldSeedLocalDevMode,
  supabase,
} from './lib/supabase';
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Users, 
  Scissors, 
  ShoppingBag, 
  BarChart3, 
  Plus, 
  Search,
  Clock,
  X,
  Loader2, 
  CalendarDays,
  Trash2,
  Package,
  Tags,
  Save,
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Check,
  Edit2,
  UserPlus,
  Info,
  Star,
  Zap,
  Phone,
  User,
  CreditCard,
  Medal,
  Award,
  Crown,
  CalendarCheck,
  Layers,
  Sparkles,
  UserCheck,
  Target,
  Gift,
  ArrowUpRight,
  Filter,
  Briefcase,
  IdCard,
  Smartphone,
  MapPin,
  History,
  MessageSquare,
  Menu,
  Timer,
  UserX,
  Wallet,
  Activity,
  Repeat,
  ArrowRight,
  Printer,
  HandCoins,
  ShieldCheck,
} from 'lucide-react';

import {
  CATEGORY_LABELS,
  BARBER_THEME_PALETTE,
  BUSINESS_PLANS,
  CATEGORIES,
  HOURS,
  MOCK_BARBERS,
  LOYALTY_REWARD_VISITS,
  PASSWORD_MIN_LENGTH,
  ROLE_META,
  ensureBarberTheme,
  findClientByPhone,
  formatPhoneNumber,
  formatLocalDateYmd,
  getBarberNominaData,
  getCurrentTimeHHmm,
  getPhoneDigits,
  getPrimaryRole,
  getTodayString,
  isValidPhoneNumber,
  formatPromotionValue,
  getApplicablePromotions,
  calculatePromotionDiscount,
  isPromotionService,
  makeId,
  mergeEntitiesById,
  parseLocalDate,
  standardizeDate,
  styleTag,
} from './features/app/shared';
import {
  BeardIcon,
  DelayTimer,
  ServiceTimer,
  WaitTimer,
} from './features/app/sharedComponents';
import { DashboardView, POSView } from './features/app/dashboardPosViews';
import { ClientDetailModal, ClientsTableView } from './features/app/clientViews';

const loadAccessUiModule = () => import('./features/system/accessUi');
const LoginScreen = lazy(() => loadAccessUiModule().then((module) => ({ default: module.LoginScreen })));
const PasswordActionModal = lazy(() => loadAccessUiModule().then((module) => ({ default: module.PasswordActionModal })));
const UserEditorModal = lazy(() => loadAccessUiModule().then((module) => ({ default: module.UserEditorModal })));

const accessUiFallback = (
  <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-sm">
    <div className="rounded-2xl border border-white/10 bg-slate-950 px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300">
      Cargando interfaz...
    </div>
  </div>
);

const UiFeedbackContext = createContext({
  notify: () => {},
  confirmAction: async () => false,
});

const useUiFeedback = () => useContext(UiFeedbackContext);

function SystemView({
  currentUser,
  accessControl,
  savingUserId,
  creatingUser,
  resettingPasswordUserId,
  onboardingBusy,
  onCreateSystemUser,
  onResetUserPassword,
  onUpdateUserProfile,
  onCreateBarbershop,
  onCreateBranch,
  isAdmin,
  isSuperAdmin,
}) {
  const { notify } = useUiFeedback();
  const [search, setSearch] = useState('');
  const [activeSystemPanel, setActiveSystemPanel] = useState('users');
  const [showCreateBarbershop, setShowCreateBarbershop] = useState(false);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedBranchesBarbershopId, setSelectedBranchesBarbershopId] = useState('all');
  const [selectedUsersBarbershopId, setSelectedUsersBarbershopId] = useState('all');
  const [selectedUsersBranchId, setSelectedUsersBranchId] = useState('all');
  const [onboarding, setOnboarding] = useState({ name: '', ownerEmail: '', phone: '', city: '', plan: BUSINESS_PLANS[0], adminUserId: '' });
  const [branchForm, setBranchForm] = useState({ id: '', name: '', code: '', city: '', address: '', barbershopId: '' });
  const [newUser, setNewUser] = useState({ fullName: '', email: '', password: '', roleName: 'admin', barbershopId: '', branchId: '' });

  const roleCatalog = accessControl.roles.length
    ? accessControl.roles.filter((role) => ['super_admin', 'admin', 'cashier'].includes(role.roleName))
    : [
        { roleName: 'super_admin', description: 'Control total de la plataforma SaaS' },
  { roleName: 'admin', description: 'Administra la barbería y su configuración' },
  { roleName: 'cashier', description: 'Caja / recepción' },
      ];
  const editableRoleCatalog = roleCatalog.filter((role) => isSuperAdmin || role.roleName !== 'super_admin');
  const barbershops = useMemo(() => accessControl.barbershops || [], [accessControl.barbershops]);
  const branches = useMemo(() => accessControl.branches || [], [accessControl.branches]);
  const currentBarbershop = barbershops.find((shop) => String(shop.id) === String(accessControl.currentBarbershopId || ''))
    || (!isSuperAdmin ? barbershops[0] || null : null);
  const effectiveCurrentBarbershopId = accessControl.currentBarbershopId || currentBarbershop?.id || barbershops[0]?.id || '';
  const currentBranch = branches.find((branch) => String(branch.id) === String(accessControl.currentBranchId || '')) || null;
  const defaultBarbershopId = effectiveCurrentBarbershopId;
  const branchesForCurrentBarbershop = branches.filter((branch) => String(branch.barbershopId || '') === String(effectiveCurrentBarbershopId));
  const effectiveUsersBarbershopId = !isSuperAdmin
    ? (defaultBarbershopId || 'all')
    : (
        selectedUsersBarbershopId === 'all'
          ? 'all'
          : (barbershops.some((shop) => String(shop.id) === String(selectedUsersBarbershopId)) ? selectedUsersBarbershopId : 'all')
      );
  const branchesForSelectedUsersBarbershop = effectiveUsersBarbershopId === 'all'
    ? []
    : branches.filter((branch) => String(branch.barbershopId || '') === String(effectiveUsersBarbershopId));
  const effectiveBranchesBarbershopId = !isSuperAdmin
    ? (defaultBarbershopId || 'all')
    : (
        selectedBranchesBarbershopId === 'all'
          ? 'all'
          : (barbershops.some((shop) => String(shop.id) === String(selectedBranchesBarbershopId)) ? selectedBranchesBarbershopId : 'all')
      );
  const effectiveUsersBranchId = effectiveUsersBarbershopId === 'all'
    ? 'all'
    : (
        selectedUsersBranchId !== 'all' && branchesForSelectedUsersBarbershop.some((branch) => String(branch.id) === String(selectedUsersBranchId))
          ? selectedUsersBranchId
          : 'all'
      );
  const effectiveBranchFormBarbershopId = isSuperAdmin
    ? (branchForm.barbershopId || defaultBarbershopId)
    : (defaultBarbershopId || accessControl.currentBarbershopId || '');
  const effectiveNewUserRole = isSuperAdmin ? newUser.roleName : 'cashier';
  const effectiveNewUserBarbershopId = isSuperAdmin
    ? (newUser.barbershopId || defaultBarbershopId)
    : (defaultBarbershopId || accessControl.currentBarbershopId || '');
  const filteredBranches = useMemo(() => {
    if (!isSuperAdmin) {
      return branchesForCurrentBarbershop;
    }

    if (effectiveBranchesBarbershopId === 'all') {
      return branches;
    }

    return branches.filter((branch) => String(branch.barbershopId || '') === String(effectiveBranchesBarbershopId));
  }, [isSuperAdmin, branches, branchesForCurrentBarbershop, effectiveBranchesBarbershopId]);
  const branchCountByBarbershopId = useMemo(
    () => branches.reduce((accumulator, branch) => {
      const key = String(branch.barbershopId || '');
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {}),
    [branches],
  );
  const availableBranchOptionsForNewUser = isSuperAdmin
    ? branches.filter((branch) => String(branch.barbershopId || '') === String(effectiveNewUserBarbershopId))
    : branchesForCurrentBarbershop;
  const effectiveNewUserBranchId = !newUser.branchId
    ? (!isSuperAdmin ? (currentBranch?.id || '') : '')
    : (availableBranchOptionsForNewUser.some((branch) => String(branch.id) === String(newUser.branchId)) ? newUser.branchId : '');
  const canCreateUsers = isAdmin;
  const onboardingCandidates = useMemo(
    () => (accessControl.users || []).filter((user) => !user.roles.includes('super_admin')),
    [accessControl.users],
  );
  const effectiveOnboardingAdminUserId = onboarding.adminUserId || onboardingCandidates[0]?.id || '';

  const resetBranchForm = () => {
    setBranchForm({
      id: '',
      name: '',
      code: '',
      city: '',
      address: '',
      barbershopId: '',
    });
  };

  const startBranchEdit = (branch) => {
    setActiveSystemPanel('branches');
    setShowBranchForm(true);
    setBranchForm({
      id: branch.id,
      name: branch.name || '',
      code: branch.code || '',
      city: branch.city || '',
      address: branch.address || '',
      barbershopId: branch.barbershopId || currentBarbershop?.id || '',
    });
  };

  const users = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const base = (accessControl.users || []).filter((user) => {
      if (!isSuperAdmin) return true;
      if (effectiveUsersBarbershopId === 'all') return true;
      if (String(user.barbershopId || '') !== String(effectiveUsersBarbershopId)) return false;
      if (effectiveUsersBranchId === 'all') return true;
      return String(user.branchId || '') === String(effectiveUsersBranchId);
    });
    if (!normalized) return base;

    return base.filter((user) =>
      (user.fullName || '').toLowerCase().includes(normalized) ||
      (user.email || '').toLowerCase().includes(normalized) ||
      (user.barbershopName || '').toLowerCase().includes(normalized) ||
      (user.roles || []).some((role) => role.toLowerCase().includes(normalized)),
    );
  }, [accessControl.users, isSuperAdmin, search, effectiveUsersBarbershopId, effectiveUsersBranchId]);

  const formatUserCreatedAt = (value) => {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
    return parsed.toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const canResetPasswordForUser = (user) => {
    if (!isAdmin || !user) return false;
    if (String(user.id) === String(currentUser?.id)) return false;
    const primaryRole = getPrimaryRole(user);
    if (isSuperAdmin) return primaryRole !== 'super_admin';
    return primaryRole === 'cashier';
  };
  const canEditUser = (user) => {
    if (!isAdmin || !user) return false;
    const primaryRole = getPrimaryRole(user);
    if (primaryRole === 'super_admin') return false;
    if (isSuperAdmin) return true;
    return String(user.barbershopId || '') === String(effectiveCurrentBarbershopId || '') && primaryRole === 'cashier';
  };
  const getEditableRoleOptionsForUser = (user) => {
    if (!user) return [];
    if (isSuperAdmin) {
      return editableRoleCatalog.filter((role) => role.roleName !== 'super_admin');
    }
    return editableRoleCatalog.filter((role) => role.roleName === 'cashier');
  };

  const handleSubmitOnboarding = async (event) => {
    event.preventDefault();
    if (!onboarding.name.trim()) {
      notify('Ingresa el nombre de la barbería para completar el onboarding.', 'warning');
      return;
    }
    const created = await onCreateBarbershop({
      ...onboarding,
      adminUserId: effectiveOnboardingAdminUserId || '',
    });
    if (created) {
      setOnboarding({ name: '', ownerEmail: '', phone: '', city: '', plan: BUSINESS_PLANS[0], adminUserId: '' });
      setShowCreateBarbershop(false);
    }
  };

  const handleSubmitNewUser = async (event) => {
    event.preventDefault();

    if (!newUser.fullName.trim() || !newUser.email.trim()) {
      notify('Completa nombre y correo para crear la cuenta.', 'warning');
      return;
    }

    if (newUser.password.trim().length < PASSWORD_MIN_LENGTH) {
      notify(`Define una contraseña temporal de al menos ${PASSWORD_MIN_LENGTH} caracteres.`, 'warning');
      return;
    }

    const resolvedBarbershopId = isSuperAdmin
      ? effectiveNewUserBarbershopId
      : (defaultBarbershopId || accessControl.currentBarbershopId || '');
    const resolvedBranchId = isSuperAdmin
      ? (effectiveNewUserBranchId || null)
      : (effectiveNewUserBranchId || currentBranch?.id || null);
    const resolvedPassword = newUser.password.trim();

    if (!resolvedBarbershopId) {
      notify(
        isSuperAdmin
          ? 'Selecciona la barbería a la que pertenecerá este usuario.'
          : 'Tu cuenta de administrador todavía no está vinculada a una barbería.',
        'warning',
      );
      return;
    }

    const created = await onCreateSystemUser({
      fullName: newUser.fullName.trim(),
      email: newUser.email.trim().toLowerCase(),
      password: resolvedPassword,
      roleName: effectiveNewUserRole,
      barbershopId: resolvedBarbershopId,
      branchId: resolvedBranchId,
    });

    if (created) {
      notify(`Usuario ${newUser.email.trim().toLowerCase()} creado correctamente.`, 'success');
      setNewUser({
        fullName: '',
        email: '',
        password: '',
        roleName: isSuperAdmin ? 'admin' : 'cashier',
        barbershopId: '',
        branchId: '',
      });
      setShowCreateUser(false);
    }
  };

  const handleSubmitBranch = async (event) => {
    event.preventDefault();

    const resolvedBarbershopId = isSuperAdmin
      ? effectiveBranchFormBarbershopId
      : (defaultBarbershopId || accessControl.currentBarbershopId || '');

    if (!resolvedBarbershopId || !branchForm.name.trim()) {
      notify('Completa el nombre de la sucursal y la barbería correspondiente.', 'warning');
      return;
    }

    const created = await onCreateBranch({
      id: branchForm.id || undefined,
      name: branchForm.name.trim(),
      code: branchForm.code.trim(),
      city: branchForm.city.trim(),
      address: branchForm.address.trim(),
      barbershopId: resolvedBarbershopId,
    });

    if (created) {
      resetBranchForm();
      setShowBranchForm(false);
    }
  };

  const handleSubmitEditUser = async (payload) => {
    if (!editingUser) return false;
    const targetBarbershopId = isSuperAdmin
      ? (payload.barbershopId || null)
      : (currentBarbershop?.id || accessControl.currentBarbershopId || null);
    const targetBranchId = payload.branchId || null;
    const nextRoleName = isSuperAdmin ? payload.roleName : 'cashier';

    await onUpdateUserProfile(editingUser, {
      fullName: payload.fullName,
      roleName: nextRoleName,
      barbershopId: targetBarbershopId,
      branchId: targetBranchId,
    });
    setEditingUser(null);
    return true;
  };

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-8 animate-in fade-in text-white no-print">
      {isSuperAdmin && (
        <section className="flex flex-wrap gap-3">
          {[{ id: 'barbershops', label: 'Barberías' }, { id: 'branches', label: 'Sucursales' }, { id: 'users', label: 'Usuarios' }].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSystemPanel(item.id)}
              className={`w-full sm:w-auto px-6 py-3 rounded-[1.4rem] text-[10px] font-black uppercase tracking-[0.22em] transition-all border ${
                activeSystemPanel === item.id
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.25)]'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </section>
      )}

      {isSuperAdmin && showCreateBarbershop && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-5xl bg-slate-950 border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative text-white max-h-[88vh] overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setShowCreateBarbershop(false)}
              className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20"
            >
              <X size={20} />
            </button>

            <form onSubmit={handleSubmitOnboarding}>
              <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Configuración comercial</p>
                  <h3 className="mt-3 text-[2rem] font-black uppercase italic tracking-tighter text-white leading-none">
                    Nueva barbería
                  </h3>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Nombre del negocio</label>
                  <input
                    value={onboarding.name}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej. Barbería Central"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Correo del dueño</label>
                  <input
                    value={onboarding.ownerEmail}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, ownerEmail: e.target.value }))}
                    placeholder="dueno@barberia.com"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Teléfono</label>
                  <input
                    value={onboarding.phone}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="0000-0000"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Ciudad</label>
                  <input
                    value={onboarding.city}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Managua"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Plan comercial</label>
                  <select
                    value={onboarding.plan}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, plan: e.target.value }))}
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    {BUSINESS_PLANS.map((plan) => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Admin principal</label>
                  <select
                    value={effectiveOnboardingAdminUserId}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, adminUserId: e.target.value }))}
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    <option value="">Asignar después</option>
                    {onboardingCandidates.map((user) => (
                      <option key={user.id} value={user.id}>
                        {(user.fullName || user.email)}{user.email ? ` - ${user.email}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={onboardingBusy}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all flex items-center justify-center gap-3 shadow-[0_12px_30px_rgba(99,102,241,0.24)]"
                >
                  {onboardingBusy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Crear barbería
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateBarbershop(false)}
                  className="sm:w-56 bg-white/5 hover:bg-white/10 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBranchForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-4xl bg-slate-950 border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative text-white max-h-[88vh] overflow-y-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                setShowBranchForm(false);
                resetBranchForm();
              }}
              className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20"
            >
              <X size={20} />
            </button>

            <form onSubmit={handleSubmitBranch}>
              <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Cobertura operativa</p>
                  <h3 className="mt-3 text-[2rem] font-black uppercase italic tracking-tighter text-white leading-none">
                    {branchForm.id ? 'Editar sucursal' : 'Nueva sucursal'}
                  </h3>
                </div>
              </div>

              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {isSuperAdmin && (
                  <div className="space-y-3 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Barbería</label>
                    <select
                      value={effectiveBranchFormBarbershopId}
                      onChange={(e) => setBranchForm((prev) => ({ ...prev, barbershopId: e.target.value }))}
                      className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                    >
                      <option value="">Selecciona una barbería</option>
                      {barbershops.map((shop) => (
                        <option key={shop.id} value={shop.id}>{shop.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Nombre de sucursal</label>
                  <input
                    value={branchForm.name}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej. Sucursal Metrocentro"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Código interno</label>
                  <input
                    value={branchForm.code}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, code: e.target.value }))}
                    placeholder="Ej. BR-01"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Ciudad</label>
                  <input
                    value={branchForm.city}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Managua"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Dirección</label>
                  <input
                    value={branchForm.address}
                    onChange={(e) => setBranchForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Centro comercial, local 12"
                    className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  />
                </div>
              </div>

              <div className="px-8 pb-8 flex flex-col sm:flex-row gap-3">
                <button
                  type="submit"
                  disabled={onboardingBusy}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all flex items-center justify-center gap-3 shadow-[0_12px_30px_rgba(99,102,241,0.24)]"
                >
                  {onboardingBusy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {branchForm.id ? 'Guardar cambios' : 'Crear sucursal'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBranchForm(false);
                    resetBranchForm();
                  }}
                  className="sm:w-56 bg-white/5 hover:bg-white/10 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isSuperAdmin && (
        <section className="flex flex-wrap gap-3">
          {[{ id: 'branches', label: 'Sucursales' }, { id: 'users', label: 'Usuarios' }].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSystemPanel(item.id)}
              className={`w-full sm:w-auto px-6 py-3 rounded-[1.4rem] text-[10px] font-black uppercase tracking-[0.22em] transition-all border ${
                activeSystemPanel === item.id
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.25)]'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </section>
      )}

      {activeSystemPanel === 'barbershops' && (
        <section className="rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="px-5 md:px-8 py-6 md:py-7 border-b border-slate-800 bg-black/40">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">Negocios activos</p>
                <h4 className="mt-3 text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Barberías registradas</h4>
              </div>

              <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-3">
                <div className="rounded-[1.6rem] border border-white/5 bg-slate-950 px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {barbershops.length} barberías
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateBarbershop(true)}
                  className="px-5 py-4 rounded-[1.6rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Nueva barbería
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8">
            {barbershops.length > 0 ? (
              <>
                <div className="grid gap-4 md:hidden">
                  {barbershops.map((shop) => (
                    <div key={shop.id} className="rounded-[2rem] border border-white/5 bg-black/25 p-5">
                      <p className="text-lg font-black uppercase italic tracking-tighter text-white break-words">{shop.name || 'Sin nombre'}</p>
                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Ciudad</p>
                          <p className="mt-1 font-bold text-slate-300">{shop.city || 'Sin ciudad'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Propietario</p>
                          <p className="mt-1 font-bold text-slate-300 break-all">{shop.ownerEmail || 'Sin correo del dueño'}</p>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex px-3 py-2 rounded-xl border border-white/10 bg-slate-950 text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">
                            {shop.plan || 'Sin plan'}
                          </span>
                          <span className="text-sm font-black text-white">{branchCountByBarbershopId[String(shop.id)] || 0} suc.</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block rounded-[2.4rem] border border-white/5 bg-black/35 overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[minmax(220px,1.2fr)_160px_minmax(260px,1.2fr)_140px_140px] gap-4 px-6 py-5 border-b border-white/5 text-[9px] font-black uppercase tracking-[0.24em] text-slate-500">
                    <span>Barbería</span>
                    <span>Ciudad</span>
                    <span>Propietario</span>
                    <span>Plan</span>
                    <span>Sucursales</span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {barbershops.map((shop) => (
                      <div
                        key={shop.id}
                        className="grid grid-cols-[minmax(220px,1.2fr)_160px_minmax(260px,1.2fr)_140px_140px] gap-4 px-6 py-5 items-center"
                      >
                        <div className="min-w-0">
                          <p className="text-base font-black uppercase italic tracking-tighter text-white break-all">
                            {shop.name || 'Sin nombre'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-300">
                            {shop.city || 'Sin ciudad'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-300 break-all">
                            {shop.ownerEmail || 'Sin correo del dueño'}
                          </p>
                          {shop.phone && (
                            <p className="mt-2 text-[11px] text-slate-500">
                              {shop.phone}
                            </p>
                          )}
                        </div>
                        <div>
                          <span className="inline-flex px-3 py-2 rounded-xl border border-white/10 bg-slate-950 text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">
                            {shop.plan || 'Sin plan'}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm font-black text-white">
                            {branchCountByBarbershopId[String(shop.id)] || 0}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </>
            ) : (
              <div className="rounded-[2.4rem] border border-white/5 bg-black/20 px-6 py-16 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Todavía no hay barberías registradas</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeSystemPanel === 'branches' && (
        <section className="rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="px-5 md:px-8 py-6 md:py-7 border-b border-slate-800 bg-black/40">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">Cobertura</p>
                <h4 className="mt-3 text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Sucursales registradas</h4>
              </div>

              <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-3">
                {isSuperAdmin && (
                  <div className="w-full sm:w-[260px]">
                    <select
                      value={effectiveBranchesBarbershopId}
                      onChange={(e) => setSelectedBranchesBarbershopId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] px-5 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                    >
                      <option value="all">Todas las barberías</option>
                      {barbershops.map((shop) => (
                        <option key={shop.id} value={shop.id}>{shop.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    resetBranchForm();
                    setShowBranchForm(true);
                  }}
                  className="px-5 py-4 rounded-[1.6rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Nueva sucursal
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-8">
            {filteredBranches.length > 0 ? (
              <>
                <div className="grid gap-4 md:hidden">
                  {filteredBranches.map((branch) => (
                    <div key={branch.id} className="rounded-[2rem] border border-white/5 bg-black/25 p-5">
                      <p className="text-lg font-black uppercase italic tracking-tighter text-white break-words">{branch.name || 'Sin nombre'}</p>
                      <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Barbería</p>
                          <p className="mt-1 font-bold text-slate-300 break-words">{branch.barbershopName || currentBarbershop?.name || 'Sin barbería'}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Código</p>
                            <p className="mt-1 font-bold text-slate-300">{branch.code || 'Sin código'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Ciudad</p>
                            <p className="mt-1 font-bold text-slate-300">{branch.city || 'Sin ciudad'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Dirección</p>
                          <p className="mt-1 font-bold text-slate-300 break-words">{branch.address || 'Sin dirección'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => startBranchEdit(branch)}
                          className="mt-2 w-full px-4 py-3 rounded-[1.3rem] bg-white/5 hover:bg-indigo-600 text-white font-black uppercase italic text-[10px] tracking-[0.18em] transition-all flex items-center justify-center gap-2"
                        >
                          <Edit2 size={14} />
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block rounded-[2.4rem] border border-white/5 bg-black/35 overflow-x-auto">
                <div className="min-w-[1120px]">
                  <div className="grid grid-cols-[minmax(220px,1.1fr)_minmax(220px,1fr)_140px_150px_minmax(260px,1.3fr)_130px] gap-4 px-6 py-5 border-b border-white/5 text-[9px] font-black uppercase tracking-[0.24em] text-slate-500">
                    <span>Sucursal</span>
                    <span>Barbería</span>
                    <span>Código</span>
                    <span>Ciudad</span>
                    <span>Dirección</span>
                    <span>Acciones</span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {filteredBranches.map((branch) => (
                      <div
                        key={branch.id}
                        className="grid grid-cols-[minmax(220px,1.1fr)_minmax(220px,1fr)_140px_150px_minmax(260px,1.3fr)_130px] gap-4 px-6 py-5 items-center"
                      >
                        <div className="min-w-0">
                          <p className="text-base font-black uppercase italic tracking-tighter text-white break-all">
                            {branch.name || 'Sin nombre'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-300 break-all">
                            {branch.barbershopName || currentBarbershop?.name || 'Sin barbería'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-300">
                            {branch.code || 'Sin código'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-300">
                            {branch.city || 'Sin ciudad'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-300 break-all">
                            {branch.address || 'Sin dirección'}
                          </p>
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => startBranchEdit(branch)}
                            className="px-4 py-3 rounded-[1.3rem] bg-white/5 hover:bg-indigo-600 text-white font-black uppercase italic text-[10px] tracking-[0.18em] transition-all flex items-center gap-2"
                          >
                            <Edit2 size={14} />
                            Editar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                </div>
              </>
            ) : (
              <div className="rounded-[2.4rem] border border-white/5 bg-black/20 px-6 py-16 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Todavía no hay sucursales registradas</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeSystemPanel === 'users' && (
      <section className="rounded-[3rem] border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        <div className="px-5 md:px-8 py-6 md:py-7 border-b border-slate-800 bg-black/40">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div>
              <h4 className="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-white">Usuarios del sistema</h4>
            </div>

              <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-3">
              {canCreateUsers && (
                <button
                  type="button"
                  onClick={() => setShowCreateUser((prev) => !prev)}
                  className="px-5 py-4 rounded-[1.6rem] bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus size={16} /> {showCreateUser ? 'Cerrar alta' : 'Nuevo usuario'}
                </button>
              )}
              {isSuperAdmin && (
                <div className="w-full sm:w-[260px]">
                  <select
                    value={effectiveUsersBarbershopId}
                    onChange={(e) => {
                      setSelectedUsersBarbershopId(e.target.value);
                      setSelectedUsersBranchId('all');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] px-5 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    <option value="all">Todas las barberías</option>
                    {barbershops.map((shop) => (
                      <option key={shop.id} value={shop.id}>{shop.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {(isSuperAdmin ? effectiveUsersBarbershopId !== 'all' : branchesForCurrentBarbershop.length > 0) && (
                <div className="w-full sm:w-[240px]">
                  <select
                    value={effectiveUsersBranchId}
                    onChange={(e) => setSelectedUsersBranchId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] px-5 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                  >
                    <option value="all">Todas las sucursales</option>
                    {(isSuperAdmin ? branchesForSelectedUsersBarbershop : branchesForCurrentBarbershop).map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="w-full xl:w-[360px] relative">
                <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, correo, rol, barbería o sucursal"
                  className="w-full bg-slate-950 border border-slate-800 rounded-[1.6rem] pl-5 pr-12 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-8 space-y-5">
          {canCreateUsers && showCreateUser && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300">
              <div className="w-full max-w-4xl bg-slate-950 border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 relative text-white max-h-[88vh] overflow-y-auto custom-scrollbar">
                <button
                  type="button"
                  onClick={() => setShowCreateUser(false)}
                  className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20"
                >
                  <X size={20} />
                </button>

                <form onSubmit={handleSubmitNewUser}>
                  <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between gap-6">
                    <div className="flex items-center gap-5 min-w-0">
                      <div className="w-14 h-14 rounded-[1.6rem] bg-indigo-600 flex items-center justify-center text-white shadow-[0_0_30px_rgba(99,102,241,0.35)] shrink-0">
                        <ShieldCheck size={24} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[2rem] font-black uppercase italic tracking-tighter text-white leading-none">
                          Nuevo usuario
                        </h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300 mt-2 leading-none">
                          Control de accesos
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Nombre completo</label>
                      <input
                        value={newUser.fullName}
                        onChange={(e) => setNewUser((prev) => ({ ...prev, fullName: e.target.value }))}
                        placeholder="Ej. Administrador Sistema"
                        className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Correo de acceso</label>
                      <input
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="Ej. admin@barberia.com"
                        className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Contraseña temporal</label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder={`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`}
                        className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                      />
                    </div>

                    <div className={`grid grid-cols-1 ${isSuperAdmin ? 'md:grid-cols-[1fr_1fr_1.2fr_1.2fr]' : 'md:grid-cols-[1fr_1fr_1.2fr]'} gap-6`}>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Rol de acceso</label>
                        <select
                          value={effectiveNewUserRole}
                          onChange={(e) => setNewUser((prev) => ({ ...prev, roleName: e.target.value }))}
                          disabled={!isSuperAdmin}
                          className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic disabled:opacity-60"
                        >
                          {isSuperAdmin && <option value="admin">Administrador</option>}
                          <option value="cashier">Caja</option>
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Estado de cuenta</label>
                        <div className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white italic">
                          Activo
                        </div>
                      </div>

                      {isSuperAdmin && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Barbería</label>
                          <select
                            value={effectiveNewUserBarbershopId}
                            onChange={(e) => setNewUser((prev) => ({ ...prev, barbershopId: e.target.value, branchId: '' }))}
                            className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                          >
                            <option value="">Selecciona una barbería</option>
                            {barbershops.map((shop) => (
                              <option key={shop.id} value={shop.id}>{shop.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(isSuperAdmin ? availableBranchOptionsForNewUser.length > 0 : branchesForCurrentBarbershop.length > 0) && (
                        <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Sucursal</label>
                          <select
                            value={effectiveNewUserBranchId}
                            onChange={(e) => setNewUser((prev) => ({ ...prev, branchId: e.target.value }))}
                            className="w-full bg-black border border-slate-800 rounded-[1.4rem] px-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
                          >
                            <option value="">General / sin sucursal</option>
                            {(isSuperAdmin ? availableBranchOptionsForNewUser : branchesForCurrentBarbershop).map((branch) => (
                              <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={creatingUser}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white py-4.5 rounded-[1.6rem] font-black uppercase italic text-[11px] tracking-[0.22em] transition-all flex items-center justify-center gap-3 shadow-[0_12px_30px_rgba(99,102,241,0.24)]"
                    >
                      {creatingUser ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Guardar configuración de acceso
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
{users.length > 0 && (
            <>
            <div className="grid gap-4 md:hidden">
              {users.map((user) => {
                const primaryRole = getPrimaryRole(user);
                const roleMeta = primaryRole
                  ? (ROLE_META[primaryRole] || { label: primaryRole, badge: 'bg-slate-700 text-white border-slate-500' })
                  : { label: 'Sin rol', badge: 'bg-slate-950 text-slate-400 border-slate-700' };
                const displayName = user.fullName || user.email || 'Usuario sin nombre';
                const scopeLabel = isSuperAdmin
                  ? [user.barbershopName, user.branchName].filter(Boolean).join(' • ')
                  : (user.branchName || '');
                return (
                  <div key={user.id} className="rounded-[2rem] border border-white/5 bg-black/25 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-lg font-black uppercase italic tracking-tighter text-white break-words">{displayName}</p>
                        <p className="mt-2 text-sm font-bold text-slate-300 break-all">{user.email || 'Sin correo'}</p>
                      </div>
                      <span className={`inline-flex shrink-0 px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] ${roleMeta.badge}`}>
                        {roleMeta.label}
                      </span>
                    </div>
                    {scopeLabel && (
                      <p className="mt-4 text-[11px] font-bold text-slate-500 break-words">{scopeLabel}</p>
                    )}
                    {canResetPasswordForUser(user) && (
                      <button
                        type="button"
                        onClick={() => setResetPasswordTarget(user)}
                        className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400 hover:text-indigo-300 transition-all"
                      >
                        Restablecer contraseña
                      </button>
                    )}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-300">{formatUserCreatedAt(user.createdAt)}</span>
                      {canEditUser(user) ? (
                        <button
                          type="button"
                          onClick={() => setEditingUser(user)}
                          disabled={savingUserId === user.id}
                          className="px-4 py-3 rounded-[1rem] bg-slate-950 border border-slate-800 hover:border-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.18em] transition-all flex items-center gap-2 disabled:opacity-60"
                        >
                          <Edit2 size={14} />
                          Editar
                        </button>
                      ) : (
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Sin edición</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block rounded-[2.4rem] border border-white/5 bg-black/35 overflow-hidden">
              <div className="grid grid-cols-[minmax(240px,1.2fr)_minmax(320px,1.4fr)_minmax(180px,0.8fr)_160px_180px] gap-4 px-6 py-5 border-b border-white/5 text-[9px] font-black uppercase tracking-[0.24em] text-slate-500">
                <span>Nombre de usuario</span>
                <span>Correo</span>
                <span>Rol</span>
                <span>Fecha de alta</span>
                <span>Acciones</span>
              </div>

              <div className="divide-y divide-white/5">
                {users.map((user) => {
                  const primaryRole = getPrimaryRole(user);
                  const roleMeta = primaryRole
                    ? (ROLE_META[primaryRole] || { label: primaryRole, badge: 'bg-slate-700 text-white border-slate-500' })
                    : { label: 'Sin rol', badge: 'bg-slate-950 text-slate-400 border-slate-700' };
                  const displayName = user.fullName || user.email || 'Usuario sin nombre';

                  return (
                    <div
                      key={user.id}
                      className="grid grid-cols-[minmax(240px,1.2fr)_minmax(320px,1.4fr)_minmax(180px,0.8fr)_160px_180px] gap-4 px-6 py-5 items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-base font-black uppercase italic tracking-tighter text-white break-all">
                          {displayName}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-300 break-all">
                          {user.email || 'Sin correo'}
                        </p>
                        {(() => {
                          const scopeLabel = isSuperAdmin
                            ? [user.barbershopName, user.branchName].filter(Boolean).join(' • ')
                            : (user.branchName || '');
                          return scopeLabel ? (
                            <p className="mt-2 text-[11px] text-slate-500">
                              {scopeLabel}
                            </p>
                          ) : null;
                        })()}
                        {canResetPasswordForUser(user) && (
                          <button
                            type="button"
                            onClick={() => setResetPasswordTarget(user)}
                            className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400 hover:text-indigo-300 transition-all"
                          >
                            Restablecer contraseña
                          </button>
                        )}
                      </div>

                      <div>
                        <span className={`inline-flex px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] ${roleMeta.badge}`}>
                          {roleMeta.label}
                        </span>
                      </div>

                      <div className="text-sm font-bold text-slate-300">
                        {formatUserCreatedAt(user.createdAt)}
                      </div>

                      <div className="flex items-center">
                        {canEditUser(user) ? (
                          <button
                            type="button"
                            onClick={() => setEditingUser(user)}
                            disabled={savingUserId === user.id}
                            className="px-4 py-3 rounded-[1rem] bg-slate-950 border border-slate-800 hover:border-indigo-500 text-white font-black uppercase italic text-[10px] tracking-[0.18em] transition-all flex items-center gap-2 disabled:opacity-60"
                          >
                            <Edit2 size={14} />
                            Editar
                          </button>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">
                            Sin edición
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </>
          )}

          {!users.length && (
            <div className="rounded-[2.4rem] border border-dashed border-slate-800 bg-black/20 px-8 py-16 text-center">
              <p className="text-[11px] font-black uppercase italic tracking-[0.24em] text-slate-500">
            No encontramos usuarios con ese criterio de búsqueda
              </p>
            </div>
          )}

          {resetPasswordTarget && (
            <Suspense fallback={accessUiFallback}>
                <PasswordActionModal
              title="Contraseña temporal"
              subtitle={resetPasswordTarget.fullName || resetPasswordTarget.email}
              submitLabel="Guardar contraseña temporal"
              busy={resettingPasswordUserId === resetPasswordTarget.id}
                  onClose={() => setResetPasswordTarget(null)}
                  onSubmit={async ({ nextPassword }) => {
                    const success = await onResetUserPassword(resetPasswordTarget, nextPassword);
                    if (success) {
                      notify(`Contraseña temporal actualizada para ${resetPasswordTarget.email}.`, 'success');
                      setResetPasswordTarget(null);
                      return true;
                    }
                    return false;
                  }}
                  nextLabel="Nueva contraseña temporal"
                  nextPlaceholder="Mínimo 6 caracteres"
                  initialNextPassword=""
                  initialConfirmPassword=""
                  nextInputType="password"
                  confirmInputType="password"
                />
            </Suspense>
              )}

          {editingUser && (
            <Suspense fallback={accessUiFallback}>
            <UserEditorModal
              key={editingUser.id}
              user={editingUser}
              roleOptions={getEditableRoleOptionsForUser(editingUser)}
              barbershops={isSuperAdmin ? barbershops : [currentBarbershop].filter(Boolean)}
              branches={isSuperAdmin ? branches : branchesForCurrentBarbershop}
              isSuperAdmin={isSuperAdmin}
              busy={savingUserId === editingUser.id}
              onClose={() => setEditingUser(null)}
              onSubmit={handleSubmitEditUser}
            />
            </Suspense>
          )}
        </div>
      </section>
      )}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(hasSupabaseConfig);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [showSelfPasswordModal, setShowSelfPasswordModal] = useState(false);
  const [accessControl, setAccessControl] = useState({ roles: [], users: [], currentUserRoles: [], currentBarbershopId: null, currentBranchId: null, barbershops: [], branches: [] });
  const [accessLoading, setAccessLoading] = useState(false);
  const [clientDirectoryData, setClientDirectoryData] = useState({ clients: [], appointments: [], barbers: [] });
  const [clientDirectoryLoaded, setClientDirectoryLoaded] = useState(false);
  const [clientDirectoryWarnings, setClientDirectoryWarnings] = useState([]);
  const [operationalWarnings, setOperationalWarnings] = useState([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [savingUserId, setSavingUserId] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [superAdminViewBarbershopId, setSuperAdminViewBarbershopId] = useState('');
  const [feedbackToast, setFeedbackToast] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const feedbackTimerRef = useRef(null);
  
  const useBrowserCache = isLocalDevModeEnabled && !hasSupabaseConfig && !shouldBlockWithoutSupabase;
  const localDevStorage = useBrowserCache ? globalThis.sessionStorage : null;
  const [appointments, setAppointments] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_appointments') || null;
    const list = saved ? JSON.parse(saved) : [];
    return list.map(a => ({
      ...a,
      type: a.type || 'reserva',
      status: a.status || 'Confirmada',
      durationMinutes: Number(a.durationMinutes) > 0 ? Number(a.durationMinutes) : 30,
      isPaid: !!a.isPaid
    }));
  });
  
  const [services, setServices] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_services') || null;
    if (saved) return JSON.parse(saved);
    if (!shouldSeedLocalDevMode) return [];
    return [
      { id: '1', name: 'Corte Clásico', price: 250, category: 'Cortes' },
      { id: '2', name: 'Perfilado Barba', price: 150, category: 'Barba' },
      { id: '3', name: 'Pomada Premium', price: 350, category: 'Producto' },
      { id: '4', name: 'Combo Master', price: 400, category: 'Combo', items: ['1', '2'] },
      {
        id: '5',
        name: 'Corte gratis por fidelidad',
        price: 0,
        category: 'Promocion',
        appliesTo: 'Servicio',
        discountType: 'percentage',
        discountValue: 100,
        targetServiceIds: ['1'],
        isOptional: true,
      },
    ];
  });
  
  const [clients, setClients] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_clients') || null;
    const list = saved ? JSON.parse(saved) : (
      !shouldSeedLocalDevMode
        ? []
        : [{ id: 'c1', name: 'Carlos Mendoza', phone: '8888-0001', notes: 'Prefiere corte con tijera arriba.', points: 5, createdAt: new Date().toISOString() }]
    );
    return list.map(client => ({ ...client, phone: formatPhoneNumber(client.phone || '') }));
  });

  const [barbers, setBarbers] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_barbers') || null;
    const list = saved ? JSON.parse(saved) : (!shouldSeedLocalDevMode ? [] : MOCK_BARBERS.map(b => ({ ...b, salary: 0, phone: '', email: '' })));
    return list.map((b, idx) => ensureBarberTheme(b, idx));
  });
  const [posSales, setPosSales] = useState(() => {
    const saved = localDevStorage?.getItem('bp_dev_pos_sales') || null;
    return saved ? JSON.parse(saved) : [];
  });
  
  const [viewDate, setViewDate] = useState(getTodayString());
  const bootstrapCompletedRef = useRef(false);
  const lastSessionUserIdRef = useRef(null);
  const currentUserRoles = useMemo(() => accessControl.currentUserRoles || [], [accessControl.currentUserRoles]);
  const isSuperAdmin = currentUserRoles.includes('super_admin');
  const availableBarbershops = useMemo(() => accessControl.barbershops || [], [accessControl.barbershops]);
  const availableBranches = useMemo(() => accessControl.branches || [], [accessControl.branches]);
  const effectiveOperationalBarbershopId = isSuperAdmin
    ? (superAdminViewBarbershopId || availableBarbershops[0]?.id || null)
    : (accessControl.currentBarbershopId || null);
  const effectiveOperationalBranchId = isSuperAdmin ? null : (accessControl.currentBranchId || null);
  const superAdminScopeOverride = useMemo(() => (
    isSuperAdmin && effectiveOperationalBarbershopId
      ? { currentBarbershopId: effectiveOperationalBarbershopId, currentBranchId: null }
      : {}
  ), [isSuperAdmin, effectiveOperationalBarbershopId]);

  const notify = (message, tone = 'info') => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedbackToast({ id: Date.now(), message, tone });
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackToast(null);
      feedbackTimerRef.current = null;
    }, 3600);
  };

  const renderPersistentWarningBanner = (title, messages = []) => (
    <div className="mx-8 mt-6 rounded-[1.8rem] border border-amber-500/25 bg-amber-500/10 px-6 py-5 text-amber-100 shadow-[0_12px_30px_rgba(245,158,11,0.08)]">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
          <Info size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300 leading-none">{title}</p>
          <div className="mt-3 space-y-2">
            {messages.map((message, index) => (
              <p key={`${title}-${index}`} className="text-sm font-bold leading-relaxed text-amber-50">
                {message}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const confirmAction = (options) => new Promise((resolve) => {
    setConfirmState({
      title: options?.title || 'Confirmar acción',
      message: options?.message || '',
      confirmLabel: options?.confirmLabel || 'Confirmar',
      cancelLabel: options?.cancelLabel || 'Cancelar',
      tone: options?.tone || 'danger',
      resolve,
    });
  });

  const feedbackContextValue = useMemo(() => ({
    notify,
    confirmAction,
  }), []);

  const clearScopedOperationalState = () => {
    setAppointments([]);
    setServices([]);
    setClients([]);
    setBarbers([]);
    setPosSales([]);
    setOperationalWarnings([]);
    setClientDirectoryData({ clients: [], appointments: [], barbers: [] });
    setClientDirectoryLoaded(false);
    setClientDirectoryWarnings([]);
  };

  useEffect(() => () => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    if (confirmState?.resolve) {
      confirmState.resolve(false);
    }
  }, [confirmState]);

  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_appointments', JSON.stringify(appointments));
  }, [appointments, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_services', JSON.stringify(services));
  }, [services, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_clients', JSON.stringify(clients));
  }, [clients, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_barbers', JSON.stringify(barbers));
  }, [barbers, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.setItem('bp_dev_pos_sales', JSON.stringify(posSales));
  }, [posSales, useBrowserCache, localDevStorage]);
  useEffect(() => {
    if (!useBrowserCache) return;
    localDevStorage?.removeItem('bp_dev_revenue');
  }, [useBrowserCache, localDevStorage]);
  const [modals, setModals] = useState({ 
    appointment: false, service: false, finalize: false, client: false, clientDetail: false, paymentReceipt: false, staffSettlement: false, posSaleReceipt: false
  });
  
  const [selectedData, setSelectedData] = useState({ 
    appointment: null, service: null, finalize: null, client: null, paymentReceipt: null, staffSettlement: null, posSaleReceipt: null
  });

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        console.error('No se pudo restaurar la sesión:', error);
        setAuthError('No pude restaurar la sesión guardada.');
      }
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      const previousUserId = lastSessionUserIdRef.current;
      const nextUserId = nextSession?.user?.id || null;
      if (previousUserId !== nextUserId) {
        bootstrapCompletedRef.current = false;
        clearScopedOperationalState();
        setLoading(Boolean(nextSession));
      }
      lastSessionUserIdRef.current = nextUserId;
      setSession(nextSession ?? null);
      setAuthError('');
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) {
      setSuperAdminViewBarbershopId('');
      return;
    }

    const hasSelectedBarbershop = availableBarbershops.some(
      (shop) => String(shop.id) === String(superAdminViewBarbershopId || ''),
    );

    if (!hasSelectedBarbershop && availableBarbershops.length) {
      setSuperAdminViewBarbershopId(String(availableBarbershops[0].id));
    }
  }, [isSuperAdmin, availableBarbershops, superAdminViewBarbershopId]);
  
  useEffect(() => {
    let ignore = false;

    const bootstrap = async () => {
      try {
        if (hasSupabaseConfig) {
          if (!session) {
            if (!ignore) {
              clearScopedOperationalState();
            }
            return;
          }
          if (!ignore) setLoading(true);
          const snapshot = await fetchBarbershopSnapshot(session.user.id, superAdminScopeOverride);
          if (ignore) return;

          setServices(snapshot.services);
          setClients(snapshot.clients);
          setBarbers(snapshot.barbers.map((barber, index) => ensureBarberTheme(barber, index)));
          setAppointments(snapshot.appointments);
          setPosSales(snapshot.posSales || []);
          setOperationalWarnings(snapshot.posSalesLoadError ? [snapshot.posSalesLoadError] : []);
          if (snapshot.posSalesLoadError) {
            notify(`Advertencia de POS\n\n${snapshot.posSalesLoadError}`, 'warning');
          }
        }
      } catch (error) {
        console.error('No se pudo cargar Supabase:', error);
        if (!ignore) {
          setOperationalWarnings([]);
        }
      } finally {
        if (!ignore) {
          bootstrapCompletedRef.current = true;
          setLoading(false);
        }
      }
    };

    bootstrap();

    return () => {
      ignore = true;
    };
  }, [session, effectiveOperationalBarbershopId, superAdminScopeOverride]);

  useEffect(() => {
    if (!hasSupabaseConfig || !session?.user?.id) {
      setAccessControl({ roles: [], users: [], currentUserRoles: [], currentBarbershopId: null, currentBranchId: null, barbershops: [], branches: [] });
      return undefined;
    }

    let ignore = false;

    const loadAccessControl = async () => {
      setAccessLoading(true);
      try {
        const snapshot = await fetchAccessControlSnapshot(session.user.id);
        if (!ignore) {
          setAccessControl(snapshot);
        }
      } catch (error) {
        console.error('No se pudo cargar control de acceso:', error);
        if (!ignore) {
          const details = error?.message ? `\n\n${error.message}` : '';
          notify(`No pude cargar usuarios/sucursales desde Supabase.${details}`, 'error');
        }
      } finally {
        if (!ignore) {
          setAccessLoading(false);
        }
      }
    };

    loadAccessControl();

    return () => {
      ignore = true;
    };
  }, [session]);

  useEffect(() => {
    setClientDirectoryLoaded(false);
    setClientDirectoryData({ clients: [], appointments: [], barbers: [] });
    setClientDirectoryWarnings([]);
  }, [session?.user?.id, effectiveOperationalBarbershopId, superAdminScopeOverride]);

  useEffect(() => {
    if (!hasSupabaseConfig || !session?.user?.id || activeTab !== 'clientes' || clientDirectoryLoaded) return undefined;

    let ignore = false;

    const loadClientDirectoryData = async () => {
      try {
        const snapshot = await fetchClientDirectorySnapshot(session.user.id, superAdminScopeOverride);
        if (!ignore) {
          setClientDirectoryData({
            clients: snapshot.clients.map(client => ({ ...client, phone: formatPhoneNumber(client.phone || '') })),
            appointments: snapshot.appointments,
            barbers: snapshot.barbers.map((barber, index) => ensureBarberTheme(barber, index)),
          });
          setClientDirectoryWarnings(snapshot.warnings || []);
          if (snapshot.warnings?.length) {
            notify(`Clientes cargados con advertencias\n\n${snapshot.warnings.join('\n\n')}`, 'warning');
          }
          setClientDirectoryLoaded(true);
        }
      } catch (error) {
        console.error('No se pudo cargar el directorio de clientes:', error);
        if (!ignore) {
          setClientDirectoryWarnings([]);
        }
      }
    };

    loadClientDirectoryData();

    return () => {
      ignore = true;
    };
  }, [session, activeTab, clientDirectoryLoaded, effectiveOperationalBarbershopId, superAdminScopeOverride]);

  const handleSignIn = async (email, password) => {
    if (!supabase) return;

    setAuthBusy(true);
    setAuthError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthError(error.message || 'No pude iniciar sesión.');
    }

    setAuthBusy(false);
  };

  const handleSignOut = async () => {
    if (!supabase) return;

    setAuthBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthError(error.message || 'No pude cerrar sesión.');
    } else {
      bootstrapCompletedRef.current = false;
    }
    setAuthBusy(false);
  };

  const handleChangeOwnPassword = async ({ nextPassword }) => {
    if (!supabase) return false;
    setPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: nextPassword,
        data: {
          ...(session?.user?.user_metadata || {}),
          must_change_password: false,
        },
      });
      if (error) throw error;
      const { data: refreshedSession } = await supabase.auth.getSession();
      setSession(refreshedSession.session ?? session);
      notify('Tu contraseña se actualizó correctamente.', 'success');
      setShowSelfPasswordModal(false);
      return true;
    } catch (error) {
      handleSyncError(error, 'No pude actualizar tu contraseña.');
      return false;
    } finally {
      setPasswordBusy(false);
    }
  };

  useEffect(() => {
    if (session?.user?.user_metadata?.must_change_password) {
      setShowSelfPasswordModal(true);
    }
  }, [session]);

  const handleUpdateUserProfile = async (user, payload) => {
    if (!isAdmin || !user) {
      notify('Solo un administrador puede editar usuarios.', 'warning');
      return false;
    }

    const currentRole = getPrimaryRole(user);
    const nextRole = payload.roleName || currentRole || 'cashier';

    if (!isSuperAdmin) {
      if (currentRole !== 'cashier' || String(user.barbershopId || '') !== String(currentBarbershopId || '')) {
        notify('Solo puedes editar usuarios Caja de tu propia barbería.', 'warning');
        return false;
      }
    }

    if (!isSuperAdmin && nextRole !== 'cashier') {
      notify('Un administrador de barbería solo puede asignar el rol Caja.', 'warning');
      return false;
    }

    const targetBarbershopId = isSuperAdmin
      ? (payload.barbershopId || user.barbershopId || null)
      : (currentBarbershopId || user.barbershopId || null);
    const targetBranchId = payload.branchId || null;

    setSavingUserId(user.id);
    try {
      await updateManagedUserProfile(user.id, {
        fullName: payload.fullName,
        barbershopId: targetBarbershopId,
        branchId: targetBranchId,
      });

      if (nextRole !== currentRole) {
        await replaceUserRoles(user.id, [nextRole]);
      }

      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      setAccessControl(snapshot);
      return true;
    } catch (error) {
      throw new Error(error?.message || 'No pude actualizar el usuario.');
    } finally {
      setSavingUserId(null);
    }
  };

  const handleCreateSystemUser = async (payload) => {
    if (!isAdmin) {
      notify('Solo un administrador puede crear nuevas cuentas.', 'warning');
      return null;
    }

    if (!isSuperAdmin && payload.roleName !== 'cashier') {
      notify('Un administrador de barbería solo puede crear usuarios de caja.', 'warning');
      return null;
    }

    if (!isSuperAdmin && !currentBarbershopId) {
      notify('Tu usuario administrador no tiene una barbería asignada.', 'error');
      return null;
    }

    const normalizedPayload = !isSuperAdmin
      ? {
          ...payload,
          roleName: 'cashier',
          barbershopId: currentBarbershopId,
          branchId: payload.branchId || accessControl.currentBranchId || null,
        }
      : payload;

    setCreatingUser(true);
    try {
      const createdUser = await createManagedUser(normalizedPayload, session?.user?.id);
      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      const createdBarbershop =
        accessControl.barbershops.find((shop) => String(shop.id) === String(createdUser.barbershopId || normalizedPayload.barbershopId || ''))
        || currentBarbershop
        || availableBarbershops[0]
        || null;
      const createdBranch =
        accessControl.branches.find((branch) => String(branch.id) === String(createdUser.branchId || normalizedPayload.branchId || ''))
        || currentBranch
        || null;
      const optimisticUser = {
        id: createdUser.id,
        email: createdUser.email,
        fullName: createdUser.fullName || createdUser.email,
        createdAt: new Date().toISOString(),
        roles: [createdUser.roleName || normalizedPayload.roleName],
        barbershopId: createdUser.barbershopId || normalizedPayload.barbershopId || null,
        barbershopName: createdBarbershop?.name || '',
        branchId: createdUser.branchId || normalizedPayload.branchId || null,
        branchName: createdBranch?.name || '',
      };
      const nextSnapshot = snapshot?.users?.some((user) => String(user.id) === String(createdUser.id))
        ? snapshot
        : {
            ...snapshot,
            users: [...(snapshot?.users || []), optimisticUser],
          };
      setAccessControl(nextSnapshot);
      notify(`Usuario ${createdUser.fullName || createdUser.email} creado correctamente.`, 'success');
      return createdUser;
    } catch (error) {
      handleSyncError(error, 'No pude crear el usuario del sistema.');
      return null;
    } finally {
      setCreatingUser(false);
    }
  };

  const handleResetUserPassword = async (user, password) => {
    if (!isAdmin) {
      notify('Solo un administrador puede restablecer contraseñas.', 'warning');
      return false;
    }

    if (!isSuperAdmin && getPrimaryRole(user) !== 'cashier') {
      notify('Un administrador de barbería solo puede restablecer contraseñas de usuarios Caja.', 'warning');
      return false;
    }

    setResettingPasswordUserId(user.id);
    try {
      await resetManagedUserPassword({ userId: user.id, password });
      return true;
    } catch (error) {
      throw new Error(error?.message || 'No pude restablecer la contraseña de este usuario.');
    } finally {
      setResettingPasswordUserId(null);
    }
  };

  const handleCreateBranch = async (payload) => {
    if (!isAdmin) {
      notify('Solo un administrador puede crear sucursales.', 'warning');
      return null;
    }

    setOnboardingBusy(true);
    try {
      const resolvedBarbershopId = isSuperAdmin
        ? payload.barbershopId
        : (currentBarbershopId || currentBarbershop?.id || '');

      if (!resolvedBarbershopId) {
        notify('Selecciona una barbería para crear la sucursal.', 'warning');
        return null;
      }

      const createdBranch = await upsertBranch({
        id: payload.id || makeId(),
        name: payload.name,
        code: payload.code,
        city: payload.city,
        address: payload.address,
        barbershopId: resolvedBarbershopId,
        isActive: payload.isActive ?? true,
      });

      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      setAccessControl(snapshot);
      notify(`Sucursal ${payload.id ? 'actualizada' : 'creada'} correctamente.`, 'success');
      return createdBranch;
    } catch (error) {
      handleSyncError(error, 'No pude crear la sucursal.');
      return null;
    } finally {
      setOnboardingBusy(false);
    }
  };

  const handleCreateBarbershop = async (payload) => {
    if (!isSuperAdmin) {
      notify('Solo el super usuario puede crear nuevos negocios.', 'warning');
      return null;
    }

    setOnboardingBusy(true);
    try {
      const createdBarbershop = await upsertBarbershop({
        id: makeId(),
        name: payload.name,
        ownerEmail: payload.ownerEmail,
        phone: payload.phone,
        city: payload.city,
        plan: payload.plan,
        isActive: true,
      });

      if (payload.adminUserId) {
        await assignProfileBarbershop(payload.adminUserId, createdBarbershop.id);
        const targetUser = (accessControl.users || []).find((user) => String(user.id) === String(payload.adminUserId));
        const preservedRoles = new Set((targetUser?.roles || []).filter((role) => role === 'super_admin'));
        preservedRoles.add('admin');
        await replaceUserRoles(payload.adminUserId, [...preservedRoles]);
      }

      const snapshot = await fetchAccessControlSnapshot(session?.user?.id);
      setAccessControl(snapshot);
      notify(`Negocio ${createdBarbershop.name} creado correctamente.`, 'success');
      return createdBarbershop;
    } catch (error) {
      handleSyncError(error, 'No pude completar el onboarding del negocio.');
      return null;
    } finally {
      setOnboardingBusy(false);
    }
  };
  const defaultBarberId = barbers[0]?.id || '';
  const currentBarbershopId = effectiveOperationalBarbershopId;
  const currentBranchId = effectiveOperationalBranchId;
  const currentBarbershop = availableBarbershops.find((shop) => String(shop.id) === String(currentBarbershopId || ''))
    || availableBarbershops[0]
    || null;
  const currentBranch = availableBranches.find((branch) => String(branch.id) === String(currentBranchId || '')) || null;
  const isAdmin = isSuperAdmin || currentUserRoles.includes('admin');
  const isCashier = currentUserRoles.includes('cashier');
  const effectiveClientDirectory = useMemo(() => ({
    clients: clientDirectoryLoaded
      ? mergeEntitiesById(clients, clientDirectoryData.clients)
      : clients,
    appointments: clientDirectoryLoaded
      ? mergeEntitiesById(clientDirectoryData.appointments, appointments)
      : appointments,
    barbers: clientDirectoryLoaded
      ? mergeEntitiesById(clientDirectoryData.barbers, barbers)
      : barbers,
  }), [clientDirectoryLoaded, clientDirectoryData, clients, appointments, barbers]);
  const roleFilterEnabled = hasSupabaseConfig && !accessLoading && currentUserRoles.length > 0;
  const navItems = [
    { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard, allow: true },
    { id: 'agenda', label: 'Calendario', icon: CalendarIcon, allow: isAdmin || isCashier },
    { id: 'clientes', label: 'Clientes', icon: Users, allow: isAdmin || isCashier },
    { id: 'barberos', label: 'Barbero', icon: UserCheck, allow: isAdmin },
    { id: 'services', label: 'Servicios', icon: Scissors, allow: isAdmin },
    { id: 'caja', label: 'Venta / POS', icon: ShoppingBag, allow: isAdmin || isCashier },
    { id: 'reportes', label: 'Reportes', icon: BarChart3, allow: isAdmin },
    { id: 'sistema', label: 'Sistema', icon: Layers, allow: isAdmin },
  ].filter((item) => {
    return !roleFilterEnabled || item.allow;
  });
  const accessibleTabIds = useMemo(() => {
    const nextIds = new Set(navItems.map((item) => item.id));
    if (isAdmin) {
      nextIds.add('nomina');
    }
    return nextIds;
  }, [navItems, isAdmin]);
  const handleSyncError = (error, fallbackMessage) => {
    console.error(error);
    const details = error?.message ? `\n\n${error.message}` : '';
    notify(`${fallbackMessage}${details}`, 'error');
  };
  const refreshClientsAfterAppointmentSync = async () => {
    if (!hasSupabaseConfig || !session?.user?.id) return;

    const nextClients = await fetchScopedClients(session.user.id, superAdminScopeOverride);
    setClients(nextClients);

    if (clientDirectoryLoaded) {
      setClientDirectoryData((prev) => ({
        ...prev,
        clients: mergeEntitiesById(nextClients, prev.clients),
      }));
    }
  };

  useEffect(() => {
    if (!accessibleTabIds.has(activeTab)) {
      setActiveTab(navItems[0]?.id || 'dashboard');
    }
  }, [activeTab, accessibleTabIds, navItems]);

  if (authLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black gap-4 text-white">
        <style>{styleTag}</style>
        <Loader2 className="animate-spin text-indigo-500" size={48} />
        <span className="text-[10px] font-black uppercase tracking-widest italic">Verificando sesión...</span>
      </div>
    );
  }

  if (shouldBlockWithoutSupabase) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <style>{styleTag}</style>
        <div className="w-full max-w-2xl rounded-[2rem] border border-rose-500/20 bg-slate-950 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <ShieldCheck size={26} className="text-rose-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter">Configuración requerida</h1>
              <p className="mt-2 text-sm text-slate-300">
                Esta instalación está en modo producción y requiere una conexión válida a Supabase.
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-black/40 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Variables faltantes</p>
            <div className="mt-4 space-y-2 text-sm font-mono text-rose-200">
              {!import.meta.env.VITE_SUPABASE_URL && <p>VITE_SUPABASE_URL</p>}
              {!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && <p>VITE_SUPABASE_PUBLISHABLE_KEY</p>}
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-400 leading-relaxed">
            La aplicación fue bloqueada para evitar que opere con datos locales aislados en cada navegador. Configura las variables de entorno del servidor y vuelve a desplegar.
          </p>
        </div>
      </div>
    );
  }

  if (!hasSupabaseConfig && !useBrowserCache) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <style>{styleTag}</style>
        <div className="w-full max-w-2xl rounded-[2rem] border border-amber-500/20 bg-slate-950 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Info size={26} className="text-amber-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase italic tracking-tighter">Configuración pendiente</h1>
              <p className="mt-2 text-sm text-slate-300">
                No hay una conexión válida a Supabase y el modo local está desactivado para evitar datos de prueba confusos.
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-black/40 p-5 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cómo continuar</p>
            <p className="text-sm text-slate-300">Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` para trabajar con datos reales.</p>
            <p className="text-sm text-slate-300">Si necesitas una prueba local intencional, activa `VITE_ENABLE_LOCAL_MODE=true`.</p>
            <p className="text-sm text-slate-500">Para sembrar datos demo en ese modo, agrega también `VITE_SEED_LOCAL_MODE=true`.</p>
          </div>
        </div>
      </div>
    );
  }

  if (hasSupabaseConfig && !session) {
    return (
      <Suspense fallback={accessUiFallback}>
        <LoginScreen onSignIn={handleSignIn} authBusy={authBusy} authError={authError} />
      </Suspense>
    );
  }

  const handleUpdateStatus = async (id, status, extra = null) => {
    const apt = appointments.find(a => a.id === id);
    if (!apt) return;

    if (status === 'Finalizada' && !extra) {
      setSelectedData({ ...selectedData, finalize: apt });
      setModals({ ...modals, finalize: true });
      return;
    }

    const updatedAppointment = {
      ...apt,
      status,
      service: extra ? extra.serviceName : apt.service,
      price: extra ? extra.price : apt.price,
      rating: extra ? extra.rating : apt.rating,
    };

    if (status === 'En Espera' && !apt.checkInAt) {
      updatedAppointment.checkInAt = new Date().toISOString();
    }

    if (status === 'En Corte' && !apt.startedAt) {
      updatedAppointment.startedAt = new Date().toISOString();
      if (!updatedAppointment.checkInAt) updatedAppointment.checkInAt = apt.createdAt;
    }

    if (status === 'Finalizada' && !updatedAppointment.finishedAt) {
      updatedAppointment.finishedAt = new Date().toISOString();
    }

    if (status === 'Cita Perdida' && !updatedAppointment.cancelledAt) {
      updatedAppointment.cancelledAt = new Date().toISOString();
    }

    setAppointments(prev => prev.map(a => (a.id === id ? updatedAppointment : a)));

    if (status === 'Finalizada') {
      setModals({ ...modals, finalize: false });
    }

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertAppointments([updatedAppointment], services, currentBarbershopId, currentBranchId, barbers, clients);
        await refreshClientsAfterAppointmentSync();
      } catch (error) {
        handleSyncError(error, 'No pude guardar el cambio de estado en Supabase.');
      }
    }
  };

  const handleConfirmPayment = async (barberId) => {
    const updatedAppointments = appointments
      .filter(a => String(a.barberId) === String(barberId) && a.status === 'Finalizada')
      .map(a => ({ ...a, isPaid: true }));

    setAppointments(prev => prev.map(a => 
      String(a.barberId) === String(barberId) && a.status === 'Finalizada' ? { ...a, isPaid: true } : a
    ));
    setModals({ ...modals, paymentReceipt: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current && updatedAppointments.length) {
      try {
        await upsertAppointments(updatedAppointments, services, currentBarbershopId, currentBranchId, barbers, clients);
      } catch (error) {
        handleSyncError(error, 'No pude liquidar el pago en Supabase.');
      }
    }
  };

  const handleConfirmStaffSettlement = async (barberIds = []) => {
    const normalizedIds = new Set((barberIds || []).map(id => String(id)));
    const updatedAppointments = appointments
      .filter(a => normalizedIds.has(String(a.barberId)) && a.status === 'Finalizada' && !a.isPaid)
      .map(a => ({ ...a, isPaid: true }));

    setAppointments(prev => prev.map(a =>
      normalizedIds.has(String(a.barberId)) && a.status === 'Finalizada' && !a.isPaid
        ? { ...a, isPaid: true }
        : a
    ));
    setModals(prev => ({ ...prev, staffSettlement: false }));

    if (hasSupabaseConfig && bootstrapCompletedRef.current && updatedAppointments.length) {
      try {
        await upsertAppointments(updatedAppointments, services, currentBarbershopId, currentBranchId, barbers, clients);
      } catch (error) {
        handleSyncError(error, 'No pude liquidar la planilla en Supabase.');
      }
    }
  };

  const handleSaveAppointment = async (aptData, clientData) => {
    let finalClientId = clientData.id;
    const now = new Date().toISOString();
    const normalizedPhone = formatPhoneNumber(clientData.phone || '');
    let createdClient = null;

    if (clientData.isNew) {
      const duplicateClient = findClientByPhone(clients, normalizedPhone);
      if (duplicateClient) {
        notify(`Este número ya pertenece a ${duplicateClient.name}. Selecciona ese cliente existente.`, 'warning');
        return;
      }

      createdClient = {
        id: makeId(),
        name: clientData.name,
        phone: normalizedPhone,
        notes: '',
        points: 0,
        createdAt: now,
        completedVisits: 0,
        totalSpent: 0,
        lastVisitAt: null,
        favoriteBarberId: null,
        favoriteBarberName: '',
        favoriteServiceName: '',
        statsUpdatedAt: null,
      };
      setClients([...clients, createdClient]);
      finalClientId = createdClient.id;
    }

    const newApt = {
      id: makeId(),
      ...aptData,
      clientId: finalClientId,
      type: aptData.type || 'reserva',
      durationMinutes: Number(aptData.durationMinutes) > 0 ? Number(aptData.durationMinutes) : 30,
      status: 'Confirmada',
      createdAt: now,
      checkInAt: aptData.type === 'walkin' ? now : null,
      isPaid: false
    };

    setAppointments([...appointments, newApt]);
    setModals({ ...modals, appointment: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        if (createdClient) {
          await upsertClients([createdClient], currentBarbershopId);
        }
        await upsertAppointments([newApt], services, currentBarbershopId, currentBranchId, barbers, clients);
      } catch (error) {
        handleSyncError(error, 'No pude guardar la cita en Supabase.');
      }
    }
  };

  const handleSaveClient = async (clientData) => {
    const normalizedClient = {
      ...clientData,
      phone: formatPhoneNumber(clientData.phone || ''),
    };
    const duplicateClient = findClientByPhone(clients, normalizedClient.phone, selectedData.client?.id);

    if (duplicateClient) {
      notify(`Este número ya pertenece a ${duplicateClient.name}.`, 'warning');
      return;
    }

    let savedClient;
    if (selectedData.client) {
      savedClient = { ...selectedData.client, ...normalizedClient };
      setClients(prev => prev.map(c => c.id === selectedData.client.id ? savedClient : c));
      setSelectedData(prev => ({ ...prev, client: savedClient }));
    } else {
      savedClient = {
        id: makeId(),
        ...normalizedClient,
        points: 0,
        createdAt: new Date().toISOString(),
        completedVisits: 0,
        totalSpent: 0,
        lastVisitAt: null,
        favoriteBarberId: null,
        favoriteBarberName: '',
        favoriteServiceName: '',
        statsUpdatedAt: null,
      };
      setClients([...clients, savedClient]);
    }
    setModals({ ...modals, client: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current && savedClient) {
      try {
        await upsertClients([savedClient], currentBarbershopId);
      } catch (error) {
        handleSyncError(error, 'No pude guardar el cliente en Supabase.');
      }
    }
  };

  const handleSaveService = async (serviceData) => {
    const isPromotion = serviceData.category === 'Promocion';
    const normalizedService = {
      ...serviceData,
      price: isPromotion ? 0 : Number(serviceData.price) || 0,
      items: serviceData.category === 'Combo' ? serviceData.items : [],
      appliesTo: isPromotion ? (serviceData.appliesTo || 'Servicio') : 'Servicio',
      discountType: isPromotion ? (serviceData.discountType || 'percentage') : 'percentage',
      discountValue: isPromotion ? Number(serviceData.discountValue) || 0 : 0,
      targetServiceIds: [],
      isOptional: isPromotion ? serviceData.isOptional !== false : true,
    };
    const savedService = selectedData.service?.id
      ? { ...selectedData.service, ...normalizedService }
      : { id: makeId(), ...normalizedService };
    const nextServices = selectedData.service?.id
      ? services.map(s => s.id === selectedData.service.id ? savedService : s)
      : [...services, savedService];

    if (selectedData.service?.id) {
      setServices(nextServices);
    } else {
      setServices(nextServices);
    }
    setModals({ ...modals, service: false });

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await upsertServices([savedService], currentBarbershopId);
        await syncServiceComboItems(nextServices);
      } catch (error) {
        handleSyncError(error, 'No pude guardar el servicio en Supabase.');
      }
    }
  };

  const handleDeleteClient = async (id) => {
    if (appointments.some(a => String(a.clientId) === String(id))) {
      notify('No puedes eliminar este cliente porque ya tiene citas registradas.', 'warning');
      return;
    }

    const confirmed = await confirmAction({
      title: 'Eliminar cliente',
      message: '¿Eliminar cliente permanentemente?',
      confirmLabel: 'Eliminar',
    });

    if (confirmed) {
      setClients(prev => prev.filter(c => c.id !== id));
      setModals({ ...modals, clientDetail: false });

      if (hasSupabaseConfig && bootstrapCompletedRef.current) {
        try {
          await deleteClientRecord(id);
        } catch (error) {
          handleSyncError(error, 'No pude eliminar el cliente en Supabase.');
        }
      }
    }
  };

  const handleSaveBarber = async (barber) => {
    if (!barber.name || barber.name.trim() === '') {
      notify('Ingrese nombre del barbero.', 'warning');
      return;
    }
    const normalizedPhone = formatPhoneNumber(barber.phone || '');
    const resolvedBarbershopId = barber.barbershopId || currentBarbershopId || null;
    const resolvedBranchId = barber.branchId ?? currentBranchId ?? undefined;
    if (!resolvedBranchId) {
      notify('Cada barbero debe tener una sucursal asignada.', 'warning');
      return;
    }
    let savedBarber = null;

    if (barber.id) {
      const currentIndex = barbers.findIndex(b => String(b.id) === String(barber.id));
      savedBarber = ensureBarberTheme({
        ...barber,
        phone: normalizedPhone,
        id: String(barber.id),
        barbershopId: resolvedBarbershopId,
        branchId: resolvedBranchId ?? null,
      }, Math.max(currentIndex, 0));
      setBarbers(prev => prev.map((b, idx) => String(b.id) === String(barber.id) ? ensureBarberTheme(savedBarber, idx) : b));
    } else {
      const newBarber = {
        ...barber,
        phone: normalizedPhone,
        id: makeId(),
        barbershopId: resolvedBarbershopId,
        branchId: resolvedBranchId ?? null,
      };
      savedBarber = ensureBarberTheme(newBarber, barbers.length);
      setBarbers(prev => [...prev, savedBarber]);
    }

    if (hasSupabaseConfig && bootstrapCompletedRef.current && savedBarber) {
      try {
        await upsertBarbers([savedBarber], resolvedBarbershopId, resolvedBranchId, session?.user?.id);
        if (session?.user?.id) {
          const nextBarbers = await fetchScopedBarbers(session.user.id, superAdminScopeOverride);
          setBarbers(nextBarbers.map((nextBarber, index) => ensureBarberTheme(nextBarber, index)));
        }
      } catch (error) {
        handleSyncError(error, 'No pude guardar el barbero en Supabase.');
      }
    }
  };

  const handleDeleteBarber = async (id) => {
    if (appointments.some(a => String(a.barberId) === String(id))) {
      notify('No puedes eliminar este barbero porque ya tiene citas registradas.', 'warning');
      return;
    }

    const confirmed = await confirmAction({
      title: 'Eliminar barbero',
      message: '¿Eliminar barbero permanentemente?',
      confirmLabel: 'Eliminar',
    });

    if (confirmed) {
      setBarbers(prev => prev.filter(b => b.id !== id));

      if (hasSupabaseConfig && bootstrapCompletedRef.current) {
        try {
          await deleteBarberRecord(id);
        } catch (error) {
          handleSyncError(error, 'No pude eliminar el barbero en Supabase.');
        }
      }
    }
  };

  const handleDeleteService = async (id) => {
    const isUsedInCombo = services.some(service => service.category === 'Combo' && (service.items || []).includes(id));
    if (isUsedInCombo) {
      notify('No puedes eliminar este servicio porque forma parte de un combo.', 'warning');
      return;
    }

    const nextServices = services.filter(service => service.id !== id);
    setServices(nextServices);

    if (hasSupabaseConfig && bootstrapCompletedRef.current) {
      try {
        await deleteServiceRecord(id);
        await syncServiceComboItems(nextServices);
      } catch (error) {
        handleSyncError(error, 'No pude eliminar el servicio en Supabase.');
      }
    }
  };

  const handleRegisterPosSale = async (saleDraft) => {
    const normalizedItems = Array.isArray(saleDraft?.items) ? saleDraft.items : [];
    if (!currentBarbershopId) {
      notify('No se puede registrar la venta porque no hay una barbería activa.', 'error');
      return null;
    }
    if (!currentBranchId) {
      notify('Debes seleccionar una sucursal antes de registrar una venta POS.', 'warning');
      return null;
    }
    const rawSubtotal = Number(saleDraft?.rawSubtotal) || normalizedItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
    const discountTotal = Number(saleDraft?.discountTotal || 0);
    const subtotal = Number(saleDraft?.subtotal) || Math.max(rawSubtotal - discountTotal, 0);
    const productTotal = subtotal;
    const serviceTotal = 0;
    const nextLocalTicketNumber = (posSales || []).reduce(
      (max, sale) => Math.max(max, Number(sale.ticketNumber || 0)),
      0,
    ) + 1;

    const saleRecord = {
      id: makeId(),
      ticketNumber: nextLocalTicketNumber,
      items: normalizedItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: Number(item.price) || 0,
        qty: Number(item.qty) || 0,
      })),
      rawSubtotal,
      discountTotal,
      subtotal,
      productTotal,
      serviceTotal,
      promotionId: saleDraft?.promotion?.id || null,
      promotionName: saleDraft?.promotion?.name || '',
      notes: saleDraft?.promotion?.name ? `Promoción aplicada: ${saleDraft.promotion.name}` : '',
      barbershopId: currentBarbershopId || null,
      branchId: currentBranchId || null,
      createdAt: new Date().toISOString(),
      createdBy: session?.user?.id || null,
    };

    setPosSales((prev) => [...prev, saleRecord]);

    if (!hasSupabaseConfig || !session?.user?.id) {
      setSelectedData((prev) => ({
        ...prev,
        posSaleReceipt: {
          sale: saleRecord,
          barbershopName: currentBarbershop?.name || 'BarberPro',
          branchName: currentBranch?.name || 'General',
        },
      }));
      setModals((prev) => ({ ...prev, posSaleReceipt: true }));
      notify('Venta de POS registrada.', 'success');
      return saleRecord;
    }

    try {
      const persistedSale = await createPosSale(saleRecord, session.user.id, superAdminScopeOverride);
      setPosSales((prev) => prev.map((sale) => String(sale.id) === String(saleRecord.id) ? persistedSale : sale));
      setSelectedData((prev) => ({
        ...prev,
        posSaleReceipt: {
          sale: persistedSale,
          barbershopName: currentBarbershop?.name || 'BarberPro',
          branchName: currentBranch?.name || 'General',
        },
      }));
      setModals((prev) => ({ ...prev, posSaleReceipt: true }));
      notify('Venta de POS registrada.', 'success');
      return persistedSale;
    } catch (error) {
      setPosSales((prev) => prev.filter((sale) => String(sale.id) !== String(saleRecord.id)));
      handleSyncError(error, 'No pude registrar la venta de POS en Supabase.');
      return null;
    }
  };

  const handleCancelPosSale = async (saleId) => {
    if (!saleId) return false;

    if (!hasSupabaseConfig || !session?.user?.id) {
      setPosSales((prev) => prev.filter((sale) => String(sale.id) !== String(saleId)));
      setModals((prev) => ({ ...prev, posSaleReceipt: false }));
      setSelectedData((prev) => ({ ...prev, posSaleReceipt: null }));
      notify('Venta cancelada.', 'success');
      return true;
    }

    try {
      await deletePosSaleRecord(saleId);
      setPosSales((prev) => prev.filter((sale) => String(sale.id) !== String(saleId)));
      setModals((prev) => ({ ...prev, posSaleReceipt: false }));
      setSelectedData((prev) => ({ ...prev, posSaleReceipt: null }));
      notify('Venta cancelada.', 'success');
      return true;
    } catch (error) {
      handleSyncError(error, 'No pude cancelar la venta de POS en Supabase.');
      return false;
    }
  };

  const triggerWalkIn = (barberId = defaultBarberId) => {
    if (!barberId) {
      notify('Primero debes tener barberos registrados en esta sucursal para crear un turno sin cita.', 'warning');
      return;
    }
    setSelectedData({
        ...selectedData,
        appointment: {
            date: getTodayString(),
            time: getCurrentTimeHHmm(),
            barberId,
            type: 'walkin'
        }
    });
    setModals({ ...modals, appointment: true });
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-black gap-4 text-white">
      <Loader2 className="animate-spin text-indigo-500" size={48} />
      <span className="text-[10px] font-black uppercase tracking-widest italic">Iniciando BarberPro...</span>
    </div>
  );

  return (
    <UiFeedbackContext.Provider value={feedbackContextValue}>
    <div className="flex h-screen bg-black text-white font-sans overflow-hidden">
      <style>{styleTag}</style>

      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm md:hidden no-print"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[15rem] max-w-[82vw] flex-col border-r border-slate-900 bg-slate-950 no-print transition-all duration-300 md:static md:max-w-none md:translate-x-0 ${sidebarCollapsed ? 'md:w-24' : 'md:w-64'} ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className={`p-4 md:p-8 flex items-start ${sidebarCollapsed ? 'md:justify-center md:px-4' : 'gap-3'}`}>
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] shrink-0"><Scissors size={20}/></div>
          <div className={`min-w-0 flex-1 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
            <h1 className="text-xl font-bold tracking-tighter italic text-white">BarberPro<span className="text-indigo-500">.</span></h1>
            {session?.user?.email && (
              <p className="text-[10px] font-black tracking-[0.14em] uppercase text-slate-500 mt-2 truncate">
                {session.user.email}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            className="rounded-xl border border-white/10 bg-slate-900 p-2 text-slate-400 transition-colors hover:text-white md:hidden"
            aria-label="Cerrar menú lateral"
          >
            <X size={16} />
          </button>
        </div>
        <nav className={`flex-1 overflow-y-auto px-3 md:px-4 space-y-1 ${sidebarCollapsed ? 'md:px-3' : ''}`}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileSidebarOpen(false); }} className={`w-full flex items-center px-4 py-3.5 md:py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${sidebarCollapsed ? 'md:justify-center md:px-0' : 'gap-3'} ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-[0_10px_20px_rgba(79,70,229,0.3)]' : 'text-slate-500 hover:bg-slate-900 hover:text-white'}`}>
              <item.icon size={18} />
              <span className={sidebarCollapsed ? 'md:hidden' : ''}>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className={`px-3 md:px-4 py-4 border-t border-slate-900 ${sidebarCollapsed ? 'md:px-3' : ''}`}>
          {(currentBarbershop?.name || currentBranch?.name) && !sidebarCollapsed && (
            <div className="mb-4 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 space-y-2">
              {currentBarbershop?.name && (
                <div className="min-w-0">
                  <p className="text-[9px] font-black tracking-[0.18em] uppercase text-slate-500">Barbería</p>
                  <p className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.12em] text-slate-200">{currentBarbershop.name}</p>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-[9px] font-black tracking-[0.18em] uppercase text-slate-500">Sucursal</p>
                <p className="mt-1 truncate text-[11px] font-black uppercase tracking-[0.12em] text-emerald-300">{currentBranch?.name || 'General'}</p>
              </div>
            </div>
          )}
          {hasSupabaseConfig && session?.user && (
            <button
              onClick={() => setShowSelfPasswordModal(true)}
              disabled={passwordBusy}
              className={`w-full mb-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center border border-slate-800 transition-all ${sidebarCollapsed ? 'md:px-0' : 'gap-2'}`}
              title={sidebarCollapsed ? 'Cambiar contraseña' : undefined}
            >
              {passwordBusy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              <span className={sidebarCollapsed ? 'md:hidden' : ''}>Cambiar contraseña</span>
            </button>
          )}
          {hasSupabaseConfig && (
            <button
              onClick={handleSignOut}
              disabled={authBusy}
              className={`w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center border border-slate-800 transition-all ${sidebarCollapsed ? 'md:px-0' : 'gap-2'}`}
              title={sidebarCollapsed ? 'Cerrar sesión' : undefined}
            >
              {authBusy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              <span className={sidebarCollapsed ? 'md:hidden' : ''}>Cerrar Sesión</span>
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-950 min-w-0">
        <header className="bg-black border-b border-slate-900 px-4 md:px-8 py-3 md:py-4 flex flex-col gap-3 z-20 no-print">
          <div className="flex w-full items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 text-slate-200 transition-colors hover:text-white md:hidden shrink-0"
              aria-label="Abrir menú lateral"
            >
              <Menu size={18} />
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="hidden md:flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 text-slate-200 transition-colors hover:text-white"
              aria-label={sidebarCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            >
              <Menu size={18} />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <h2 className="text-2xl md:text-2xl font-black italic uppercase text-white tracking-tighter leading-none truncate">{activeTab}</h2>
            </div>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {isSuperAdmin && activeTab !== 'sistema' && availableBarbershops.length > 0 && (
              <div className="w-full lg:flex-1 min-w-0 flex flex-col sm:flex-row items-start sm:items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-slate-900/70">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Vista actual</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Barbería</p>
                </div>
                <select
                  value={superAdminViewBarbershopId || availableBarbershops[0]?.id || ''}
                  onChange={(event) => setSuperAdminViewBarbershopId(event.target.value)}
                  className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-indigo-500 sm:min-w-[220px] lg:max-w-sm"
                >
                  {availableBarbershops.map((shop) => (
                    <option key={shop.id} value={shop.id} className="bg-slate-950 text-white">
                      {shop.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex w-full lg:w-auto flex-col sm:flex-row items-stretch sm:items-center justify-stretch sm:justify-end gap-3">
              {activeTab === 'clientes' && <button onClick={() => { setSelectedData({ ...selectedData, client: null }); setModals({ ...modals, client: true }); }} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-5 md:px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95 transition-all"><UserPlus size={16}/> Nuevo Cliente</button>}
              {activeTab === 'agenda' && <button onClick={() => { setSelectedData({ ...selectedData, appointment: { date: viewDate, time: '09:00', barberId: defaultBarberId } }); setModals({ ...modals, appointment: true }); }} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-5 md:px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95 transition-all"><Plus size={16}/> Nueva Cita</button>}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto overflow-x-hidden custom-scrollbar">
          {['dashboard', 'caja', 'reportes'].includes(activeTab) && operationalWarnings.length > 0 && renderPersistentWarningBanner('Datos operativos con advertencias', operationalWarnings)}
          {activeTab === 'clientes' && clientDirectoryWarnings.length > 0 && renderPersistentWarningBanner('Clientes cargados parcialmente', clientDirectoryWarnings)}
          {activeTab === 'dashboard' && <DashboardView appointments={appointments} clients={clients} onUpdate={handleUpdateStatus} barbers={barbers} onNewWalkin={triggerWalkIn} posSales={posSales} />}
          {activeTab === 'agenda' && <AgendaView viewDate={viewDate} setViewDate={setViewDate} appointments={appointments} clients={clients} barbers={barbers} onSlotClick={(h, b) => { setSelectedData({ ...selectedData, appointment: { date: viewDate, time: h, barberId: b } }); setModals({ ...modals, appointment: true }); }} onAptClick={(apt) => { setSelectedData({ ...selectedData, finalize: apt }); setModals({ ...modals, finalize: true }); }} />}
          {activeTab === 'clientes' && <ClientsTableView clients={effectiveClientDirectory.clients} appointments={effectiveClientDirectory.appointments} barbers={effectiveClientDirectory.barbers} onRowClick={(c) => { setSelectedData({...selectedData, client: c}); setModals({...modals, clientDetail: true}); }} onNewApt={(c) => { setSelectedData({ ...selectedData, appointment: { date: getTodayString(), time: '09:00', barberId: defaultBarberId, client: c } }); setModals({ ...modals, appointment: true }); }} />}
          {activeTab === 'barberos' && (
            <BarbersView
              barbers={barbers}
              appointments={appointments}
              branches={availableBranches}
              currentBarbershopId={currentBarbershopId}
              currentBranchId={currentBranchId}
              canChooseBranch={isAdmin}
              onSave={handleSaveBarber}
              onDelete={handleDeleteBarber}
              onGoToNomina={() => setActiveTab('nomina')}
            />
          )}
          {activeTab === 'nomina' && (
            <NominaView
              barbers={barbers}
              appointments={appointments}
              onClose={() => setActiveTab('barberos')}
              onPagar={(barber, nomina) => {
                setSelectedData({ ...selectedData, paymentReceipt: { barber, nomina } });
                setModals({ ...modals, paymentReceipt: true });
              }}
              onLiquidarTodo={(rows, summary) => {
                setSelectedData({ ...selectedData, staffSettlement: { rows, summary } });
                setModals({ ...modals, staffSettlement: true });
              }}
            />
          )}
          {activeTab === 'services' && <ServicesView services={services} onAdd={(cat) => { setSelectedData({...selectedData, service: { category: cat }}); setModals({...modals, service: true}); }} onEdit={(s) => { setSelectedData({...selectedData, service: s}); setModals({...modals, service: true}); }} onDelete={handleDeleteService} />}
          {activeTab === 'caja' && <POSView services={services} onSale={handleRegisterPosSale} />}
          {activeTab === 'reportes' && (
            <ReportsView
              appointments={appointments}
              clients={clients}
              barbers={barbers}
              branches={availableBranches}
              currentBranchId={currentBranchId}
              posSales={posSales}
            />
          )}
          {activeTab === 'sistema' && (
              <SystemView
                currentUser={session?.user}
                accessControl={accessControl}
                savingUserId={savingUserId}
                creatingUser={creatingUser}
                resettingPasswordUserId={resettingPasswordUserId}
                onboardingBusy={onboardingBusy}
              onCreateSystemUser={handleCreateSystemUser}
              onResetUserPassword={handleResetUserPassword}
              onUpdateUserProfile={handleUpdateUserProfile}
              onCreateBarbershop={handleCreateBarbershop}
              onCreateBranch={handleCreateBranch}
              isAdmin={isAdmin}
              isSuperAdmin={isSuperAdmin}
            />
            )}
        </div>
      </main>

      {modals.appointment && <AppointmentModal onClose={() => setModals({...modals, appointment: false})} onSave={handleSaveAppointment} services={services} clients={clients} barbers={barbers} initial={selectedData.appointment || { date: viewDate, time: '09:00', barberId: defaultBarberId }} appointments={appointments} />}
      {modals.client && <ClientModal onClose={() => setModals({...modals, client: false})} onSave={handleSaveClient} clients={clients} initial={selectedData.client} />}
      {modals.clientDetail && <ClientDetailModal client={selectedData.client} clients={effectiveClientDirectory.clients} appointments={effectiveClientDirectory.appointments} barbers={effectiveClientDirectory.barbers} onClose={() => setModals({...modals, clientDetail: false})} onEdit={() => { setModals({...modals, clientDetail: false, client: true}); }} onDelete={() => handleDeleteClient(selectedData.client.id)} onNewApt={() => { setModals({...modals, clientDetail: false, appointment: true}); setSelectedData({...selectedData, appointment: { date: getTodayString(), time: '09:00', barberId: defaultBarberId, client: selectedData.client } }); }} />}
      {modals.finalize && <FinalizeModal onClose={() => setModals({...modals, finalize: false})} onConfirm={(ex) => handleUpdateStatus(selectedData.finalize.id, 'Finalizada', ex)} services={services} clients={clients} initial={selectedData.finalize} />}
      {modals.service && <ServiceEditorModal services={services} onClose={() => setModals({...modals, service: false})} onSave={handleSaveService} initial={selectedData.service} />}
      {modals.paymentReceipt && <PaymentReceiptModal data={selectedData.paymentReceipt} onClose={() => setModals({...modals, paymentReceipt: false})} onConfirmPayment={handleConfirmPayment} />}
      {modals.posSaleReceipt && <PosSaleReceiptModal data={selectedData.posSaleReceipt} onClose={() => setModals({...modals, posSaleReceipt: false})} onCancelSale={handleCancelPosSale} />}
      {modals.staffSettlement && <StaffSettlementModal data={selectedData.staffSettlement} onClose={() => setModals({...modals, staffSettlement: false})} onConfirmSettlement={handleConfirmStaffSettlement} />}
      {showSelfPasswordModal && (
        <Suspense fallback={accessUiFallback}>
        <PasswordActionModal
          title={session?.user?.user_metadata?.must_change_password ? 'Actualiza tu contraseña' : 'Cambiar contraseña'}
          subtitle={session?.user?.user_metadata?.must_change_password ? 'Cambio obligatorio al primer acceso' : 'Mi cuenta'}
          submitLabel="Actualizar contraseña"
          busy={passwordBusy}
          onClose={() => {
            if (session?.user?.user_metadata?.must_change_password) return;
            setShowSelfPasswordModal(false);
          }}
          onSubmit={handleChangeOwnPassword}
          nextLabel="Nueva contraseña"
          nextPlaceholder="Mínimo 6 caracteres"
          lockOpen={Boolean(session?.user?.user_metadata?.must_change_password)}
        />
        </Suspense>
      )}
      {feedbackToast && (
        <div className="fixed top-6 right-6 z-[130] max-w-md">
          <div className={`rounded-[1.6rem] border px-5 py-4 shadow-2xl backdrop-blur-md ${
            feedbackToast.tone === 'success'
              ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200'
              : feedbackToast.tone === 'error'
                ? 'bg-rose-500/15 border-rose-400/30 text-rose-200'
                : 'bg-amber-500/15 border-amber-400/30 text-amber-100'
          }`}>
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-bold leading-relaxed">{feedbackToast.message}</p>
              <button
                type="button"
                onClick={() => setFeedbackToast(null)}
                className="text-white/50 hover:text-white transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmState && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-950 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">
              {confirmState.title}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              {confirmState.message}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  confirmState.resolve(false);
                  setConfirmState(null);
                }}
                className="flex-1 rounded-2xl border border-white/10 bg-slate-900 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-slate-800"
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmState.resolve(true);
                  setConfirmState(null);
                }}
                className={`flex-1 rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${
                  confirmState.tone === 'danger'
                    ? 'bg-rose-600 text-white hover:bg-rose-500'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </UiFeedbackContext.Provider>
  );
}

/**
 * --- COMPONENTE RECIBO DE PAGO NOMINA ---
 */
function PaymentReceiptModal({ data, onClose, onConfirmPayment }) {
  const { confirmAction } = useUiFeedback();
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
              Al firmar este documento, el barbero acepta que ha recibido la cantidad estipulada <br/>
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

function PosSaleReceiptModal({ data, onClose, onCancelSale }) {
  const { confirmAction } = useUiFeedback();
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
                  {sale.promotionName ? `Promo: ${sale.promotionName}` : 'Descuento'}
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

function StaffSettlementModal({ data, onClose, onConfirmSettlement }) {
  const { confirmAction } = useUiFeedback();
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
      onConfirmSettlement(rows.map(row => row.barber.id));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-white text-black w-full max-w-7xl rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh]">
        <div className="p-10 overflow-y-auto custom-scrollbar" id="printable-staff-settlement">
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

          <div className="overflow-hidden rounded-[2rem] border border-slate-200">
            <table className="w-full">
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

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-4 no-print">
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

function AgendaView({ viewDate, setViewDate, appointments, clients, barbers, onSlotClick, onAptClick }) {
  const today = getTodayString();
  const isToday = viewDate === today;
  const [nowPos, setNowPos] = useState(0);
  const agendaBarbers = (barbers && barbers.length > 0) ? barbers : [];
  const dayAppointments = useMemo(
    () => (appointments || [])
      .filter((appointment) => standardizeDate(appointment.date) === viewDate)
      .sort((left, right) => String(left.time || '').localeCompare(String(right.time || ''))),
    [appointments, viewDate],
  );

  useEffect(() => {
    const updateNow = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      if (h < 8 || h > 18) { setNowPos(-1); return; }
      const totalMinFromStart = (h - 8) * 60 + m;
      const totalDuration = (18 - 8) * 60;
      setNowPos((totalMinFromStart / totalDuration) * 100);
    };
    updateNow();
    const interval = setInterval(updateNow, 60000);
    return () => clearInterval(interval);
  }, []);

  const changeDay = (v) => { 
    const d = new Date(viewDate + 'T00:00:00'); 
    d.setDate(d.getDate() + v); 
    setViewDate(formatLocalDateYmd(d)); 
  };

  return (
    <div className="p-4 md:p-8 h-full flex flex-col gap-4 md:gap-6 bg-slate-950 no-print">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 bg-black border border-slate-800 p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl text-white">
        <div className="flex items-center justify-center sm:justify-start gap-3">
          <button onClick={() => changeDay(-1)} className="p-3 md:p-4 bg-slate-900 rounded-2xl text-white shadow-lg transition-all hover:bg-indigo-600"><ChevronLeft size={20}/></button>
          <button onClick={() => setViewDate(today)} className="px-5 md:px-6 py-3 md:py-4 bg-indigo-600/10 hover:bg-indigo-600 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-white transition-all rounded-xl border border-indigo-600/30">Hoy</button>
          <button onClick={() => changeDay(1)} className="p-3 md:p-4 bg-slate-900 rounded-2xl text-white shadow-lg transition-all hover:bg-indigo-600"><ChevronRight size={20}/></button>
        </div>
        <div className="text-center lg:text-right">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 italic mb-2 leading-none">Agenda de Barbería</p>
          <h3 className="text-2xl sm:text-3xl md:text-3xl font-black italic uppercase text-white tracking-tighter leading-tight">
            {new Date(viewDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
        </div>
      </div>

      <div className="md:hidden space-y-4">
        {agendaBarbers.map((barber) => {
          const barberAppointments = dayAppointments.filter((appointment) => String(appointment.barberId) === String(barber.id));
          return (
            <div key={barber.id} className="rounded-[2rem] border border-slate-800 bg-slate-900 p-5 shadow-xl">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${barber.bg} flex items-center justify-center font-black italic text-white`}>{barber.avatar}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-black uppercase italic tracking-tighter text-white truncate">{barber.name}</p>
                  <p className={`mt-2 text-[10px] font-black uppercase tracking-[0.18em] ${barberAppointments.length ? 'text-indigo-300' : 'text-emerald-300'}`}>
                    {barberAppointments.length ? `${barberAppointments.length} cita${barberAppointments.length === 1 ? '' : 's'} en agenda` : 'Disponible'}
                  </p>
                </div>
                <button onClick={() => onSlotClick(getCurrentTimeHHmm(), barber.id)} className="rounded-xl border border-indigo-500/30 bg-indigo-600/10 p-3 text-indigo-300">
                  <Plus size={18} />
                </button>
              </div>

              {barberAppointments.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {barberAppointments.map((appointment) => {
                    const client = clients.find((item) => item.id === appointment.clientId);
                    return (
                      <button key={appointment.id} onClick={() => onAptClick(appointment)} className="w-full rounded-[1.4rem] border border-white/5 bg-black/25 px-4 py-4 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black uppercase italic text-white truncate">{client?.name || 'Cliente desconocido'}</p>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{appointment.service || 'Servicio'}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black italic text-white">{appointment.time || '--:--'}</p>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-300">{appointment.status || 'Confirmada'}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <button onClick={() => onSlotClick('09:00', barber.id)} className="mt-4 w-full rounded-[1.4rem] border border-dashed border-indigo-500/30 bg-indigo-500/5 px-4 py-4 text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">
                  Agendar cita
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden md:flex flex-1 bg-black/40 border border-slate-900 rounded-[3rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.5)] flex-col">
        <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1 relative">
          <div className="min-w-[1200px] h-full flex flex-col relative">
            <div 
              className="grid bg-slate-950/95 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md"
              style={{ gridTemplateColumns: `140px repeat(${agendaBarbers.length}, 1fr)` }}
            >
              <div className="p-6 border-r border-slate-800 flex items-center justify-center bg-black"><Clock className="text-slate-600" size={24} /></div>
              {agendaBarbers.map(b => (
                <div key={b.id} className="p-6 border-r border-slate-800 last:border-0 flex items-center justify-center gap-4 min-w-[180px] text-white">
                  <div className={`w-11 h-11 rounded-xl bg-slate-950 border-2 ${b.color} flex items-center justify-center font-black italic text-xs text-white shadow-lg`}>{b.avatar}</div>
                  <div className="flex flex-col items-start leading-none truncate text-white">
                    <span className="text-[11px] font-black uppercase tracking-widest text-white italic truncate w-full">{b.name}</span>
                    <span className={`text-[8px] font-bold uppercase mt-1 tracking-widest ${b.color.replace('border', 'text')}`}>Disponible</span>
                  </div>
                </div>
              ))}
            </div>

            {isToday && nowPos >= 0 && (
              <div className="absolute left-0 w-full h-1 bg-rose-500 z-20 pointer-events-none flex items-center justify-start shadow-[0_0_20px_rgba(244,63,94,0.8)]" style={{ top: `calc(76px + ((${nowPos} / 100) * (21 * 100px)))` }}>
                <div className="px-3 py-1 bg-rose-600 text-white text-[8px] font-black uppercase rounded-full ml-[140px] -translate-y-1/2 shadow-lg text-white">Ahora</div>
              </div>
            )}

            {HOURS.map(h => (
              <div 
                key={h} 
                className="grid min-h-[100px] group/row border-b border-slate-900 hover:bg-indigo-600/[0.03] transition-colors"
                style={{ gridTemplateColumns: `140px repeat(${agendaBarbers.length}, 1fr)` }}
              >
                <div className="p-6 flex items-center justify-center font-black text-slate-500 text-sm border-r border-slate-900 bg-slate-900/10 italic group-hover/row:text-indigo-400 transition-colors">{h}</div>
                {agendaBarbers.map(b => {
                  const apt = appointments.find(a => {
                    const normalizedAptDate = standardizeDate(a.date);
                    const [aptH, aptM] = (a.time || "00:00").split(':').map(Number);
                    const [slotH, slotM] = h.split(':').map(Number);
                    const isWithinSlot = aptH === slotH && aptM >= slotM && aptM < slotM + 30;
                    return normalizedAptDate === viewDate && isWithinSlot && String(a.barberId) === String(b.id);
                  });

                  let statusStyles = "bg-indigo-600 hover:bg-indigo-500 border-indigo-400 shadow-[0_10px_20px_rgba(79,70,229,0.3)]";
                  if (apt?.status === 'En Corte') statusStyles = "bg-emerald-600 hover:bg-emerald-500 border-emerald-400 shadow-[0_10px_20px_rgba(16,185,129,0.3)]";
                  if (apt?.status === 'Finalizada' || apt?.status === 'Cita Perdida') statusStyles = "bg-slate-800 border-slate-700 opacity-60";
                  
                  return (
                    <div key={`${h}-${b.id}`} onClick={() => !apt ? onSlotClick(h, b.id) : onAptClick(apt)} className={`p-2 border-r border-slate-900 last:border-r-0 relative transition-all flex items-stretch group/cell ${!apt ? 'cursor-pointer hover:bg-indigo-500/[0.05]' : ''}`}>
                      {apt ? (
                        <div className={`w-full ${statusStyles} rounded-2xl p-4 text-[10px] font-black uppercase italic shadow-2xl flex flex-col justify-between animate-in zoom-in-95 border-l-4 transition-all hover:scale-[1.02] cursor-pointer text-white`}>
                          <div className="flex justify-between items-start text-white">
                            <span className="drop-shadow-lg truncate w-24">{clients.find(c => c.id === apt.clientId)?.name}</span>
                            {apt.status === 'Cita Perdida' ? <UserX size={12} className="text-rose-400" /> : (apt.status === 'Finalizada' ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Clock size={12} className="text-white" />)}
                          </div>
                          <div className="flex items-center justify-between mt-2 text-white">
                            <span className="text-white text-[8px] font-black truncate flex items-center gap-1">
                              {apt.service?.toLowerCase().includes('barba') ? <BeardIcon size={10}/> : <Scissors size={10}/>}
                          {apt.status === 'Cita Perdida' ? 'NO LLEGÓ' : (apt.service || 'Servicio')}
                            </span>
                            <span className="text-[7px] opacity-70 font-black">{apt.time}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full opacity-0 group-hover/cell:opacity-100 flex items-center justify-center transition-all duration-200">
                          <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.18)]">
                            <Plus size={18} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ServicesView({ services, onAdd, onEdit, onDelete }) {
  const [activeCategory, setActiveCategory] = useState('Cortes');
  const getIcon = (cat) => {
    switch(cat) {
      case 'Cortes': return <Scissors size={32} />;
      case 'Barba': return <BeardIcon size={32} />;
      case 'Combo': return <Zap size={32} />;
      case 'Producto': return <Package size={32} />;
      case 'Promocion': return <Gift size={32} />;
      default: return <Tags size={32} />;
    }
  };
  const filteredServices = useMemo(() => (services || []).filter(s => s.category === activeCategory), [services, activeCategory]);

  return (
    <div className="p-4 md:p-10 space-y-6 md:space-y-12 h-full animate-in fade-in text-white no-print">
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 text-white">
        <div>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-black italic uppercase tracking-tighter leading-none text-white">Menú de Servicios</h3>
          <p className="text-[10px] text-indigo-400 font-black uppercase mt-2 italic tracking-[0.2em] leading-none">Gestión Maestra de Catálogo</p>
        </div>
        <button onClick={() => onAdd(activeCategory)} className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-8 md:px-10 py-4 md:py-5 rounded-[2rem] font-black text-[10px] md:text-xs uppercase italic shadow-2xl shadow-indigo-600/40 flex items-center justify-center gap-3 transition-all active:scale-95 group text-white"><Plus size={20} className="group-hover:rotate-90 transition-transform" /> {activeCategory === 'Promocion' ? 'Nueva Promoción' : 'Nuevo Servicio'}</button>
      </div>
      <div className="grid w-full grid-cols-2 gap-3 p-3 bg-black border border-slate-800 rounded-[2.5rem] text-white sm:flex sm:flex-wrap sm:items-center sm:w-fit">
        {CATEGORIES.map(cat => <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 md:px-8 py-4 rounded-[2rem] font-black uppercase italic text-[10px] tracking-widest transition-all ${activeCategory === cat ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/40 translate-y-[-2px]' : 'text-slate-500 hover:text-white hover:bg-slate-900'}`}>{CATEGORY_LABELS[cat] || cat}</button>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-8">
        {filteredServices.map(s => (
          <div key={s.id} onClick={() => onEdit(s)} className="group bg-slate-900 border border-slate-800 rounded-[2.2rem] md:rounded-[3rem] p-6 md:p-10 hover:border-indigo-500 transition-all cursor-pointer relative shadow-2xl overflow-hidden flex flex-col justify-between min-h-[260px] md:min-h-[320px] text-white">
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl group-hover:bg-indigo-600/30 transition-all"></div>
            <button onClick={(e) => { e.stopPropagation(); onDelete(s.id); }} className="absolute top-5 md:top-8 right-5 md:right-8 text-slate-600 hover:text-rose-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all z-10 text-white"><Trash2 size={18}/></button>
            <div className="relative text-white">
              <div className="w-14 h-14 md:w-16 md:h-16 bg-black rounded-2xl flex items-center justify-center text-indigo-500 mb-6 md:mb-8 border border-slate-800 shadow-inner group-hover:scale-110 transition-transform group-hover:text-white group-hover:bg-indigo-600 text-white">{getIcon(s.category)}</div>
              <h4 className="text-xl md:text-2xl font-black uppercase italic leading-tight tracking-tighter group-hover:text-indigo-400 transition-colors text-white">{s.name}</h4>
              <span className="inline-block mt-4 text-[9px] font-black bg-indigo-600/20 text-indigo-400 px-5 py-2 rounded-full uppercase border border-indigo-600/40 tracking-widest italic leading-none">{CATEGORY_LABELS[s.category] || s.category}</span>
              {s.category === 'Promocion' && (
                <div className="mt-5 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                      {s.appliesTo === 'Producto' ? 'Aplica a ventas' : 'Aplica a servicios'}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-amber-300">
                      {formatPromotionValue(s)}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    Aplicación manual al momento de cobrar
                  </p>
                </div>
              )}
            </div>
            <div className="pt-6 md:pt-8 border-t border-slate-800 group-hover:border-indigo-500/30 mt-6 md:mt-8 flex justify-between items-center text-white">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase italic mb-1 leading-none">{s.category === 'Promocion' ? 'Descuento' : 'Precio Final'}</p>
                <p className="text-3xl md:text-4xl font-black italic text-emerald-400 tracking-tighter group-hover:text-white transition-all leading-none">{s.category === 'Promocion' ? formatPromotionValue(s) : `C$ ${s.price}`}</p>
              </div>
              <div className="p-3 bg-black border border-slate-800 rounded-2xl text-slate-600 group-hover:text-indigo-500 transition-colors"><ChevronRight size={20} /></div>
            </div>
          </div>
        ))}
        <div onClick={() => onAdd(activeCategory)} className="border-4 border-dashed border-slate-900 rounded-[2.2rem] md:rounded-[3rem] p-6 md:p-10 flex flex-col items-center justify-center text-slate-800 hover:border-indigo-600 hover:text-indigo-400 transition-all cursor-pointer group min-h-[260px] md:min-h-[320px] text-white"><div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-current flex items-center justify-center mb-4 group-hover:scale-110 transition-transform text-white"><Plus size={28} /></div><p className="font-black uppercase italic text-[10px] md:text-xs tracking-widest leading-none text-white text-center">{activeCategory === 'Promocion' ? 'Añadir promoción' : `Añadir a ${CATEGORY_LABELS[activeCategory] || activeCategory}`}</p></div>
      </div>
    </div>
  );
}

function BarbersView({ barbers, appointments, branches, currentBarbershopId, currentBranchId, canChooseBranch, onSave, onDelete, onGoToNomina }) {
  const { notify } = useUiFeedback();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', fullName: '', cedula: '', salary: '', phone: '', paymentMode: 'salario', paymentFrequency: 'Quincenal', commission: '', level: 'Junior', color: BARBER_THEME_PALETTE[0].color, bg: BARBER_THEME_PALETTE[0].bg, branchId: currentBranchId || '' });
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [compensationIndicator, setCompensationIndicator] = useState('salary');
  const branchNameById = useMemo(
    () => new Map((branches || []).map((branch) => [String(branch.id), branch.name])),
    [branches],
  );
  const branchesForCurrentBarbershop = useMemo(
    () => {
      const allBranches = branches || [];
      if (!currentBarbershopId) return allBranches;
      const scopedBranches = allBranches.filter((branch) => String(branch.barbershopId || '') === String(currentBarbershopId || ''));
      return scopedBranches.length ? scopedBranches : allBranches;
    },
    [branches, currentBarbershopId],
  );
  const defaultBranchId = useMemo(() => {
    if (!branchesForCurrentBarbershop.length) return '';
    const currentBranchStillExists = branchesForCurrentBarbershop.some(
      (branch) => String(branch.id) === String(currentBranchId || ''),
    );
    if (currentBranchStillExists) return String(currentBranchId || '');
    return String(branchesForCurrentBarbershop[0].id || '');
  }, [branchesForCurrentBarbershop, currentBranchId]);
  const pendingEarningsByBarber = useMemo(() => {
    const totalsByBarber = new Map();

    (appointments || []).forEach((appointment) => {
      if (appointment.status !== 'Finalizada' || appointment.isPaid) return;
      const barberId = String(appointment.barberId || '');
      if (!barberId) return;
      totalsByBarber.set(barberId, (totalsByBarber.get(barberId) || 0) + (Number(appointment.price) || 0));
    });

    return totalsByBarber;
  }, [appointments]);

  const getBarberEarnings = (barber) => {
    if (barber.paymentMode !== 'porcentaje') return 0;
    const totalSales = pendingEarningsByBarber.get(String(barber.id)) || 0;
    return totalSales * (Number(barber.commission) / 100);
  };

  const formatSalary = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const onlyDigits = `${value}`.replace(/\D+/g, '');
    if (!onlyDigits) return '';
    return Number(onlyDigits).toLocaleString('es-ES');
  };

  const formatCommission = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const onlyDigits = `${value}`.replace(/\D+/g, '');
    return onlyDigits;
  };

  const parseSalary = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const onlyDigits = `${value}`.replace(/\D+/g, '');
    return Number(onlyDigits) || 0;
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', fullName: '', cedula: '', salary: '', phone: '', paymentMode: 'salario', paymentFrequency: 'Quincenal', commission: '', level: 'Junior', color: BARBER_THEME_PALETTE[0].color, bg: BARBER_THEME_PALETTE[0].bg, branchId: defaultBranchId });
    setIsModalOpen(true);
  };

  const openEdit = (barber) => {
    setEditing(barber.id);
    setForm({
      name: barber.name || '',
      fullName: barber.fullName || barber.name || '',
      cedula: barber.cedula || '',
      salary: formatSalary(barber.paymentMode === 'salario' ? barber.salary : ''),
      phone: barber.phone || '',
      paymentMode: barber.paymentMode || 'salario',
      paymentFrequency: barber.paymentFrequency || 'Quincenal',
      commission: barber.paymentMode === 'porcentaje' ? String(barber.commission || '') : '',
      level: barber.level || 'Junior',
      color: barber.color || BARBER_THEME_PALETTE[0].color,
      bg: barber.bg || BARBER_THEME_PALETTE[0].bg,
      branchId: barber.branchId || defaultBranchId,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      notify('Nombre comercial requerido', 'warning');
      return;
    }
    if (!form.fullName.trim()) {
      notify('Nombre completo requerido', 'warning');
      return;
    }
    if (!branchesForCurrentBarbershop.length) {
      notify('Primero debes crear al menos una sucursal para registrar barberos.', 'warning');
      return;
    }
    if (!String(form.branchId || '').trim()) {
      notify('Debes seleccionar una sucursal para el barbero.', 'warning');
      return;
    }
    if (getPhoneDigits(form.phone).length > 0 && !isValidPhoneNumber(form.phone)) {
      notify('El teléfono móvil debe tener exactamente 8 dígitos.', 'warning');
      return;
    }
    const savedBarber = {
      id: editing,
      ...form,
      fullName: form.fullName.trim(),
      cedula: form.cedula.trim(),
      phone: formatPhoneNumber(form.phone),
      paymentMode: form.paymentMode,
      paymentFrequency: form.paymentFrequency,
      salary: form.paymentMode === 'salario' ? parseSalary(form.salary) : 0,
      commission: form.paymentMode === 'porcentaje' ? parseSalary(form.commission) : 0,
      level: form.level || 'Junior',
      branchId: form.branchId,
      barbershopId: currentBarbershopId || null,
    };
    await onSave(savedBarber);
    closeModal();
  };

  const filteredBarbers = barbers.filter((b) => {
    const query = search.toLowerCase();
    return b.name.toLowerCase().includes(query) || (b.fullName || '').toLowerCase().includes(query) || (b.cedula || '').toLowerCase().includes(query) || (b.phone || '').includes(query);
  });

  const staffMetrics = useMemo(() => {
    const roster = barbers || [];
    const salariedBarbers = roster.filter(
      (barber) => barber.paymentMode === 'salario' && Number(barber.salary || 0) > 0
    );
    const avgSalary = salariedBarbers.length
      ? salariedBarbers.reduce((sum, barber) => sum + (Number(barber.salary) || 0), 0) / salariedBarbers.length
      : 0;
    const commissionBarbers = roster.filter((barber) => barber.paymentMode === 'porcentaje');
    const avgCommission = commissionBarbers.length
      ? commissionBarbers.reduce((sum, barber) => {
          const totalSales = pendingEarningsByBarber.get(String(barber.id)) || 0;
          return sum + (totalSales * (Number(barber.commission) / 100));
        }, 0) / commissionBarbers.length
      : 0;

    const today = parseLocalDate(getTodayString()) || new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const monthlyFinishedAppointments = (appointments || []).filter((appointment) => {
      if (appointment.status !== 'Finalizada') return false;
      const appointmentDate = parseLocalDate(appointment.date);
      if (!appointmentDate) return false;
      return appointmentDate.getFullYear() === currentYear && appointmentDate.getMonth() === currentMonth;
    });

    const servicesByBarber = monthlyFinishedAppointments.reduce((map, appointment) => {
      const barberId = String(appointment.barberId || '');
      if (!barberId) return map;
      map.set(barberId, (map.get(barberId) || 0) + 1);
      return map;
    }, new Map());

    const activeBarbers = roster.filter(
      (barber) => (servicesByBarber.get(String(barber.id)) || 0) > 0
    ).length;
    const coverage = roster.length ? activeBarbers / roster.length : 0;

    let performanceLabel = 'Sin datos';
    let performanceTone = 'text-slate-300';

    if (monthlyFinishedAppointments.length > 0) {
      if (coverage >= 0.8) {
        performanceLabel = 'Alta';
        performanceTone = 'text-emerald-300';
      } else if (coverage >= 0.5) {
        performanceLabel = 'Media';
        performanceTone = 'text-amber-300';
      } else {
        performanceLabel = 'Baja';
        performanceTone = 'text-rose-300';
      }
    }

    return {
      total: roster.length,
      avgSalary,
      avgCommission,
      salariedCount: salariedBarbers.length,
      commissionCount: commissionBarbers.length,
      performanceLabel,
      performanceTone,
      avgSalaryCaption: salariedBarbers.length
        ? `Solo ${salariedBarbers.length} con salario fijo`
        : 'No hay staff con salario fijo',
      avgCommissionCaption: commissionBarbers.length
        ? `Promedio pendiente para ${commissionBarbers.length} por comisión`
        : 'No hay staff por comisión',
      performanceCaption: monthlyFinishedAppointments.length
        ? `${activeBarbers} de ${roster.length || 0} barberos con servicios finalizados este mes`
        : 'Sin servicios finalizados este mes',
    };
  }, [barbers, appointments, pendingEarningsByBarber]);

  const compensationMetric = compensationIndicator === 'commission'
    ? {
        label: 'Promedio Comisiones',
        value: staffMetrics.commissionCount ? `C$ ${Math.round(staffMetrics.avgCommission).toLocaleString()}` : 'N/A',
        caption: staffMetrics.avgCommissionCaption,
        tone: 'text-cyan-300',
      }
    : {
        label: 'Promedio Salario Fijo',
        value: staffMetrics.salariedCount ? `C$ ${Math.round(staffMetrics.avgSalary).toLocaleString()}` : 'N/A',
        caption: staffMetrics.avgSalaryCaption,
        tone: 'text-emerald-300',
      };

  return (
    <div className="p-10 space-y-8 animate-in fade-in text-white no-print">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 text-white">
        <div>
          <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-white">Equipo de Barberos</h3>
          <p className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mt-1 italic leading-none">Administre el staff, salarios y liquidación de comisiones</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={onGoToNomina}
            className="bg-[#6366f1] hover:bg-[#5356e3] text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(99,102,241,0.3)] active:scale-95 transition-all flex items-center gap-2"
          >
            <Wallet size={16} /> Pagar Nómina
          </button>
          <button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(79,70,229,0.3)] active:scale-95 transition-all">Nuevo Barbero</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
        <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-lg hover:shadow-indigo-500/40 transition-all text-white">
          <p className="text-[9px] uppercase tracking-widest font-black text-slate-400">Total de Barberos</p>
          <p className="text-4xl font-black text-indigo-200">{staffMetrics.total}</p>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-lg hover:shadow-emerald-500/40 transition-all text-white">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[9px] uppercase tracking-widest font-black text-slate-400">{compensationMetric.label}</p>
            <div className="inline-flex rounded-2xl border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => setCompensationIndicator('salary')}
                className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${compensationIndicator === 'salary' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                Salario
              </button>
              <button
                type="button"
                onClick={() => setCompensationIndicator('commission')}
                className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${compensationIndicator === 'commission' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
              >
                Comisión
              </button>
            </div>
          </div>
          <p className={`text-4xl font-black ${compensationMetric.tone}`}>
            {compensationMetric.value}
          </p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {compensationMetric.caption}
          </p>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-lg hover:shadow-amber-500/40 transition-all text-white">
          <p className="text-[9px] uppercase tracking-widest font-black text-slate-400">Rendimiento Staff</p>
          <p className={`text-4xl font-black ${staffMetrics.performanceTone}`}>{staffMetrics.performanceLabel}</p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {staffMetrics.performanceCaption}
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 text-white">
        <div className="flex justify-between items-center mb-5 text-white">
          <h4 className="text-lg font-black uppercase text-white">Registro de Barberos</h4>
          <div className="relative text-white w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, cédula o teléfono" className="pl-10 pr-4 py-3 w-full rounded-xl bg-black border border-slate-800 text-sm text-white outline-none focus:border-indigo-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 text-white">
          {filteredBarbers.length === 0 && <p className="text-slate-400 col-span-full">No se encontraron barberos.</p>}
          {filteredBarbers.map((b) => {
             const earnings = getBarberEarnings(b);
             return (
              <div key={b.id} onClick={() => openEdit(b)} className={`bg-gradient-to-br from-slate-900 to-slate-800 border ${b.color || 'border-slate-700'} rounded-[2.5rem] p-6 shadow-lg hover:shadow-indigo-500/30 transition-all relative overflow-hidden group cursor-pointer flex flex-col justify-between h-full text-white`}>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-700/10 via-transparent to-emerald-700/5 opacity-60 pointer-events-none z-0"></div>
                
                <div className="relative z-10 text-white">
                  <div className="flex items-center justify-between gap-2 mb-4 text-white">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black italic shadow-xl ${b.bg || 'bg-indigo-500'}`}>{b.avatar || b.name?.slice(0, 2).toUpperCase()}</div>
                  </div>
                  
                  <h5 className="text-xl font-black text-white uppercase tracking-tighter truncate mb-1">{b.name}</h5>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.16em] truncate mb-3">{b.fullName || b.name}</p>
                  <div className="flex items-center gap-2 mb-4 text-white">
                      <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-md border ${b.color} text-white`}>{b.level || 'Junior'}</span>
                      <span className="text-[8px] font-black uppercase px-2 py-1 rounded-md bg-black/40 text-slate-400 border border-white/5">{b.paymentMode === 'salario' ? 'Salario Fijo' : 'Comisión %'}</span>
                  </div>

                  <div className="space-y-3 py-4 border-y border-white/5 mb-4 text-white">
                    <div className="flex justify-between items-center text-white">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sucursal</span>
                        <span className="text-[10px] font-black text-slate-300 italic">{branchNameById.get(String(b.branchId || '')) || 'Sucursal no asignada'}</span>
                    </div>
                    <div className="flex justify-between items-center text-white">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cédula</span>
                        <span className="text-[10px] font-black text-slate-300 italic">{b.cedula?.trim() || 'Sin registrar'}</span>
                    </div>
                    <div className="flex justify-between items-center text-white">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Pago Base</span>
                        <span className="text-xs font-black text-white italic">{b.paymentMode === 'salario' ? `C$ ${Number(b.salary || 0).toLocaleString()}` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center text-white">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Pendiente Pago</span>
                        <span className="text-xs font-black text-emerald-400 italic">C$ {earnings.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 relative z-10 pt-2 text-white">
                  <button onClick={() => openEdit(b)} className="flex-1 bg-white/5 hover:bg-indigo-600 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/5 hover:border-indigo-400 transition-all text-white">Ver Perfil</button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(b.id); }} className="px-4 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white py-3 rounded-xl border border-rose-500/20 transition-all"><Trash2 size={14}/></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300 text-white">
          <div className="w-full max-w-5xl bg-slate-950 border border-white/10 rounded-[3rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 flex flex-col md:flex-row relative text-white transform scale-110 origin-center">
            
            <button onClick={closeModal} className="absolute top-6 right-6 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 text-white/40 hover:text-rose-400 transition-all z-20 text-white">
              <X size={20} />
            </button>

            <div className={`w-full md:w-1/3 p-10 flex flex-col items-center justify-start border-b md:border-b-0 md:border-r border-white/5 bg-gradient-to-b from-white/5 to-transparent relative overflow-y-auto custom-scrollbar text-white`}>
              <div className={`absolute top-0 left-0 w-full h-1 ${form.bg || 'bg-indigo-500'}`}></div>
              <div className="relative group mb-8 text-white mt-4">
                <div className={`absolute inset-0 ${form.bg || 'bg-indigo-500'} blur-2xl opacity-30 group-hover:opacity-50 transition-opacity`}></div>
                <div className={`w-32 h-32 rounded-[2.5rem] ${form.bg || 'bg-indigo-500'} flex items-center justify-center text-white font-black text-4xl shadow-2xl relative z-10 border-4 border-white/10 animate-glow text-white`}>
                  {(form.name || 'NB').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </div>
              </div>
              
              <h4 className="text-2xl font-black text-white uppercase tracking-tighter text-center mb-1 leading-none">{form.name || 'Sin Nombre'}</h4>
              <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-[0.18em] text-center mb-2">{form.fullName || 'Nombre legal pendiente'}</p>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.18em] mb-6 italic">Cédula: {form.cedula || 'Sin registrar'}</p>
              <div className="mb-6 px-4 py-3 w-full rounded-2xl border border-white/5 bg-white/5 text-white">
                <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] italic leading-none">Sucursal actual</p>
                <p className="mt-3 text-sm font-black text-white italic">{branchNameById.get(String(form.branchId || '')) || 'Sucursal obligatoria'}</p>
              </div>
              
              <div className="w-full space-y-4 text-white">
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center justify-between text-white">
                  <div className="flex items-center gap-3 text-white/40"><Briefcase size={14}/> <span className="text-[10px] font-black uppercase tracking-widest italic leading-none">Modo</span></div>
                  <span className="text-[11px] font-black uppercase text-indigo-400 italic leading-none">{form.paymentMode === 'salario' ? 'Salario Fijo' : 'Comisión'}</span>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-white">
                  <div className="flex items-center gap-3 text-white/40 mb-3"><Repeat size={14}/> <span className="text-[10px] font-black uppercase tracking-widest italic leading-none">Frecuencia de Pago</span></div>
                  <div className="grid grid-cols-2 gap-2 text-white">
                    {['Diario', 'Semanal', 'Quincenal', 'Mensual'].map(freq => (
                      <button key={freq} onClick={() => setForm({...form, paymentFrequency: freq})} className={`py-2 rounded-xl text-[8px] font-black uppercase transition-all ${form.paymentFrequency === freq ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'bg-black/40 text-white/40 hover:text-white/60'}`}>
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 text-white">
                  <div className="flex items-center gap-3 text-white/40 mb-3"><Award size={14}/> <span className="text-[10px] font-black uppercase tracking-widest italic leading-none">Nivel de Rango</span></div>
                  <div className="grid grid-cols-3 gap-2 text-white">
                    {['Junior', 'Medium', 'Senior'].map(lvl => (
                      <button key={lvl} onClick={() => setForm({...form, level: lvl})} className={`py-2 rounded-xl text-[8px] font-black uppercase transition-all ${form.level === lvl ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'bg-black/40 text-white/40 hover:text-white/60'}`}>
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 p-10 flex flex-col text-white">
              <div className="flex items-center gap-4 mb-10 text-white">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400"><IdCard size={20}/></div>
                <div>
                  <h3 className="text-xl font-black uppercase italic text-white tracking-tighter leading-none">{editing ? 'Editar Perfil' : 'Alta de Personal'}</h3>
                  <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-1 leading-none">Información de nómina y contacto</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 text-white">
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Nombre Comercial</label>
                  <div className="relative group text-white">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={16}/>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Juan Pérez" className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Nombre Completo</label>
                  <div className="relative group text-white">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={16}/>
                    <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Ej. Juan Carlos Pérez López" className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Teléfono móvil</label>
                  <div className="relative group text-white">
                    <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={16}/>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhoneNumber(e.target.value) })} placeholder="Ej. 8899-4455" className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Cédula</label>
                  <div className="relative group text-white">
                    <IdCard className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={16}/>
                    <input value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="Ej. 001-000000-0000A" className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Modalidad de Pago</label>
                  <div className="relative group text-white">
                    <CreditCard className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-emerald-400 transition-colors" size={16}/>
                    <select value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value, salary: '', commission: '' })} className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-white outline-none focus:border-emerald-500 focus:bg-white/[0.07] transition-all appearance-none cursor-pointer text-white">
                      <option value="salario" className="bg-slate-950 text-white">Pago por Salario</option>
                      <option value="porcentaje" className="bg-slate-950 text-white">Porcentaje por Corte</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2 text-white">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">{form.paymentMode === 'salario' ? 'Sueldo Mensual (C$)' : 'Porcentaje (%)'}</label>
                  <div className="relative group text-white">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-sm leading-none">{form.paymentMode === 'salario' ? 'C$' : '%'}</div>
                    <input value={form.paymentMode === 'salario' ? form.salary : form.commission} onChange={(e) => setForm({ ...form, [form.paymentMode === 'salario' ? 'salary' : 'commission']: form.paymentMode === 'salario' ? formatSalary(e.target.value) : formatCommission(e.target.value) })} placeholder={form.paymentMode === 'salario' ? "0,000" : "15"} className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm font-black text-emerald-400 outline-none focus:border-emerald-500 focus:bg-white/[0.07] transition-all" />
                  </div>
                </div>
                {canChooseBranch && (
                  <div className="space-y-2 text-white md:col-span-2">
                    <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] ml-2 italic leading-none">Sucursal de trabajo</label>
                    <div className="relative group text-white">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors" size={16} />
                      <select
                        value={form.branchId || ''}
                        onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                        disabled={!branchesForCurrentBarbershop.length}
                        className="w-full bg-black border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 focus:bg-white/[0.07] transition-all disabled:opacity-60 appearance-none cursor-pointer"
                      >
                        <option value="" disabled className="bg-slate-950 text-white">
                          {branchesForCurrentBarbershop.length ? 'Selecciona una sucursal' : 'Sin sucursales disponibles'}
                        </option>
                        {branchesForCurrentBarbershop.map((branch) => (
                          <option key={branch.id} value={branch.id} className="bg-slate-950 text-white">
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-10 text-white">
                <label className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em] ml-2 block mb-4 italic leading-none">Color de Identificaci?n Visual</label>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3 text-white">
                  {BARBER_THEME_PALETTE.map((theme) => {
                    const isUsed = barbers.some(b => b.color === theme.color && String(b.id) !== String(editing));
                    return (
                      <button key={theme.id} disabled={isUsed} onClick={() => setForm({ ...form, color: theme.color, bg: theme.bg })} className={`h-10 rounded-xl transition-all relative overflow-hidden flex items-center justify-center border-2 ${theme.bg} ${isUsed ? 'opacity-20 cursor-not-allowed grayscale' : 'hover:scale-110 active:scale-95'} ${form.color === theme.color ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.4)]' : 'border-black/50'}`}>
                        {form.color === theme.color && <Check size={14} className="text-white drop-shadow-md" />}
                        {isUsed && <X size={10} className="text-black/50" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-4 mt-auto pt-6 border-t border-white/5 text-white">
                <button onClick={() => void submit()} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest italic shadow-xl shadow-emerald-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                  <CheckCircle2 size={16}/> {editing ? 'Actualizar Perfil' : 'Dar de Alta'}
                </button>
                <button onClick={closeModal} className="px-8 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest italic transition-all flex items-center justify-center gap-3 border border-white/5">
                  <X size={16}/> Cancelar
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

function NominaView({ barbers, appointments, onClose, onPagar, onLiquidarTodo }) {
  const payrollRows = useMemo(() => {
    return barbers.map((barber) => ({
      barber,
      nomina: getBarberNominaData(barber, appointments),
    }));
  }, [barbers, appointments]);

  const summary = useMemo(() => {
    return payrollRows.reduce((acc, row) => ({
      staffCount: acc.staffCount + 1,
      pendingServices: acc.pendingServices + row.nomina.pendingServices,
      base: acc.base + row.nomina.base,
      comission: acc.comission + row.nomina.comission,
      total: acc.total + row.nomina.total,
    }), { staffCount: 0, pendingServices: 0, base: 0, comission: 0, total: 0 });
  }, [payrollRows]);

  const indicatorCards = [
    {
      id: 'total',
      label: 'Total a Pagar',
      value: `C$ ${summary.total.toLocaleString()}`,
      helper: `Base C$ ${summary.base.toLocaleString()} + comisión C$ ${summary.comission.toLocaleString()}`,
      icon: Wallet,
      shellClass: 'bg-gradient-to-br from-indigo-500/20 via-slate-900 to-slate-950 border-indigo-500/30 shadow-[0_0_35px_rgba(99,102,241,0.18)]',
      iconWrapClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-400/20',
      valueClass: 'text-white',
      badgeClass: 'text-indigo-300',
    },
    {
      id: 'staff',
      label: 'Staff Pendiente',
      value: `${summary.staffCount}`,
      helper: `${summary.staffCount === 1 ? '1 barbero con pago pendiente' : `${summary.staffCount} barberos listos para liquidar`}`,
      icon: Users,
      shellClass: 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-700 shadow-[0_12px_35px_rgba(0,0,0,0.25)]',
      iconWrapClass: 'bg-white/5 text-slate-200 border-white/10',
      valueClass: 'text-white',
      badgeClass: 'text-slate-300',
    },
    {
      id: 'services',
      label: 'Servicios Pendientes',
      value: `${summary.pendingServices}`,
      helper: summary.pendingServices > 0 ? 'Citas finalizadas aún no liquidadas' : 'Todo el corte pendiente ya está bajo control',
      icon: Scissors,
      shellClass: 'bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-950 border-emerald-500/20 shadow-[0_0_35px_rgba(16,185,129,0.14)]',
      iconWrapClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
      valueClass: summary.pendingServices > 0 ? 'text-emerald-300' : 'text-white',
      badgeClass: summary.pendingServices > 0 ? 'text-emerald-300' : 'text-slate-300',
    },
  ];

  return (
    <div className="p-10 space-y-8 animate-in fade-in text-white no-print">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-4 bg-slate-900 rounded-2xl text-white hover:bg-indigo-600 transition-all border border-slate-800"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
          <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none text-white">Liquidación de Nómina</h3>
            <p className="text-[#4ade80] text-[10px] font-black uppercase tracking-widest mt-1 italic leading-none">Procesar pagos pendientes del staff</p>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
          <CalendarIcon size={20} className="text-[#6366f1]" />
          <div className="text-right">
            <p className="text-[9px] text-slate-500 font-black uppercase leading-none mb-1">Periodo Actual</p>
            <p className="text-xs font-black text-white italic">{new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {indicatorCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.id} className={`relative overflow-hidden rounded-[2.6rem] border p-7 md:p-8 ${card.shellClass}`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_35%)] pointer-events-none" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className={`text-[10px] font-black uppercase italic tracking-[0.24em] leading-none ${card.badgeClass}`}>{card.label}</p>
                  <h4 className={`mt-5 text-4xl md:text-5xl font-black italic tracking-tighter leading-none ${card.valueClass}`}>{card.value}</h4>
                  <p className="mt-4 max-w-[26ch] text-[11px] font-bold text-slate-500 leading-relaxed">{card.helper}</p>
                </div>
                <div className={`shrink-0 w-14 h-14 rounded-[1.4rem] border flex items-center justify-center shadow-xl ${card.iconWrapClass}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-black/80 border-b border-slate-800 font-black uppercase text-[10px] text-slate-500 tracking-[0.2em] italic">
            <tr>
              <th className="px-10 py-7">Staff / Barbero</th>
              <th className="px-10 py-7 text-center">Modalidad</th>
              <th className="px-10 py-7 text-center">Base</th>
              <th className="px-10 py-7 text-center">Comisiones</th>
              <th className="px-10 py-7 text-right">Total a Pagar</th>
              <th className="px-10 py-7 text-right">Acci?n</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
              {payrollRows.map(({ barber: b, nomina: data }) => {
              return (
                <tr key={b.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${b.bg} rounded-xl flex items-center justify-center font-black italic text-white shadow-lg`}>{b.avatar}</div>
                      <div>
                        <p className="text-base font-black uppercase italic text-white tracking-tighter leading-none">{b.fullName || b.name}</p>
                        <p className="text-[10px] text-slate-500 mt-1 font-bold italic leading-none">{b.cedula?.trim() || `ID STAFF ${b.id}`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">{b.paymentMode === 'salario' ? 'Salario Fijo' : 'Comisión %'}</span>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className="text-xs font-black text-white italic">C$ {data.base.toLocaleString()}</span>
                  </td>
                  <td className="px-10 py-6 text-center">
                    <span className="text-xs font-black text-emerald-400 italic">C$ {data.comission.toLocaleString()}</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <span className="text-lg font-black text-white italic tracking-tighter">C$ {data.total.toLocaleString()}</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button 
                      onClick={() => onPagar(b, data)}
                      className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase italic transition-all border border-emerald-500/20 shadow-lg"
                    >
                      Pagar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-8">
        <button
          onClick={() => onLiquidarTodo(payrollRows, summary)}
          className="bg-[#4ade80] hover:bg-[#34d399] text-[#064e3b] px-12 py-6 rounded-[2.5rem] flex items-center gap-3 text-xs font-black uppercase italic tracking-widest transition-all shadow-[0_0_30px_rgba(74,222,128,0.3)] active:scale-95"
        >
          Liquidar Todo el Staff <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

const getPresetDateRange = (preset, baseDate = new Date()) => {
  const anchor = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  if (preset === 'week') {
    const dayIndex = anchor.getDay();
    const diffToMonday = dayIndex === 0 ? -6 : 1 - dayIndex;
    const start = new Date(anchor);
    start.setDate(anchor.getDate() + diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatLocalDateYmd(start), end: formatLocalDateYmd(end) };
  }

  if (preset === 'year') {
    const start = new Date(anchor.getFullYear(), 0, 1);
    const end = new Date(anchor.getFullYear(), 11, 31);
    return { start: formatLocalDateYmd(start), end: formatLocalDateYmd(end) };
  }

  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: formatLocalDateYmd(start), end: formatLocalDateYmd(end) };
};

const formatRangeLabel = (start, end) => {
  const parsedStart = parseLocalDate(start);
  const parsedEnd = parseLocalDate(end);
  if (!parsedStart || !parsedEnd) return 'Rango sin definir';

  const startLabel = parsedStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const endLabel = parsedEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${startLabel} • ${endLabel}`;
};

function ReportsView({ appointments, clients, barbers, branches = [], currentBranchId = null, posSales = [] }) {
  const [reportTab, setReportTab] = useState('ventas'); 
  const [salesPeriod, setSalesPeriod] = useState('week'); 
  const [productRangePreset, setProductRangePreset] = useState('month');
  const [showProductRangeControls, setShowProductRangeControls] = useState(false);
  const [staffRangePreset, setStaffRangePreset] = useState('month');
  const [showStaffRangeControls, setShowStaffRangeControls] = useState(false);
  const [selectedReportBranchId, setSelectedReportBranchId] = useState(currentBranchId || 'all');
  const [reportToday, setReportToday] = useState(() => getTodayString());
  const [productRangeStart, setProductRangeStart] = useState(() => getPresetDateRange('month').start);
  const [productRangeEnd, setProductRangeEnd] = useState(() => getPresetDateRange('month').end);
  const [staffRangeStart, setStaffRangeStart] = useState(() => getPresetDateRange('month').start);
  const [staffRangeEnd, setStaffRangeEnd] = useState(() => getPresetDateRange('month').end);
  const barbersById = useMemo(() => Object.fromEntries((barbers || []).map(b => [String(b.id), b])), [barbers]);
  const reportTodayDate = useMemo(() => parseLocalDate(reportToday) || new Date(), [reportToday]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const timeoutMs = Math.max(60_000, nextMidnight.getTime() - now.getTime());

    const timerId = globalThis.setTimeout(() => {
      setReportToday(getTodayString());
    }, timeoutMs);

    return () => globalThis.clearTimeout(timerId);
  }, [reportToday]);

  const effectiveReportBranchId = selectedReportBranchId === 'all' ? 'all' : (
    (branches || []).some((branch) => String(branch.id) === String(selectedReportBranchId))
      ? selectedReportBranchId
      : 'all'
  );
  const scopedAppointments = useMemo(
    () => (appointments || []).filter((appointment) => {
      if (effectiveReportBranchId === 'all') return true;
      const resolvedBranchId = appointment.branchId || barbersById[String(appointment.barberId)]?.branchId || null;
      return String(resolvedBranchId || '') === String(effectiveReportBranchId);
    }),
    [appointments, effectiveReportBranchId, barbersById],
  );
  const scopedPosSales = useMemo(
    () => (posSales || []).filter((sale) => (
      effectiveReportBranchId === 'all'
        ? true
        : String(sale.branchId || '') === String(effectiveReportBranchId)
    )),
    [posSales, effectiveReportBranchId],
  );
  const unresolvedLegacyPosSalesCount = useMemo(
    () => (posSales || []).filter((sale) => !sale.barbershopId || !sale.branchId).length,
    [posSales],
  );
  const globalFinished = useMemo(
    () => (appointments || []).filter((appointment) => appointment.status === 'Finalizada'),
    [appointments],
  );
  const finished = useMemo(() => scopedAppointments.filter(a => a.status === 'Finalizada'), [scopedAppointments]);
  const finishedRevenueTotal = useMemo(
    () => finished.reduce((acc, appointment) => acc + (parseInt(appointment.price) || 0), 0),
    [finished],
  );
  const effectiveSalesRange = useMemo(
    () => getPresetDateRange(salesPeriod, reportTodayDate),
    [reportTodayDate, salesPeriod],
  );
  const salesRangeLabel = useMemo(
    () => formatRangeLabel(effectiveSalesRange.start, effectiveSalesRange.end),
    [effectiveSalesRange.end, effectiveSalesRange.start],
  );
  const presetProductRange = useMemo(
    () => getPresetDateRange(productRangePreset === 'custom' ? 'month' : productRangePreset, reportTodayDate),
    [productRangePreset, reportTodayDate],
  );
  const productRangeInputStart = productRangePreset === 'custom' ? productRangeStart : presetProductRange.start;
  const productRangeInputEnd = productRangePreset === 'custom' ? productRangeEnd : presetProductRange.end;
  const effectiveProductRange = useMemo(() => {
    const candidateStart = productRangePreset === 'custom' ? productRangeStart : presetProductRange.start;
    const candidateEnd = productRangePreset === 'custom' ? productRangeEnd : presetProductRange.end;

    if (!candidateStart || !candidateEnd) {
      return presetProductRange;
    }

    return candidateStart <= candidateEnd
      ? { start: candidateStart, end: candidateEnd }
      : { start: candidateEnd, end: candidateStart };
  }, [presetProductRange, productRangeEnd, productRangePreset, productRangeStart]);
  const productRangeLabel = useMemo(
    () => formatRangeLabel(effectiveProductRange.start, effectiveProductRange.end),
    [effectiveProductRange.end, effectiveProductRange.start],
  );
  const periodFinished = useMemo(
    () => finished.filter((appointment) => {
      const normalizedDate = standardizeDate(appointment.date);
      return normalizedDate >= effectiveSalesRange.start && normalizedDate <= effectiveSalesRange.end;
    }),
    [effectiveSalesRange.end, effectiveSalesRange.start, finished],
  );
  const periodPosSales = useMemo(
    () => scopedPosSales.filter((sale) => {
      if (!sale?.createdAt) return false;
      const saleDate = formatLocalDateYmd(new Date(sale.createdAt));
      return saleDate >= effectiveSalesRange.start && saleDate <= effectiveSalesRange.end;
    }),
    [effectiveSalesRange.end, effectiveSalesRange.start, scopedPosSales],
  );
  const total = useMemo(
    () => periodFinished.reduce((acc, appointment) => acc + (parseInt(appointment.price) || 0), 0),
    [periodFinished],
  );
  const totalProductRevenue = useMemo(
    () => periodPosSales.reduce((acc, sale) => acc + (Number(sale.productTotal || 0)), 0),
    [periodPosSales],
  );
  const totalCombinedRevenue = total + totalProductRevenue;
  const productReportPosSales = useMemo(
    () => scopedPosSales.filter((sale) => {
      if (!sale?.createdAt) return false;
      const saleDate = formatLocalDateYmd(new Date(sale.createdAt));
      return saleDate >= effectiveProductRange.start && saleDate <= effectiveProductRange.end;
    }),
    [effectiveProductRange.end, effectiveProductRange.start, scopedPosSales],
  );
  const totalProductUnits = useMemo(
    () => productReportPosSales.reduce((acc, sale) => (
      acc + (sale.items || []).reduce((saleUnits, item) => (
        item.category === 'Producto' ? saleUnits + (Number(item.qty) || 0) : saleUnits
      ), 0)
    ), 0),
    [productReportPosSales],
  );
  const productReportRevenue = useMemo(
    () => productReportPosSales.reduce((acc, sale) => acc + (Number(sale.productTotal || 0)), 0),
    [productReportPosSales],
  );
  const productSalesSummary = useMemo(() => {
    const summaryMap = new Map();

    productReportPosSales.forEach((sale) => {
      const saleTicketNumber = Number(sale.ticketNumber || 0);
      (sale.items || []).forEach((item) => {
        if (item.category !== 'Producto') return;

        const key = String(item.id || item.name || '');
        const current = summaryMap.get(key) || {
          id: item.id || key,
          name: item.name || 'Producto',
          units: 0,
          revenue: 0,
          tickets: new Set(),
        };

        current.units += Number(item.qty) || 0;
        current.revenue += (Number(item.price) || 0) * (Number(item.qty) || 0);
        if (saleTicketNumber > 0) current.tickets.add(saleTicketNumber);
        summaryMap.set(key, current);
      });
    });

    return Array.from(summaryMap.values())
      .map((entry) => ({
        ...entry,
        ticketsCount: entry.tickets.size,
      }))
      .sort((left, right) => (
        right.revenue - left.revenue
        || right.units - left.units
        || left.name.localeCompare(right.name)
      ));
  }, [productReportPosSales]);
  const productChartSegments = useMemo(() => {
    const colors = ['#00f5a0', '#7c5cff', '#ffb800', '#ff4db8', '#22d3ee', '#b026ff', '#7dff3c'];
    const totalRevenue = productSalesSummary.reduce((sum, product) => sum + product.revenue, 0);
    const { segments } = productSalesSummary.reduce((accumulator, product, index) => {
      const percentage = totalRevenue > 0 ? (product.revenue / totalRevenue) * 100 : 0;
      const segment = {
        ...product,
        color: colors[index % colors.length],
        start: accumulator.nextStart,
        end: accumulator.nextStart + percentage,
        percentage,
      };

      return {
        nextStart: accumulator.nextStart + percentage,
        segments: [...accumulator.segments, segment],
      };
    }, { nextStart: 0, segments: [] });

    return segments;
  }, [productSalesSummary]);
  const productPieBackground = useMemo(() => {
    if (!productChartSegments.length) return 'conic-gradient(#0f172a 0 100%)';
    return `conic-gradient(${productChartSegments.map((segment) => (
      `${segment.color} ${segment.start}% ${segment.end}%`
    )).join(', ')})`;
  }, [productChartSegments]);
  const productPieLabels = useMemo(
    () => productChartSegments
      .filter((segment) => segment.percentage > 0)
      .map((segment) => {
        const midPoint = (segment.start + segment.end) / 2;
        const angle = ((midPoint / 100) * 360) - 90;
        const angleInRadians = (angle * Math.PI) / 180;
        const radius = 42;

        return {
          id: segment.id,
          color: segment.color,
          percentageLabel: `${segment.percentage.toFixed(1)}%`,
          left: `${50 + (Math.cos(angleInRadians) * radius)}%`,
          top: `${50 + (Math.sin(angleInRadians) * radius)}%`,
        };
      }),
    [productChartSegments],
  );
  const clientsById = useMemo(() => Object.fromEntries((clients || []).map(c => [String(c.id), c])), [clients]);
  const barberIdsWithScopedAppointments = useMemo(
    () => new Set((scopedAppointments || []).map((appointment) => String(appointment.barberId || '')).filter(Boolean)),
    [scopedAppointments],
  );
  const scopedBarbers = useMemo(
    () => (barbers || []).filter((barber) => (
      effectiveReportBranchId === 'all'
        ? true
        : (
          String(barber.branchId || '') === String(effectiveReportBranchId)
          || barberIdsWithScopedAppointments.has(String(barber.id))
        )
    )),
    [barbers, effectiveReportBranchId, barberIdsWithScopedAppointments],
  );
  const presetStaffRange = useMemo(
    () => getPresetDateRange(staffRangePreset === 'custom' ? 'month' : staffRangePreset, reportTodayDate),
    [reportTodayDate, staffRangePreset],
  );
  const rangeInputStart = staffRangePreset === 'custom' ? staffRangeStart : presetStaffRange.start;
  const rangeInputEnd = staffRangePreset === 'custom' ? staffRangeEnd : presetStaffRange.end;
  const effectiveStaffRange = useMemo(() => {
    const candidateStart = staffRangePreset === 'custom' ? staffRangeStart : presetStaffRange.start;
    const candidateEnd = staffRangePreset === 'custom' ? staffRangeEnd : presetStaffRange.end;

    if (!candidateStart || !candidateEnd) {
      return presetStaffRange;
    }

    return candidateStart <= candidateEnd
      ? { start: candidateStart, end: candidateEnd }
      : { start: candidateEnd, end: candidateStart };
  }, [presetStaffRange, staffRangeEnd, staffRangePreset, staffRangeStart]);
  const staffRangeLabel = useMemo(
    () => formatRangeLabel(effectiveStaffRange.start, effectiveStaffRange.end),
    [effectiveStaffRange.end, effectiveStaffRange.start],
  );
  const monthlyFinished = useMemo(
    () => finished.filter((appointment) => {
      const normalizedDate = standardizeDate(appointment.date);
      return normalizedDate >= effectiveStaffRange.start && normalizedDate <= effectiveStaffRange.end;
    }),
    [effectiveStaffRange.end, effectiveStaffRange.start, finished],
  );
  const currentMonthRange = useMemo(
    () => getPresetDateRange('month', reportTodayDate),
    [reportTodayDate],
  );
  const monthlyGlobalFinished = useMemo(
    () => globalFinished.filter((appointment) => {
      const normalizedDate = standardizeDate(appointment.date);
      return normalizedDate >= currentMonthRange.start && normalizedDate <= currentMonthRange.end;
    }),
    [currentMonthRange.end, currentMonthRange.start, globalFinished],
  );
  
  const barGradients = [
    'from-indigo-500 to-blue-700', 'from-emerald-400 to-teal-700', 'from-amber-400 to-orange-700', 
    'from-rose-500 to-pink-700', 'from-violet-500 to-purple-800', 'from-cyan-400 to-sky-700', 'from-fuchsia-500 to-pink-600'
  ];

  const stats = useMemo(() => {
    const hasData = finished.length > 0;

    const globalStaffMetrics = (barbers || []).map((barber) => {
      const barberFinished = monthlyGlobalFinished.filter((appointment) => String(appointment.barberId) === String(barber.id));
      const barberCount = barberFinished.length;
      const barberSales = barberFinished.reduce((sum, appointment) => sum + (parseInt(appointment.price) || 0), 0);

      return {
        ...barber,
        count: barberCount,
        sales: barberSales,
      };
    });

    const bestBarberObj = globalStaffMetrics.length > 0
      ? globalStaffMetrics.reduce((prev, current) => (prev.sales >= current.sales ? prev : current), globalStaffMetrics[0])
      : null;
    
    // M?trica por personal
    const staffMetrics = scopedBarbers.map((b) => {
      const bFinished = finished.filter(a => String(a.barberId) === String(b.id));
      const bCount = bFinished.length;
      const bSales = bFinished.reduce((sum, a) => sum + (parseInt(a.price) || 0), 0);
      const bAvgTicket = bCount > 0 ? bSales / bCount : 0;
      
      const ratings = bFinished.filter(a => typeof a.rating === 'number').map(a => a.rating);
      const avgRating = ratings.length > 0 ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : "0.0";

      return { 
        ...b, 
        count: bCount, 
        sales: bSales, 
        avgTicket: bAvgTicket, 
        retention: bCount > 0 ? Math.min(70 + Math.min(bCount * 3, 30), 100) : 0,
        rating: avgRating
      };
    });
    
    // Servicios m?s vendidos
    const serviceCounts = {};
    finished.forEach(a => { serviceCounts[a.service] = (serviceCounts[a.service] || 0) + 1; });
    const topServiceNameVal = Object.keys(serviceCounts).length > 0 ? Object.keys(serviceCounts).reduce((a, b) => serviceCounts[a] > serviceCounts[b] ? a : b, null) : 'Sin datos';
    const topServiceCountVal = serviceCounts[topServiceNameVal] || 0;

    // Clientes nuevos
    const startOfMonth = new Date(reportTodayDate.getFullYear(), reportTodayDate.getMonth(), 1);
    const clientsWithVisitsInScope = new Set(finished.map((appointment) => String(appointment.clientId || '')));
    const newClientsThisMonthVal = (clients || []).filter((client) => (
      clientsWithVisitsInScope.has(String(client.id)) && new Date(client.createdAt) >= startOfMonth
    )).length;

    const getHistoricalRealData = () => {
      const today = reportTodayDate;
      
      if (salesPeriod === 'week') {
        const daysLabels = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
        const currentDayIdx = today.getDay();
        const diffToMonday = currentDayIdx === 0 ? -6 : 1 - currentDayIdx;
        const monday = new Date(today);
        monday.setDate(today.getDate() + diffToMonday);
        
        const result = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(monday.getDate() + i);
          const dateStr = formatLocalDateYmd(d);
          const totalDay = finished
            .filter(a => standardizeDate(a.date) === dateStr)
            .reduce((sum, a) => sum + (Number(a.price) || 0), 0);
          result.push({ label: daysLabels[i], value: totalDay });
        }
        return result;
      }

      if (salesPeriod === 'month') {
        const result = [{ label: 'Sem 1', value: 0 }, { label: 'Sem 2', value: 0 }, { label: 'Sem 3', value: 0 }, { label: 'Sem 4', value: 0 }];
        finished.forEach(a => {
          const aptDate = parseLocalDate(a.date);
          if (!aptDate) return;
          if (aptDate.getMonth() === today.getMonth() && aptDate.getFullYear() === today.getFullYear()) {
            const day = aptDate.getDate();
            const weekIdx = Math.min(Math.floor((day - 1) / 7), 3);
            result[weekIdx].value += (Number(a.price) || 0);
          }
        });
        return result;
      }

      if (salesPeriod === 'year') {
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const result = months.map(m => ({ label: m, value: 0 }));
        finished.forEach(a => {
          const aptDate = parseLocalDate(a.date);
          if (!aptDate) return;
          if (aptDate.getFullYear() === today.getFullYear()) {
            result[aptDate.getMonth()].value += (Number(a.price) || 0);
          }
        });
        return result;
      }
      return [];
    };

    return { 
      bestBarber: bestBarberObj, 
      bestBarberCount: bestBarberObj?.count ?? 0, 
      bestBarberSales: bestBarberObj?.sales ?? 0, 
      topServiceName: topServiceNameVal || 'Sin datos', 
      topServiceCount: topServiceCountVal, 
      newClientsThisMonth: newClientsThisMonthVal, 
      globalAvgTicket: finished.length > 0 ? finishedRevenueTotal / finished.length : 0, 
      staffMetrics, 
      historicalSales: getHistoricalRealData(), 
      hasData 
    };
  }, [barbers, clients, finished, finishedRevenueTotal, monthlyGlobalFinished, reportTodayDate, salesPeriod, scopedBarbers]);

  const monthlyStaffMetrics = useMemo(() => {
    return scopedBarbers.map((b) => {
      const bFinished = monthlyFinished.filter(a => String(a.barberId) === String(b.id));
      const bCount = bFinished.length;
      const bSales = bFinished.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
      return {
        ...b,
        count: bCount,
        sales: bSales,
      };
    });
  }, [scopedBarbers, monthlyFinished]);

  const maxMonthlyApts = Math.max(...monthlyStaffMetrics.map(m => m.count), 1);
  const maxMonthlySales = Math.max(...monthlyStaffMetrics.map(m => m.sales), 1);

  const downloadMonthlyServicesReport = () => {
    if (!monthlyFinished.length) return;

    const escapeCsv = (value) => `"${`${value ?? ''}`.replace(/"/g, '""')}"`;
    const rows = monthlyFinished
      .slice()
      .sort((a, b) => parseLocalDate(b.date) - parseLocalDate(a.date))
      .map((apt) => {
        const barber = barbersById[String(apt.barberId)];
        const client = clientsById[String(apt.clientId)];
        const serviceDate = parseLocalDate(apt.date);
        return [
          barber?.fullName || barber?.name || `Barbero ${apt.barberId}`,
          client?.name || 'Cliente sin registro',
          Number(apt.price || 0),
          serviceDate ? serviceDate.toLocaleDateString('es-ES') : standardizeDate(apt.date),
        ].map(escapeCsv).join(',');
      });

    const csv = `\uFEFFsep=,\r\n${['Barbero', 'Cliente', 'Costo del servicio', 'Fecha de servicio'].map(escapeCsv).join(',')}\r\n${rows.join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-servicios-${effectiveStaffRange.start}-${effectiveStaffRange.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const downloadProductSalesReport = () => {
    if (!productSalesSummary.length) return;

    const escapeCsv = (value) => `"${`${value ?? ''}`.replace(/"/g, '""')}"`;
    const rows = productSalesSummary.map((product) => [
      product.name,
      product.units,
      product.ticketsCount,
      product.revenue,
    ].map(escapeCsv).join(','));

    const totalsRow = [
      'TOTAL',
      totalProductUnits,
      productReportPosSales.length,
      productReportRevenue,
    ].map(escapeCsv).join(',');

    const csv = `\uFEFFsep=,\r\n${[
      ['Reporte', 'Ventas de productos'],
      ['Rango', productRangeLabel],
      ['Tickets POS', productReportPosSales.length],
      ['Unidades vendidas', totalProductUnits],
      ['Ingreso total', productReportRevenue],
      [],
      ['Producto', 'Unidades', 'Tickets', 'Ingreso'],
    ].map((row) => row.map(escapeCsv).join(',')).join('\r\n')}\r\n${rows.join('\r\n')}\r\n${totalsRow}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reporte-productos-${effectiveProductRange.start}-${effectiveProductRange.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const historicalMax = useMemo(() => {
    const vals = stats.historicalSales.map(d => d.value);
    const max = Math.max(...vals);
    return max === 0 ? 1000 : max;
  }, [stats.historicalSales]);

  return (
    <div className="p-12 space-y-12 h-full animate-in fade-in pb-32 text-white no-print">
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-end gap-5 text-white">
        <div><h3 className="text-4xl font-black italic uppercase tracking-tighter leading-none text-white">Análisis del Negocio</h3><p className="text-[10px] text-indigo-400 font-black uppercase mt-2 italic tracking-[0.2em] leading-none">Métricas avanzadas y rendimiento comercial real</p></div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          {(branches || []).length > 0 && (
            <div className="min-w-[250px]">
              <select
                value={effectiveReportBranchId}
                onChange={(e) => setSelectedReportBranchId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-sm font-bold text-white outline-none focus:border-indigo-500 italic"
              >
                <option value="all">Toda la barbería</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 text-white"><CalendarIcon size={20} className="text-slate-500" /><span className="text-xs font-black uppercase italic text-white">{reportTodayDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span></div>
        </div>
      </div>
      {unresolvedLegacyPosSalesCount > 0 && (
        <div className="rounded-[1.6rem] border border-amber-500/25 bg-amber-500/10 px-5 py-4 text-amber-100 shadow-[0_10px_30px_rgba(245,158,11,0.08)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300 leading-none">Advertencia POS</p>
          <p className="mt-2 text-sm font-bold leading-relaxed">
            Hay {unresolvedLegacyPosSalesCount} venta{unresolvedLegacyPosSalesCount === 1 ? '' : 's'} POS antigua{unresolvedLegacyPosSalesCount === 1 ? '' : 's'} sin sucursal asignada.
            No se pueden atribuir con seguridad a la sucursal seleccionada hasta normalizar su `branch_id`.
          </p>
        </div>
      )}
      
      <div className="flex items-center gap-3 p-1.5 bg-black border border-slate-900 rounded-[2rem] w-fit mx-auto shadow-2xl text-white">
        <button onClick={() => setReportTab('ventas')} className={`flex items-center gap-3 px-8 py-4 rounded-[1.8rem] text-[11px] font-black uppercase italic tracking-widest transition-all ${reportTab === 'ventas' ? 'bg-indigo-600 text-white shadow-[0_10px_20px_rgba(79,70,229,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}><TrendingUp size={16}/> Análisis de Venta</button>
        <button onClick={() => setReportTab('personal')} className={`flex items-center gap-3 px-8 py-4 rounded-[1.8rem] text-[11px] font-black uppercase italic tracking-widest transition-all ${reportTab === 'personal' ? 'bg-indigo-600 text-white shadow-[0_10px_20px_rgba(79,70,229,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}><Users size={16}/> Análisis de Personal</button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-white">
        {reportTab === 'ventas' ? (
          <section className="space-y-10 text-white">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8 text-white">
              <div className="bg-slate-900 neon-border-indigo p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                    <p className="text-[11px] font-black text-slate-500 uppercase italic tracking-widest leading-none">Ingresos Totales (Corte)</p>
                    <div className="p-2 bg-indigo-600/20 rounded-lg text-indigo-400"><ArrowUpRight size={16} /></div>
                  </div>
                  <h4 className="text-5xl font-black text-indigo-400 italic tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]">C$ {(Number(total) || 0).toLocaleString()}</h4>
                  <div className="mt-8 flex items-center gap-2 text-white">
                    <div className="h-1 flex-1 bg-black rounded-full overflow-hidden text-white"><div className="h-full bg-indigo-600 w-full" /></div>
                    <span className="text-[10px] font-black text-indigo-400 leading-none">{salesRangeLabel}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 neon-border-emerald p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                    <p className="text-[11px] font-black text-slate-500 uppercase italic tracking-widest leading-none">Ventas de Productos</p>
                    <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-400"><Package size={16} /></div>
                  </div>
                  <h4 className="text-5xl font-black text-emerald-400 italic tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">C$ {(Number(totalProductRevenue) || 0).toLocaleString()}</h4>
                  <div className="mt-8 flex items-center gap-2 text-white">
                    <div className="h-1 flex-1 bg-black rounded-full overflow-hidden text-white"><div className="h-full bg-emerald-500 w-full" /></div>
                    <span className="text-[10px] font-black text-emerald-400 leading-none">{salesRangeLabel}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <Target className="absolute -right-6 -bottom-6 w-40 h-40 text-slate-800/10 -rotate-12" />
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Servicio m?s Vendido</p>
                    <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-400"><Sparkles size={16} /></div>
                  </div>
                  <h4 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-tight truncate drop-shadow-lg">{stats.topServiceName}</h4>
                  <p className="text-emerald-400 font-black text-xl mt-4 italic flex items-center gap-2 leading-none">{stats.topServiceCount} Servicios Reales <TrendingUp size={16}/></p>
                </div>
              </div>

              <div className="bg-slate-900 neon-border-emerald p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden group flex flex-col justify-between text-white">
                <div className="relative z-10 text-white">
                  <div className="flex justify-between items-center mb-6 text-white">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic leading-none">Ingreso Total del Negocio</p>
                    <div className="p-2 bg-emerald-600/20 rounded-lg text-emerald-400"><UserPlus size={16} /></div>
                  </div>
                  <h4 className="text-6xl font-black text-emerald-400 italic tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">C$ {totalCombinedRevenue.toLocaleString()}</h4>
                  <p className="text-[10px] text-slate-500 font-black mt-4 uppercase italic leading-none">Cortes + productos • {salesRangeLabel}</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-10 rounded-[3.5rem] shadow-2xl relative text-white flex flex-col min-h-[550px]">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 text-white">
                <div>
                  <h5 className="text-2xl font-black italic uppercase text-white flex items-center gap-3"><BarChart3 className="text-indigo-500" /> Rendimiento de Ingresos</h5>
                  <p className="text-[10px] text-slate-500 font-black uppercase italic mt-1 tracking-widest leading-none">Histórico real de la semana en curso (Lunes - Domingo)</p>
                </div>
                <div className="flex items-center gap-2 p-1.5 bg-black border border-slate-800 rounded-2xl text-white">
                  {periodOptions.map(period => (
                    <button key={period.id} onClick={() => setSalesPeriod(period.id)} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase italic tracking-widest transition-all ${salesPeriod === period.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{period.label}</button>
                  ))}
                </div>
              </div>

              <div className="relative h-[320px] w-full flex items-end justify-between gap-6 px-4 text-white">
                <div className="absolute inset-x-0 top-0 bottom-0 pointer-events-none flex flex-col justify-between opacity-5 z-0">
                  {[...Array(6)].map((_, i) => <div key={i} className="w-full h-px bg-white"></div>)}
                </div>
                {stats.historicalSales.map((data, idx) => {
                  const hVal = (data.value / historicalMax) * 100;
                  const gradient = barGradients[idx % barGradients.length];
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center relative z-10 h-full group text-white">
                      <div className="flex-1 w-full flex flex-col justify-end items-center text-white">
                        <div className="flex flex-col items-center mb-3 transition-transform duration-300 group-hover:scale-125 text-white">
                          <span className="text-[13px] font-black text-white italic drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none">
                            C$ {data.value >= 1000 ? (data.value / 1000).toFixed(1) + 'k' : data.value}
                          </span>
                        </div>
                        <div className={`w-full max-w-[60px] rounded-t-3xl transition-all duration-1000 ease-out relative bg-gradient-to-t ${gradient} shadow-[0_10px_30px_rgba(0,0,0,0.5)] border-t border-white/20`} style={{ height: `${Math.max(hVal, 5)}%` }}>
                           <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent rounded-t-3xl text-white"></div>
                           <div className={`absolute inset-0 opacity-0 transition-opacity rounded-t-3xl blur-xl bg-gradient-to-t ${gradient} group-hover:opacity-40 text-white`} />
                        </div>
                      </div>
                      <div className="h-10 flex items-center text-white">
                        <p className="text-[11px] font-black uppercase text-white italic tracking-[0.2em] opacity-60 group-hover:opacity-100 transition-all leading-none">{data.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-white">
              <div className="bg-slate-900 border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
                <div className="px-8 py-7 border-b border-slate-800 bg-black/50 flex flex-col gap-5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                      <h5 className="text-xl font-black italic uppercase text-white flex items-center gap-3"><Package className="text-emerald-400" size={20} /> Reporte de Ventas de Productos</h5>
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2 italic leading-none">{productRangeLabel}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 lg:items-start">
                      <div className="min-h-[52px] min-w-[220px] px-4 py-3 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex flex-col justify-center text-left">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300/80 leading-none">
                          {productRangePreset === 'custom' ? 'Rango personalizado' : `Vista ${periodOptions.find((option) => option.id === productRangePreset)?.label || 'Mes'}`}
                        </span>
                        <span className="mt-2 text-[11px] font-black text-white leading-tight break-words">{productRangeLabel}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowProductRangeControls((prev) => !prev)}
                          className={`min-h-[52px] px-5 rounded-2xl border text-[10px] font-black uppercase tracking-[0.18em] transition-all flex items-center justify-center gap-2 ${
                            showProductRangeControls
                              ? 'bg-white/10 text-white border-white/15'
                              : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:text-white'
                          }`}
                        >
                          <Filter size={14} />
                          {showProductRangeControls ? 'Ocultar filtros' : 'Filtros'}
                        </button>
                        <button
                          onClick={downloadProductSalesReport}
                          disabled={!productSalesSummary.length}
                          className="min-h-[52px] px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-[10px] font-black uppercase italic tracking-widest leading-none transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2"
                        >
                          <Save size={14} /> Exportar Excel
                        </button>
                      </div>
                    </div>
                  </div>

                  {showProductRangeControls && (
                    <div className="rounded-[1.8rem] border border-white/5 bg-slate-950/60 p-3 space-y-3 animate-in fade-in duration-200">
                      <div className="grid grid-cols-3 gap-2">
                        {periodOptions.map((period) => (
                          <button
                            key={period.id}
                            type="button"
                            onClick={() => setProductRangePreset(period.id)}
                            className={`min-h-[44px] rounded-2xl border text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                              productRangePreset === period.id
                                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg'
                                : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            {period.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={productRangeInputStart}
                          onChange={(e) => {
                            setProductRangePreset('custom');
                            setProductRangeStart(e.target.value);
                          }}
                          className="min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950/70 px-4 text-sm font-bold text-white outline-none focus:border-emerald-500"
                        />
                        <input
                          type="date"
                          value={productRangeInputEnd}
                          onChange={(e) => {
                            setProductRangePreset('custom');
                            setProductRangeEnd(e.target.value);
                          }}
                          className="min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950/70 px-4 text-sm font-bold text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {productSalesSummary.length > 0 ? (
                  <div className="p-8 grid grid-cols-1 xl:grid-cols-[minmax(360px,40%)_1fr] gap-10 items-start">
                    <div className="space-y-6 flex justify-center xl:justify-center">
                      <div className="relative mx-auto aspect-square w-full max-w-[460px] flex items-center justify-center">
                        {productPieLabels.map((label) => (
                          <div
                            key={label.id}
                            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 min-w-[84px] px-4 py-2 rounded-full border text-center text-sm font-black italic text-white whitespace-nowrap"
                            style={{
                              left: label.left,
                              top: label.top,
                              backgroundColor: label.color,
                              borderColor: `${label.color}cc`,
                              boxShadow: '0 0 0 3px #0f172a, 0 10px 24px rgba(2,6,23,0.32)',
                            }}
                          >
                            {label.percentageLabel}
                          </div>
                        ))}

                        <div
                          className="aspect-square w-full rounded-full overflow-hidden flex items-center justify-center border border-white/5"
                          style={{
                            background: productPieBackground,
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 22px 48px rgba(2,6,23,0.42)',
                          }}
                        >
                          <div className="aspect-square w-[50%] rounded-full bg-slate-950 border border-white/5 flex flex-col items-center justify-center text-center px-5">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Ventas Totales</span>
                            <span className="mt-3 text-4xl font-black italic text-emerald-400 leading-none">C$ {productReportRevenue.toLocaleString()}</span>
                            <span className="mt-3 text-[11px] font-black uppercase italic text-slate-400 leading-none">{totalProductUnits} unidades</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-full max-w-[720px] ml-auto space-y-3.5 min-h-[320px]">
                      {productChartSegments.map((product, index) => (
                        <div key={product.id} className="rounded-[1.9rem] border border-white/5 bg-black/35 px-5 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <span className="mt-1 block w-4 h-4 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.12)]" style={{ backgroundColor: product.color }} />
                              <div>
                                <p className="text-[13px] font-black uppercase italic tracking-tight text-white leading-none">{product.name}</p>
                                <div className="mt-2.5 flex flex-wrap gap-2">
                                  <span className="px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03] text-[8px] font-black uppercase italic text-slate-300 leading-none">{product.units} unidades</span>
                                  <span className="px-2.5 py-1 rounded-full border border-indigo-400/20 bg-indigo-500/10 text-[8px] font-black uppercase italic text-indigo-300 leading-none">{product.ticketsCount} tickets</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 leading-none">{product.percentage.toFixed(1)}%</p>
                              <p className="mt-2 text-[28px] font-black italic text-emerald-400 leading-none">C$ {product.revenue.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-slate-950 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.max(product.percentage, 4)}%`, backgroundColor: product.color }} />
                          </div>
                          <p className="mt-2.5 text-[8px] font-black uppercase tracking-[0.16em] text-slate-600 leading-none">Producto #{index + 1}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="px-8 py-16 text-center">
                    <Package size={34} className="mx-auto text-slate-700 mb-4" />
                    <p className="text-sm font-black uppercase italic text-slate-400">No hay ventas de productos en este rango</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mt-3">Prueba con otra sucursal o cambia el periodo</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-12 text-white">
            <div className="flex items-center gap-4 text-white"><div className="h-px flex-1 bg-gradient-to-r from-indigo-500/50 to-transparent"></div><h4 className="text-xl font-black italic uppercase text-indigo-400 tracking-tighter">Eficiencia del Staff</h4><div className="h-px flex-1 bg-gradient-to-l from-indigo-500/50 to-transparent"></div></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-white">
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic leading-none">Ticket Promedio Equipo</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-indigo-400 leading-none">C$ {stats.globalAvgTicket.toFixed(0)}</h5><div className="p-2 bg-indigo-600/10 rounded-lg text-indigo-500"><TrendingUp size={16}/></div></div></div>
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic leading-none">Nivel Satisfacción</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-amber-500 leading-none">4.8 / 5.0</h5><div className="p-2 bg-amber-600/10 rounded-lg text-amber-500"><Star size={16} fill="currentColor"/></div></div></div>
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] italic leading-none">Tasa de Retención</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-emerald-400 leading-none">82%</h5><div className="p-2 bg-emerald-600/10 rounded-lg text-emerald-400"><UserCheck size={16}/></div></div></div>
               <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 flex flex-col gap-2 text-white"><p className="text-[9px] font-black text-slate-500 uppercase italic leading-none">Servicios Finalizados</p><div className="flex items-end justify-between text-white"><h5 className="text-2xl font-black italic text-rose-400 leading-none">{finished.length}</h5><div className="p-2 bg-rose-600/10 rounded-lg text-rose-400"><Scissors size={16}/></div></div></div>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 text-white">
              <div className="bg-mesh-amber border-2 border-amber-500/60 p-10 rounded-[3.5rem] flex flex-col items-center text-center shadow-[0_0_60px_rgba(245,158,11,0.4)] animate-glow relative overflow-hidden group text-white min-h-[570px] justify-center">
                <div className="absolute inset-0 aurora-effect opacity-10 pointer-events-none z-0"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.20] pointer-events-none z-0 animate-spin-very-slow text-white"><Crown size={500} className="text-amber-500" strokeWidth={0.6} /></div>
                <Scissors className="absolute top-20 right-10 text-emerald-400 -rotate-12 animate-float" size={50} />
                <Star className="absolute top-1/4 right-[30%] text-amber-500 rotate-12 animate-float" size={44} />
                <Sparkles className="absolute bottom-20 left-10 text-amber-500/90 animate-float" size={70} />
                <Award className="absolute bottom-1/4 right-10 text-amber-500/90 -rotate-15 animate-float" size={75} />
                <div className="relative z-10 flex flex-col items-center text-white w-full">
                  <Crown size={72} className="text-amber-500 drop-shadow-[0_10px_15px_rgba(245,158,11,1)] animate-bounce mb-6" />
                  <div className="transition-transform duration-700 relative group-hover:scale-110 text-white">
                    <div className="absolute inset-0 bg-amber-400 blur-3xl opacity-30 animate-pulse text-white"></div>
                    <div className="w-40 h-40 bg-amber-500 rounded-[3.5rem] flex items-center justify-center text-amber-950 font-black text-6xl italic shadow-[0_0_60px_rgba(245,158,11,0.8)] border-4 border-amber-50 relative z-10 overflow-hidden text-white">
                      <span className="relative z-10 drop-shadow-2xl">{stats.bestBarber?.avatar || '?'}</span>
                    </div>
                  </div>
                  <div className="mt-12 text-white w-full">
                    <p className="text-[14px] font-black text-amber-500 uppercase italic tracking-[0.4em] mb-2 drop-shadow-md leading-none">---THE BEST BARBER-PRO---</p>
                    <h4 className="text-6xl font-black italic uppercase text-white tracking-tighter drop-shadow-[0_5px_15px_rgba(0,0,0,0.8)] leading-none">{stats.bestBarber?.name || '---'}</h4>
                  </div>
                  <div className="mt-16 pt-10 border-t border-white/20 w-full flex justify-between px-8 text-white relative">
                    <div className="flex flex-col items-start text-white"><p className="text-[13px] font-black text-amber-500 uppercase mb-2 italic tracking-widest opacity-80 leading-none">Total Cortes</p><p className="text-6xl font-black text-white leading-none tracking-tighter drop-shadow-lg">{stats.bestBarberCount || 0}</p></div>
                    <div className="flex flex-col items-end text-white"><p className="text-[13px] font-black text-amber-500 uppercase mb-2 italic tracking-widest opacity-80 leading-none">Ventas Brutas</p><p className="text-6xl font-black text-white leading-none tracking-tighter drop-shadow-lg"><span className="text-2xl mr-1 font-bold text-emerald-400">C$</span>{(stats.bestBarberSales || 0).toLocaleString()}</p></div>
                  </div>
                </div>
              </div>
              
              <div className="xl:col-span-2 bg-slate-900 border border-slate-800 p-10 rounded-[3.5rem] shadow-2xl relative text-white flex flex-col">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-start gap-8 mb-10 text-white">
                  <div className="max-w-xl">
                    <h5 className="text-xl font-black italic uppercase text-white flex items-center gap-2"><BarChart3 className="text-indigo-500" /> Comparativa de Rendimiento Real</h5>
                    <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mt-1 italic leading-none">Citas e ingresos por barbero dentro del rango seleccionado</p>
                  </div>
                  <div className="w-full lg:w-auto flex flex-col lg:flex-row gap-3 lg:items-start">
                    <div className="w-full lg:w-[380px] rounded-[2rem] border border-white/5 bg-black/25 p-3 shadow-inner">
                      <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="min-h-[52px] flex-1 px-4 py-3 rounded-2xl bg-indigo-600/15 border border-indigo-500/20 flex flex-col justify-center text-left">
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-300/80 leading-none">
                            {staffRangePreset === 'custom' ? 'Rango personalizado' : `Vista ${periodOptions.find((option) => option.id === staffRangePreset)?.label || 'Mes'}`}
                          </span>
                          <span className="mt-2 text-[11px] font-black text-white leading-tight break-words">
                            {staffRangeLabel}
                          </span>
                          <span className="hidden text-[11px] font-black text-white leading-tight break-words">
                            {staffRangePreset === 'custom' ? 'Rango personalizado' : `Vista ${periodOptions.find((option) => option.id === staffRangePreset)?.label || 'Mes'}`} • {staffRangeLabel}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowStaffRangeControls((prev) => !prev)}
                            className={`min-h-[52px] px-5 rounded-2xl border text-[10px] font-black uppercase tracking-[0.18em] transition-all flex items-center justify-center gap-2 ${
                              showStaffRangeControls
                                ? 'bg-white/10 text-white border-white/15'
                                : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:text-white'
                            }`}
                          >
                            <Filter size={14} />
                            {showStaffRangeControls ? 'Ocultar filtros' : 'Filtros'}
                          </button>
                          <button
                            onClick={downloadMonthlyServicesReport}
                            disabled={monthlyFinished.length === 0}
                            className="hidden min-h-[52px] px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-[10px] font-black uppercase italic tracking-widest leading-none transition-all shadow-lg shadow-emerald-950/30 items-center justify-center gap-2"
                          >
                            <Save size={14} /> Exportar Excel
                          </button>
                        </div>
                      </div>

                      {showStaffRangeControls && (
                        <div className="rounded-[1.8rem] border border-white/5 bg-slate-950/60 p-3 space-y-3 animate-in fade-in duration-200">
                          <div className="grid grid-cols-3 gap-2">
                            {periodOptions.map((period) => (
                              <button
                                key={period.id}
                                type="button"
                                onClick={() => setStaffRangePreset(period.id)}
                                className={`min-h-[44px] rounded-2xl border text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                                  staffRangePreset === period.id
                                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg'
                                    : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                {period.label}
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="date"
                              value={rangeInputStart}
                              onChange={(e) => {
                                setStaffRangePreset('custom');
                                setStaffRangeStart(e.target.value);
                              }}
                              className="min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950/70 px-4 text-sm font-bold text-white outline-none focus:border-indigo-500"
                            />
                            <input
                              type="date"
                              value={rangeInputEnd}
                              onChange={(e) => {
                                setStaffRangePreset('custom');
                                setStaffRangeEnd(e.target.value);
                              }}
                              className="min-h-[48px] rounded-2xl border border-slate-800 bg-slate-950/70 px-4 text-sm font-bold text-white outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={downloadMonthlyServicesReport}
                    disabled={monthlyFinished.length === 0}
                    className="w-full lg:w-auto min-h-[52px] lg:min-w-[190px] px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white text-[10px] font-black uppercase italic tracking-widest leading-none transition-all shadow-lg shadow-emerald-950/30 flex items-center justify-center gap-2"
                  >
                    <Save size={14} /> Exportar Excel
                  </button>
                </div>
                </div>
                
                <div className="flex-1 flex items-end justify-between gap-2 md:gap-4 px-4 relative z-10 h-[300px] text-white">
                  
                  {/* CUADR?CULA ESTRUCTURADA DE FONDO */}
                  <div className="absolute inset-0 flex flex-col justify-between opacity-[0.1] pointer-events-none border-l border-slate-700 ml-10 mb-20">
                    {[100, 80, 60, 40, 20, 0].map((val) => (
                      <div key={val} className="w-full flex items-center relative">
                        <span className="absolute -left-10 text-[8px] font-black text-slate-500 w-8 text-right italic leading-none">{val}%</span>
                        <div className="flex-1 h-px border-t border-dashed border-slate-600"></div>
                      </div>
                    ))}
                  </div>

                  {monthlyStaffMetrics.map(b => {
                    const countHeight = (b.count / maxMonthlyApts) * 100;
                    const salesHeight = (b.sales / maxMonthlySales) * 100;
                    const barberColorClass = b.bg || 'bg-indigo-600';
                    
                    return (
                      <div key={b.id} className="flex-1 flex flex-col items-center justify-end h-full group text-white pl-4">
                        <div className="flex items-end gap-1.5 md:gap-2.5 w-full justify-center px-1 h-full min-h-[40px] relative text-white">
                          
                          {/* Barra de Citas */}
                          <div className="flex flex-col items-center justify-end h-full w-full max-w-[24px] md:max-w-[32px] relative text-white">
                            <span 
                              className="text-[10.5px] md:text-[11.5px] font-black text-white absolute whitespace-nowrap bg-indigo-600 px-2.5 py-1 rounded-lg border border-indigo-400 shadow-[0_5px_15px_rgba(79,70,229,0.3)] z-20 transition-all duration-1000 ease-out italic group-hover:scale-110 leading-none"
                              style={{ bottom: `calc(${Math.max(countHeight, 4)}% + 8px)` }}
                            >
                              {b.count}
                            </span>
                            <div className={`w-full rounded-t-2xl transition-all duration-1000 ease-out relative ${barberColorClass} shadow-lg text-white border-t border-white/20`} style={{ height: `${Math.max(countHeight, 4)}%` }}>
                               <div className="absolute inset-0 bg-white/5 opacity-0 transition-opacity rounded-t-2xl group-hover:opacity-100 text-white"></div>
                            </div>
                          </div>
                          
                          {/* Barra de Ingresos */}
                          <div className="flex flex-col items-center justify-end h-full w-full max-w-[24px] md:max-w-[32px] relative text-white">
                            <div 
                              className="absolute text-center z-20 transition-all duration-1000 ease-out"
                              style={{ bottom: `calc(${Math.max(salesHeight, 4)}% + 8px)` }}
                            >
                              <span className="text-[10.5px] md:text-[11.5px] font-black text-emerald-100 italic whitespace-nowrap bg-emerald-600 px-2.5 py-1 rounded-lg border border-emerald-400 shadow-[0_5px_15px_rgba(16,185,129,0.5)] group-hover:scale-110 transition-transform leading-none">
                                C$ {b.sales >= 1000 ? (b.sales / 1000).toFixed(1) + 'k' : b.sales}
                              </span>
                            </div>
                            <div className={`w-full rounded-t-2xl transition-all duration-1000 ease-out relative ${barberColorClass} brightness-125 shadow-lg text-white border-t border-white/30`} style={{ height: `${Math.max(salesHeight, 4)}%` }}>
                               <div className="absolute inset-0 bg-white/10 opacity-30 rounded-t-2xl text-white"></div>
                               <div className={`absolute -inset-1 opacity-0 transition-opacity rounded-t-2xl blur-lg ${barberColorClass} group-hover:opacity-20 text-white`} />
                            </div>
                          </div>
                        </div>
                        
                        <div className="mt-8 flex flex-col items-center gap-2 text-white">
                          <div className={`w-10 h-10 rounded-xl ${b.bg} flex items-center justify-center text-[10px] font-black italic shadow-lg border-2 border-slate-900 transition-transform group-hover:scale-110 text-white`}>
                            {b.avatar}
                          </div>
                          <p className="text-[10px] md:text-[11px] font-black uppercase text-slate-200 italic tracking-[0.08em] leading-none truncate w-20 text-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
                            {b.name.split(' ')[0]}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="mt-12 pt-6 border-t border-white/5 flex items-center justify-center gap-8 text-white">
                   <div className="flex items-center gap-2 text-white">
                     <div className="w-3 h-3 bg-indigo-600 rounded-sm"></div>
                     <span className="text-[10px] font-black text-slate-500 uppercase italic leading-none">Citas del rango</span>
                   </div>
                   <div className="flex items-center gap-2 text-white">
                     <div className="w-3 h-3 bg-emerald-600 rounded-sm"></div>
                     <span className="text-[10px] font-black text-slate-500 uppercase italic leading-none">Ingresos del rango</span>
                   </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6 text-white mt-12">
                <div className="flex items-center gap-4 text-white"><h4 className="text-xl font-black italic uppercase text-white tracking-tighter leading-none">Rendimiento Detallado por Barbero</h4><div className="h-px flex-1 bg-slate-900"></div></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-white">
                  {stats.staffMetrics.map(b => (
                    <div key={b.id} className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] transition-all group relative overflow-hidden hover:border-indigo-500/50 text-white">
                       <div className="flex items-center gap-4 mb-8 text-white">
                         <div className={`w-14 h-14 rounded-2xl ${b.bg} flex items-center justify-center text-white font-black italic text-xl shadow-xl transition-transform text-white`}>{b.avatar}</div>
                         <div className="text-white">
                           <h5 className="text-lg font-black uppercase italic text-white leading-none">{b.name}</h5>
                           <div className="flex items-center gap-1 mt-2 text-amber-500"><Star size={12} fill="currentColor"/><span className="text-[11px] font-black italic leading-none">{b.rating} / 5.0</span></div>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4 text-white">
                         <div className="bg-black p-4 rounded-2xl border border-slate-800 text-white"><p className="text-[9px] font-black text-slate-500 uppercase italic leading-none">Ticket Promedio</p><p className="text-base font-black text-white italic leading-none mt-2">C$ {Math.round(b.avgTicket)}</p></div>
                         <div className="bg-black p-4 rounded-2xl border border-slate-800 text-white"><p className="text-[9px] font-black text-slate-500 uppercase italic leading-none">Retención</p><p className="text-base font-black text-emerald-400 italic leading-none mt-2">{b.retention}%</p></div>
                       </div>
                    </div>
                  ))}
                </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const periodOptions = [{ id: 'week', label: 'Semana' }, { id: 'month', label: 'Mes' }, { id: 'year', label: 'Año' }];

function ClientModal({ onClose, onSave, clients, initial }) {
  const [formData, setFormData] = useState({ name: initial?.name || '', phone: formatPhoneNumber(initial?.phone || ''), notes: initial?.notes || '' });
  const [errorMsg, setErrorMsg] = useState(null);
  const handleSubmit = (e) => { 
    e.preventDefault(); 
    setErrorMsg(null); 
    const formattedPhone = formatPhoneNumber(formData.phone);
    if (!isValidPhoneNumber(formattedPhone)) { setErrorMsg('El celular debe tener exactamente 8 dígitos.'); return; }
    const duplicate = findClientByPhone(clients, formattedPhone, initial?.id);
    if (duplicate) { setErrorMsg(`Este número ya pertenece a: ${duplicate.name}`); return; } 
    onSave({ ...formData, phone: formattedPhone }); 
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-slate-950 w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl border border-slate-800 animate-in zoom-in-95 text-white">
        <div className="px-10 py-12 bg-gradient-to-br from-indigo-600/30 border-b border-slate-800 flex justify-between items-center text-white">
          <div className="flex items-center gap-5 text-white"><div className="w-16 h-16 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white"><UserPlus size={32}/></div><div><h3 className="text-3xl font-black uppercase italic text-white leading-none">{initial ? 'Editar Ficha' : 'Nuevo Cliente'}</h3></div></div>
          <button onClick={onClose} className="p-3 bg-black rounded-2xl text-slate-500 text-white"><X size={24}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-10 space-y-8 text-white">
          {errorMsg && <div className="bg-rose-500/10 border border-rose-500/30 p-5 rounded-2xl text-rose-400 text-[10px] font-black uppercase italic leading-none">{errorMsg}</div>}
          <div className="space-y-3 text-white"><label className="text-[11px] font-black text-slate-500 uppercase italic leading-none">Nombre Completo</label><input required placeholder="Ej. Juan Pérez" className="w-full bg-black border border-slate-800 rounded-3xl px-8 py-5 text-sm font-bold text-white outline-none focus:border-indigo-600 italic leading-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
          <div className="space-y-3 text-white"><label className="text-[11px] font-black text-slate-500 uppercase italic leading-none">Celular</label><input required type="tel" placeholder="0000-0000" className="w-full bg-black border border-slate-800 rounded-3xl px-8 py-5 text-sm font-bold text-white outline-none focus:border-indigo-600 italic leading-none" value={formData.phone} onChange={e => { setErrorMsg(null); setFormData({...formData, phone: formatPhoneNumber(e.target.value)}); }} /></div>
          <div className="space-y-3 text-white"><label className="text-[11px] font-black text-slate-500 uppercase italic leading-none">Notas Técnicas</label><textarea placeholder="Ej. Piel sensible..." className="w-full bg-black border border-slate-800 rounded-3xl px-8 py-5 text-sm font-bold text-white min-h-[140px] outline-none focus:border-indigo-600 italic leading-relaxed" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} /></div>
          <button type="submit" className="w-full bg-indigo-600 py-6 rounded-[2rem] font-black uppercase italic text-xs text-white leading-none">GUARDAR EN BASE DE DATOS</button>
        </form>
      </div>
    </div>
  );
}

function AppointmentModal({ onClose, onSave, services, clients, barbers, initial, appointments }) {
  const availableBarbers = (barbers && barbers.length > 0) ? barbers : [];
  const [searchTerm, setSearchTerm] = useState(initial?.client?.name || '');
  const [phoneVal, setPhoneVal] = useState(formatPhoneNumber(initial?.client?.phone || ''));
  const [selectedClient, setSelectedClient] = useState(initial?.client || null);
  const [showResults, setShowResults] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const [showServiceList, setShowServiceList] = useState(false);
  const [form, setForm] = useState({ 
    date: initial?.date || getTodayString(), 
    time: initial?.time || '09:00', 
    barberId: initial?.barberId || availableBarbers[0]?.id || '', 
    service: initial?.service || '', 
    price: initial?.price || 0,
    type: initial?.type || 'reserva'
  });
  const wrapperRef = useRef(null);
  const serviceRef = useRef(null);
  useEffect(() => { 
    function handleClickOutside(event) { 
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setShowResults(false); 
      if (serviceRef.current && !serviceRef.current.contains(event.target)) setShowServiceList(false); 
    } 
    document.addEventListener("mousedown", handleClickOutside); 
    return () => document.removeEventListener("mousedown", handleClickOutside); 
  }, []);
  const filteredClients = useMemo(() => { 
    if (searchTerm.trim().length < 2 || selectedClient) return []; 
    const phoneQuery = getPhoneDigits(searchTerm);
    return (clients || []).filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (phoneQuery.length > 0 && getPhoneDigits(c.phone).includes(phoneQuery))); 
  }, [searchTerm, clients, selectedClient]);
  const filteredServices = useMemo(
    () => (services || []).filter((service) => !isPromotionService(service) && service.name.toLowerCase().includes(serviceSearch.toLowerCase())),
    [services, serviceSearch],
  );
  const isNewClient = searchTerm.trim().length >= 3 && filteredClients.length === 0 && !selectedClient;
  const duplicatePhoneClient = useMemo(() => {
    if (!isValidPhoneNumber(phoneVal)) return null;
    return findClientByPhone(clients, phoneVal, selectedClient?.id);
  }, [clients, phoneVal, selectedClient]);
  const handleSelectClient = (c) => { setSelectedClient(c); setSearchTerm(c.name); setPhoneVal(formatPhoneNumber(c.phone)); setShowResults(false); setModalError(null); };
  const handleSelectService = (s) => { 
    if (s === "POR DEFINIR") { 
      setForm({...form, service: "POR DEFINIR", price: 0}); 
      setServiceSearch("POR DEFINIR"); 
    } else { 
      setForm({...form, service: s.name, price: s.price}); 
      setServiceSearch(s.name); 
    } 
    setShowServiceList(false); setModalError(null); 
  };
  
  const toMinutes = (t) => {
    if (!t || typeof t !== 'string') return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const handleSubmit = (e) => { 
    e.preventDefault(); 
    setModalError(null); 

    if (!form.barberId) {
      setModalError('Debes tener al menos un barbero activo en esta sucursal para registrar la cita.');
      return;
    }
    
    const selectedDateTime = new Date(`${form.date}T${form.time}:00`);
    const now = new Date();
    
    if (form.type !== 'walkin' && selectedDateTime < new Date(now.getTime() - 5 * 60000)) {
      setModalError('No puedes agendar una cita en el pasado. Elige hora futura.');
      return;
    }

    const newMinutes = toMinutes(form.time);
    const hasReservationConflict = (appointments || []).some(a => {
      if (standardizeDate(a.date) !== standardizeDate(form.date) || String(a.barberId) !== String(form.barberId) || a.status === 'Cancelada' || a.status === 'Finalizada' || a.status === 'Cita Perdida') return false;
      const aptMinutes = toMinutes(a.time);
      return Math.abs(newMinutes - aptMinutes) < 15;
    });

    if (hasReservationConflict) { 
      setModalError(`Este barbero ya tiene una reserva confirmada cerca de las ${form.time}.`); 
      return; 
    } 
    
    if (!form.service) { setModalError("Por favor elige un servicio."); return; } 
    if ((selectedClient || isNewClient) && phoneVal.trim() && !isValidPhoneNumber(phoneVal)) { setModalError("El celular debe tener exactamente 8 dígitos."); return; }
    if (isNewClient && !phoneVal.trim()) { setModalError("Ingresa el número de celular del nuevo cliente."); return; }
    if (isNewClient && duplicatePhoneClient) { setModalError(`Ese número ya está registrado con ${duplicatePhoneClient.name}.`); return; }
    
    onSave(form, { name: searchTerm, phone: formatPhoneNumber(phoneVal), id: selectedClient?.id, isNew: isNewClient }); 
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-6 animate-in fade-in text-white no-print">
      <div className="bg-slate-950 w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-800 animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[95vh] text-white">
        <div className="px-8 py-5 bg-black border-b border-slate-800 flex justify-between items-center text-white">
          <div className="flex items-center gap-4 text-white">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-white">
                {form.type === 'walkin' ? <Zap size={24}/> : <CalendarIcon size={24}/>}
            </div>
            <h3 className="text-2xl font-black uppercase italic text-white leading-none">
                {form.type === 'walkin' ? 'NUEVO TURNO (SIN CITA)' : 'RESERVAR TURNO'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2.5 bg-slate-900 rounded-xl text-slate-500 text-white"><X size={26} strokeWidth={3} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1 text-white">
          {modalError && <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl flex items-center gap-3 text-rose-500 text-[11px] font-black uppercase italic leading-none">{modalError}</div>}
          <div className="space-y-4 text-white">
            <label className="text-[10px] font-black text-slate-500 uppercase italic tracking-[0.2em] block leading-none">1. ELIGE BARBERO PROFESIONAL</label>
            {availableBarbers.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-slate-700 bg-black/40 p-6 text-center text-slate-400">
                <p className="text-[11px] font-black uppercase italic leading-none">No hay barberos activos en esta sucursal.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-white">
                {availableBarbers.map(b => (
                  <div key={b.id} onClick={() => setForm({...form, barberId: b.id})} className={`p-4 rounded-[1.8rem] border-2 cursor-pointer transition-all flex flex-col items-center text-center gap-3 justify-center relative ${form.barberId === b.id ? `${b.color} bg-indigo-600/10 shadow-lg scale-[1.02]` : 'border-slate-800 bg-black'}`}>
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black italic shadow-xl text-white ${b.bg}`}>{b.avatar}</div>
                    <p className="text-[10px] font-black uppercase italic text-white leading-tight">{b.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-4 text-white">
            <div className="space-y-4 text-white" ref={wrapperRef}>
              <label className="text-[10px] font-black text-slate-500 uppercase italic tracking-[0.2em] block leading-none">2. DATOS DEL CLIENTE</label>
              <div className="space-y-3 text-white relative">
                <input required className="w-full bg-black border border-slate-800 p-5 rounded-[1.2rem] text-sm font-black uppercase italic text-white outline-none focus:border-indigo-600 leading-none" placeholder="BUSCAR CLIENTE" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setSelectedClient(null); setShowResults(true); }} onFocus={() => setShowResults(true)} />
                {showResults && filteredClients.length > 0 && (
                  <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-slate-900 border border-slate-700 rounded-[1.5rem] shadow-2xl z-50 overflow-hidden text-white">
                    {filteredClients.map(c => (<div key={c.id} onClick={() => handleSelectClient(c)} className="flex items-center gap-4 p-4 hover:bg-indigo-600 cursor-pointer border-b border-slate-800 text-white"><span className="text-xs font-black uppercase italic text-white">{c.name}</span></div>))}
                  </div>
                )}
                {isNewClient && !selectedClient && (
                  <div className="mt-2 p-3 rounded-xl bg-orange-500 border border-orange-400 text-white font-black uppercase tracking-wider text-sm text-center shadow-[0_0_20px_rgba(255,159,67,0.65)] animate-pulse ring-2 ring-orange-300/60 leading-none">
                    <span className="drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]">!! Nuevo Cliente Detectado !!</span>
                  </div>
                )}
                {(selectedClient || isNewClient) && (
                  <input required type="tel" className="w-full bg-black border-2 border-indigo-600/40 p-5 rounded-[1.2rem] text-sm font-black text-white italic leading-none" placeholder="TELÉFONO 0000-0000" value={phoneVal} onChange={e => setPhoneVal(formatPhoneNumber(e.target.value))} />
                )}
              </div>
            </div>
            <div className="space-y-4 text-white" ref={serviceRef}>
              <label className="text-[10px] font-black text-slate-500 uppercase italic tracking-[0.2em] block leading-none">3. SERVICIO Y HORARIO</label>
              <div className="space-y-3 text-white">
                <div className="relative text-white">
                  <input className="w-full bg-black border border-slate-800 p-5 rounded-[1.2rem] text-sm font-black uppercase italic text-white outline-none focus:border-emerald-600 leading-none" placeholder="ELEGIR SERVICIO" value={serviceSearch} onChange={(e) => { setServiceSearch(e.target.value); setShowServiceList(true); }} onFocus={() => setShowServiceList(true)} />
                {showServiceList && (
                  <div className="absolute top-full mt-2 left-0 w-full bg-slate-900 border border-slate-700 rounded-[1.5rem] shadow-2xl z-50 overflow-hidden text-white">
                    <div className="max-h-52 overflow-y-auto inner-scrollbar p-2 text-white">
                      <div onClick={() => handleSelectService("POR DEFINIR")} className="p-3.5 hover:bg-emerald-600/20 rounded-[1rem] cursor-pointer text-emerald-400 text-[10px] font-black uppercase italic leading-none">--- DEFINIR EN CAJA ---</div>
                      {filteredServices.length === 0 ? (
                        <div className="p-3.5 text-slate-400 text-[10px] font-black uppercase italic leading-none">No se encontraron servicios.</div>
                      ) : filteredServices.map(s => (
                        <div key={s.id} onClick={() => handleSelectService(s)} className="flex items-center justify-between p-3.5 hover:bg-indigo-600 rounded-[1rem] cursor-pointer text-white text-white"><span className="text-xs font-black uppercase italic text-white">{s.name}</span><span className="text-[10px] font-black italic text-emerald-400">C$ {s.price}</span></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-white">
                <input type="date" className="w-full bg-black border border-slate-800 py-4.5 px-6 rounded-[1.2rem] text-[12px] font-black text-white outline-none italic" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                {form.type === 'walkin' ? (
                  <div className="w-full bg-indigo-600/10 border border-indigo-500/30 py-4 px-6 rounded-[1.2rem] flex items-center gap-2 text-white">
                    <Clock size={14} className="text-indigo-400" />
                    <span className="text-[11px] font-black text-indigo-400 uppercase italic leading-none">Cola (Auto)</span>
                  </div>
                ) : (
                  <input type="time" className="w-full bg-black border border-slate-800 py-4.5 px-6 rounded-[1.2rem] text-[12px] font-black text-white outline-none italic" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
                )}
              </div>
              </div>
            </div>
          </div>
          <div className="pt-10 border-t border-slate-900 flex justify-between items-center text-white">
            <div className="flex flex-col text-white"><span className="text-[10px] font-black text-slate-500 uppercase italic mb-2 leading-none">MONTO ESTIMADO</span><h4 className="text-5xl font-black italic text-white leading-none"><span className="text-emerald-500 mr-2 text-white">C$</span>{(Number(form.price) || 0).toLocaleString()}</h4></div>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-12 py-7 rounded-[1.8rem] font-black uppercase text-xs italic transition-all text-white leading-none">RESERVAR ESPACIO</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FinalizeModal({ onClose, onConfirm, services, clients, initial }) {
  const [billItems, setBillItems] = useState(() => {
    if (initial?.service && initial.service !== "POR DEFINIR") {
      const match = (services || []).find(s => s.name === initial.service);
      return match ? [{ ...match, uniqueId: makeId() }] : [];
    }
    return [];
  });
  
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [search, setSearch] = useState('');
  const [rating, setRating] = useState(5);
  const [selectedPromotionId, setSelectedPromotionId] = useState('');

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
  
  const catalog = useMemo(() => {
    return (services || []).filter(s => 
      !isPromotionService(s) &&
      (activeCategory === 'Todos' || s.category === activeCategory) &&
      (s.name.toLowerCase().includes(search.toLowerCase()))
    );
  }, [services, activeCategory, search]);

  const availablePromotions = useMemo(() => {
    const manualPromotions = getApplicablePromotions(services, billItems, 'Servicio');
    return loyaltyPromotion ? [loyaltyPromotion, ...manualPromotions] : manualPromotions;
  }, [services, billItems, loyaltyPromotion]);

  const selectedPromotion = useMemo(
    () => availablePromotions.find((promotion) => String(promotion.id) === String(selectedPromotionId)) || null,
    [availablePromotions, selectedPromotionId],
  );

  const addToBill = (item) => {
    setBillItems((current) => [...current, { ...item, uniqueId: makeId() }]);
  };

  const removeFromBill = (uniqueId) => {
    setBillItems((current) => current.filter(i => i.uniqueId !== uniqueId));
  };

  const subtotal = billItems.reduce((acc, i) => acc + Number(i.price || 0), 0);
  const promotionPreview = useMemo(
    () => calculatePromotionDiscount(selectedPromotion, billItems),
    [selectedPromotion, billItems],
  );
  const promotionDiscount = promotionPreview.amount;
  const total = Math.max(subtotal - promotionDiscount, 0);

  const confirmFinalCharge = () => {
    if (billItems.length === 0) return;
    const serviceNames = billItems.map(i => i.name).join(' + ');
    onConfirm({ 
      serviceName: selectedPromotion ? `${serviceNames} · Promo: ${selectedPromotion.name}` : serviceNames, 
      price: total, 
      rating: rating,
      promotionName: selectedPromotion?.name || '',
      discountAmount: promotionDiscount,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 animate-in fade-in text-white no-print">
      <div className="bg-slate-950 w-full max-w-6xl rounded-[3rem] shadow-2xl border border-slate-800 animate-in zoom-in h-[90vh] flex flex-col text-white overflow-hidden">
        <div className="p-8 border-b border-slate-900 flex justify-between items-center bg-black">
          <div>
            <h3 className="text-2xl font-black uppercase italic text-white leading-none">Pantalla de Cobro y Cierre</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-2 leading-none">Finaliza el servicio y procesa el pago</p>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-900 rounded-2xl text-slate-500 hover:text-rose-500 transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="w-full md:w-[400px] border-r border-slate-900 flex flex-col bg-black/40">
            <div className="p-6 border-b border-slate-900">
                <h4 className="text-[10px] font-black text-indigo-400 uppercase italic tracking-widest flex items-center gap-2">
                  <ShoppingBag size={14} /> Servicios Realizados
                </h4>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {billItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-800 border-2 border-dashed border-slate-900 rounded-[2rem] p-8 text-center">
                  <Package size={32} className="mb-4 opacity-20" />
                  <p className="text-[10px] font-black uppercase italic leading-none">Ningún servicio seleccionado para cobrar</p>
                </div>
              ) : (
                billItems.map(item => (
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

            <div className="p-8 bg-slate-950 border-t border-slate-900">
               <div className="flex justify-between items-end">
                 <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-none mb-2">Total a Cobrar</span>
                 <span className="text-4xl font-black text-emerald-400 italic tracking-tighter leading-none">C$ {total.toLocaleString()}</span>
               </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col bg-slate-950">
            <div className="p-6 border-b border-slate-900 flex flex-wrap items-center justify-between gap-4">
               <div className="flex gap-2 p-1 bg-black border border-slate-800 rounded-2xl overflow-x-auto no-scrollbar">
                 {['Todos', ...CATEGORIES.filter((category) => category !== 'Promocion')].map(cat => (
                   <button 
                    key={cat} 
                    onClick={() => setActiveCategory(cat)}
                    className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase italic tracking-widest transition-all ${activeCategory === cat ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                   >
                     {cat === 'Todos' ? cat : (CATEGORY_LABELS[cat] || cat)}
                   </button>
                 ))}
               </div>
               <div className="relative flex-1 max-w-xs">
                 <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                 <input 
                  type="text" 
                  placeholder="BUSCAR ITEM..." 
                  className="w-full bg-black border border-slate-800 rounded-xl pl-4 pr-10 py-3 text-[10px] font-black uppercase text-white outline-none focus:border-indigo-600 italic"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                 />
               </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 custom-scrollbar content-start">
              {catalog.map(item => (
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
                    <div className="p-2 bg-emerald-600/10 rounded-lg text-emerald-500 opacity-0 transition-opacity group-hover:opacity-100"><Plus size={14}/></div>
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-slate-900 p-6 space-y-4 bg-black/30">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Promoción opcional</p>
                  <p className="mt-2 text-[11px] font-bold text-slate-400">Aplica descuentos guardados en Servicios o el beneficio de fidelización cuando toque la visita {LOYALTY_REWARD_VISITS}.</p>
                </div>
                {selectedPromotion && (
                  <button
                    type="button"
                    onClick={() => setSelectedPromotionId('')}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-300"
                  >
                    Quitar
                  </button>
                )}
              </div>
              {availablePromotions.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {availablePromotions.map((promotion) => (
                    <button
                      key={promotion.id}
                      type="button"
                      onClick={() => setSelectedPromotionId(String(promotion.id))}
                      className={`rounded-[1.5rem] border px-5 py-4 text-left transition-all ${
                        selectedPromotion?.id === promotion.id
                          ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.18)]'
                          : 'border-slate-800 bg-slate-900 hover:border-emerald-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-black uppercase italic text-white">{promotion.name}</p>
                          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {promotion.isLoyaltyReward
                              ? `beneficio por fidelización · visita ${projectedVisitCount}`
                              : `${formatPromotionValue(promotion)} · descuento manual sobre el cobro`}
                          </p>
                        </div>
                        <span className="text-sm font-black italic text-emerald-300">
                          - C$ {calculatePromotionDiscount(promotion, billItems).amount.toLocaleString('es-NI')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-800 bg-slate-950/60 px-5 py-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  No hay promociones aplicables para este cobro.
                </div>
              )}
              {loyaltyPromotion && billingClient ? (
                <div className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 px-5 py-4 text-[11px] font-bold text-amber-100">
                  {billingClient.name} está completando su visita #{projectedVisitCount}. Puedes aplicar el beneficio opcional de corte gratis en este cobro.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="p-8 bg-black border-t border-slate-900 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="bg-slate-950/50 border border-slate-800 px-10 py-5 rounded-[2.5rem] flex flex-col items-center">
             <p className="text-[10px] font-black text-amber-500 uppercase italic tracking-[0.2em] mb-3 leading-none">Califica la experiencia</p>
             <div className="flex gap-4">
               {[1, 2, 3, 4, 5].map((star) => (
                 <button 
                    key={star} 
                    onClick={() => setRating(star)} 
                    className={`transition-all ${star <= rating ? 'text-amber-500 scale-125 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'text-slate-800 hover:text-slate-600'}`}
                 >
                   <Star size={32} fill={star <= rating ? "currentColor" : "none"} />
                 </button>
               ))}
             </div>
          </div>

          <div className="flex gap-4 w-full md:w-auto">
            <div className="mr-auto flex flex-col text-left">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Subtotal</span>
              <span className="mt-2 text-lg font-black italic text-white">C$ {subtotal.toLocaleString('es-NI')}</span>
              {selectedPromotion ? (
                <span className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
                  {selectedPromotion.name} · - C$ {promotionDiscount.toLocaleString('es-NI')}
                </span>
              ) : null}
            </div>
            <button onClick={onClose} className="px-10 py-6 text-[11px] font-black uppercase text-slate-600 hover:text-white italic transition-colors leading-none">Cerrar</button>
            <button 
              disabled={billItems.length === 0}
              onClick={confirmFinalCharge}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-16 py-6 rounded-[2rem] font-black uppercase italic text-xs tracking-widest disabled:opacity-20 shadow-xl shadow-emerald-950/20 active:scale-95 transition-all flex items-center gap-3"
            >
              <CheckCircle2 size={18} strokeWidth={3} /> CONFIRMAR Y FINALIZAR COBRO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceEditorModal({ services, onClose, onSave, initial }) {
  const [formData, setFormData] = useState({ 
    name: initial?.name || '',
    price: initial?.price || '',
    category: initial?.category || 'Cortes',
    items: initial?.items || [],
    appliesTo: initial?.appliesTo || 'Servicio',
    discountType: initial?.discountType || 'percentage',
    discountValue: initial?.discountValue !== undefined && initial?.discountValue !== null ? String(initial.discountValue) : '',
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
  
  const calculateComboPrice = (items) => {
    return (items || []).reduce((acc, itemId) => {
      const itemPrice = Number(services.find(s => s.id === itemId)?.price || 0);
      return acc + itemPrice;
    }, 0);
  };

  const toggleItem = (id) => { 
    const newItems = formData.items.includes(id) ? formData.items.filter(i => i !== id) : [...formData.items, id]; 
    const newPrice = formData.category === 'Combo' ? calculateComboPrice(newItems) : Number(formData.price || 0);
    setFormData({ ...formData, items: newItems, price: newPrice }); 
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in text-white no-print">
      <div className="bg-slate-950 w-full max-w-xl rounded-[3.5rem] shadow-2xl border border-slate-800 animate-in zoom-in-95 max-h-[95vh] flex flex-col text-white overflow-hidden">
        <div className="px-12 py-8 bg-gradient-to-br from-indigo-600/20 border-b border-slate-900 flex justify-between items-center text-white">
          <div className="flex items-center gap-6 text-white"><div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">{formData.category === 'Combo' ? <Zap size={28} /> : formData.category === 'Promocion' ? <Gift size={28} /> : <Scissors size={28} />}</div><div><h3 className="text-2xl font-black uppercase italic text-white leading-none">{initial?.id ? 'Editar' : 'Nuevo'} Registro</h3></div></div>
          <button onClick={onClose} className="p-3 bg-black rounded-xl text-slate-500 text-white"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { 
            e.preventDefault(); 
            const normalized = {
              ...formData,
              price: formData.category === 'Promocion' ? 0 : Number(formData.price) || 0,
              discountValue: Number(formData.discountValue) || 0,
              items: formData.category === 'Combo' ? formData.items : [],
              targetServiceIds: [],
            };
            onSave(normalized);
          }} className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1 text-white">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
            <div className="space-y-3 text-white">
              <label className="text-[10px] font-black text-slate-500 uppercase italic px-1 leading-none">Categoría</label>
              <select className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold uppercase italic text-white outline-none focus:border-indigo-600 appearance-none leading-none cursor-pointer" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value, items: e.target.value === 'Combo' ? formData.items : []})}>
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-slate-950 text-white">{CATEGORY_LABELS[c] || c}</option>)}
              </select>
            </div>
            <div className="space-y-3 text-white">
              <label className="text-[10px] font-black text-slate-500 uppercase italic px-1 leading-none">Nombre</label>
              <input required placeholder={isPromotion ? 'Ej. Corte gratis por fidelidad' : 'Ej. Combo Pro'} className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold uppercase italic text-white outline-none focus:border-indigo-600 italic leading-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
          </div>
          {isPromotion && (
            <div className="space-y-6 rounded-[2.5rem] border border-emerald-500/20 bg-emerald-500/5 p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-300 uppercase italic px-1 leading-none">Aplica a</label>
                  <select
                    className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold uppercase italic text-white outline-none focus:border-emerald-500 appearance-none leading-none cursor-pointer"
                    value={formData.appliesTo}
                    onChange={(event) => setFormData({ ...formData, appliesTo: event.target.value, targetServiceIds: [] })}
                  >
                    {['Servicio', 'Producto'].map((option) => (
                      <option key={option} value={option} className="bg-slate-950 text-white">{option}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-emerald-300 uppercase italic px-1 leading-none">Tipo de descuento</label>
                  <select
                    className="w-full bg-black border border-slate-800 rounded-2xl px-6 py-4 text-sm font-bold uppercase italic text-white outline-none focus:border-emerald-500 appearance-none leading-none cursor-pointer"
                    value={formData.discountType}
                    onChange={(event) => setFormData({ ...formData, discountType: event.target.value })}
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
                    setFormData({ ...formData, discountValue: rawValue });
                  }}
                />
              </div>
              <div className="space-y-5">
                <label className="text-[10px] font-black text-emerald-300 uppercase italic px-1 leading-none">Aplicación</label>
                <div className="rounded-[1.8rem] border border-slate-800 bg-black px-5 py-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                    Esta promoción no se amarra a un item específico.
                  </p>
                  <p className="mt-3 text-[11px] font-black uppercase italic text-white">
                    Se selecciona manualmente cuando vayas a facturar {formData.appliesTo === 'Producto' ? 'productos' : 'servicios'}.
                  </p>
                </div>
              </div>
            </div>
          )}
          {formData.category === 'Combo' && (
            <div className="space-y-5 bg-indigo-600/5 p-8 rounded-[2.5rem] border border-indigo-500/20 text-white">
              <label className="text-[10px] font-black text-indigo-400 uppercase italic px-1 leading-none">Componer Combo</label>
              <div className="flex flex-col gap-4 text-white">
                <input type="text" placeholder="BUSCAR ÍTEMS" className="w-full bg-black border border-slate-800 rounded-2xl px-8 py-4 text-sm font-black uppercase italic text-white leading-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <div className="space-y-3 max-h-60 overflow-y-auto pr-3 custom-scrollbar text-white">
                  {availableItems.map(item => (
                    <div key={item.id} onClick={() => toggleItem(item.id)} className={`flex items-center justify-between p-4 rounded-[1.8rem] cursor-pointer border ${formData.items.includes(item.id) ? 'bg-indigo-600/20 border-indigo-500' : 'bg-black border-slate-800'} text-white`}>
                      <span className="text-[11px] font-black uppercase italic text-white leading-none">{item.name}</span>
                      <span className="text-[11px] font-black text-emerald-400 italic leading-none">C$ {item.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!isPromotion && (
          <div className="space-y-3 text-white">
            <label className="text-[10px] font-black text-slate-500 uppercase italic px-1 leading-none">Precio Final (C$)</label>
            <div className="relative text-white">
              <input required type="number" className="w-full bg-black border border-slate-800 rounded-[2.5rem] pl-20 pr-8 py-8 text-5xl font-black italic text-white outline-none focus:border-emerald-500 leading-none" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value ? Number(e.target.value) : 0})} />
              <span className="absolute left-8 top-1/2 -translate-y-1/2 text-3xl font-black text-emerald-500 italic text-white leading-none">C$</span>
            </div>
          </div>
          )}
          {isPromotion && (
            <div className="rounded-[2.5rem] border border-emerald-500/20 bg-black/40 px-8 py-6">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Resumen de promoción</p>
              <p className="mt-3 text-lg font-black uppercase italic text-white">
                {formData.name || 'Promoción sin nombre'}
              </p>
              <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
                {formData.discountType === 'fixed'
                  ? `Descuento fijo de C$ ${Number(formData.discountValue || 0).toLocaleString('es-NI')}`
                  : `${Number(formData.discountValue || 0)}% de descuento`}
              </p>
            </div>
          )}
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-7 rounded-[2.5rem] font-black uppercase italic text-xs transition-all text-white leading-none">GUARDAR CATÁLOGO</button>
        </form>
      </div>
    </div>
  );
}

