import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowLeft,
  ArrowRight,
  Bath,
  Bone,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  Dog,
  Edit3,
  FileText,
  Flower2,
  History,
  Heart,
  Leaf,
  LockKeyhole,
  Menu,
  PawPrint,
  Plus,
  ReceiptText,
  RotateCcw,
  Scissors,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import {
  Link,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

type ServiceIconName = 'bath' | 'cut' | 'dog' | 'transport' | 'sparkle';
type Service = {
  id: string;
  name: string;
  category: string;
  price: number;
  icon: ServiceIconName;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
type Sale = {
  id: string;
  kind: 'sale';
  serviceId: string;
  serviceName: string;
  unitPrice: number;
  quantity: number;
  total: number;
  occurredAt: string;
  status: 'VENTA' | 'ANULADA';
  annulledAt?: string;
};
type Withdrawal = {
  id: string;
  kind: 'withdrawal';
  reason: string;
  amount: number;
  occurredAt: string;
};
type Operation = Sale | Withdrawal;
type CashClosure = {
  id: string;
  openedAt: string;
  closedAt: string;
  salesTotal: number;
  withdrawalsTotal: number;
  netTotal: number;
  salesCount: number;
  withdrawalsCount: number;
};
type Store = {
  services: Service[];
  operations: Operation[];
  closures: CashClosure[];
  activeOpenedAt: string;
};

const queryClient = new QueryClient();
const STORAGE_KEY = 'caja-bruno-state-v2';

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function seedServices(): Service[] {
  const now = new Date().toISOString();
  return [
    { id: 'bath', name: 'Baños', category: 'Servicio', price: 12000, icon: 'bath', active: true, createdAt: now, updatedAt: now },
    { id: 'cut', name: 'Cortes', category: 'Servicio', price: 15000, icon: 'cut', active: true, createdAt: now, updatedAt: now },
    { id: 'transport', name: 'Transporte', category: 'Servicio', price: 8000, icon: 'transport', active: true, createdAt: now, updatedAt: now },
  ];
}

function readStore(): Store {
  const fallback: Store = { services: seedServices(), operations: [], closures: [], activeOpenedAt: new Date().toISOString() };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      services: Array.isArray(parsed.services) && parsed.services.length ? parsed.services : fallback.services,
      operations: Array.isArray(parsed.operations) ? parsed.operations : [],
      closures: Array.isArray(parsed.closures) ? parsed.closures : [],
      activeOpenedAt: typeof parsed.activeOpenedAt === 'string' ? parsed.activeOpenedAt : fallback.activeOpenedAt,
    };
  } catch {
    return fallback;
  }
}

const moneyFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function formatMoney(value: number) {
  return moneyFormatter.format(value).replace(/\s/g, '');
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} • ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function iconForService(icon: ServiceIconName, size = 32) {
  const props = { size, strokeWidth: 2.4 };
  if (icon === 'bath') return <Bath {...props} />;
  if (icon === 'cut') return <Scissors {...props} />;
  if (icon === 'transport') return <Truck {...props} />;
  if (icon === 'sparkle') return <Sparkles {...props} />;
  return <Dog {...props} />;
}

function WorldDecor({ variant = 'home' }: { variant?: 'home' | 'page' }) {
  return (
    <div className={`world-decor world-${variant}`} aria-hidden="true">
      <span className="world-vine vine-left"><Flower2 size={23} strokeWidth={2.2} /></span>
      <span className="world-collectible collectible-star"><Star size={18} fill="currentColor" strokeWidth={2.5} /></span>
      <span className="world-collectible collectible-heart"><Heart size={17} fill="currentColor" strokeWidth={2.5} /></span>
      <span className="world-collectible collectible-bone"><Bone size={19} fill="currentColor" strokeWidth={2.2} /></span>
      <span className="world-vine vine-right"><Leaf size={22} strokeWidth={2.2} /></span>
    </div>
  );
}

function operationIsCurrent(operation: Operation, openedAt: string) {
  return operation.occurredAt >= openedAt;
}

function cashTotals(operations: Operation[], openedAt: string) {
  const current = operations.filter((operation) => operationIsCurrent(operation, openedAt));
  const activeSales = current.filter((operation): operation is Sale => operation.kind === 'sale' && operation.status === 'VENTA');
  const withdrawals = current.filter((operation): operation is Withdrawal => operation.kind === 'withdrawal');
  const salesTotal = activeSales.reduce((sum, sale) => sum + sale.total, 0);
  const withdrawalsTotal = withdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
  return {
    current,
    activeSales,
    withdrawals,
    salesTotal,
    withdrawalsTotal,
    netTotal: salesTotal - withdrawalsTotal,
  };
}

function App() {
  const [store, setStore] = useState<Store>(readStore);
  const [now, setNow] = useState(new Date());
  const [sheet, setSheet] = useState<'menu' | 'sale' | 'withdrawal' | 'close' | 'service' | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const totals = useMemo(() => cashTotals(store.operations, store.activeOpenedAt), [store.operations, store.activeOpenedAt]);
  const activeServices = store.services.filter((service) => service.active);

  const addSale = (service: Service, quantity: number) => {
    const occurredAt = new Date().toISOString();
    const sale: Sale = {
      id: makeId('sale'),
      kind: 'sale',
      serviceId: service.id,
      serviceName: service.name,
      unitPrice: service.price,
      quantity,
      total: service.price * quantity,
      occurredAt,
      status: 'VENTA',
    };
    setStore((current) => ({ ...current, operations: [sale, ...current.operations] }));
    setSheet(null);
    setSelectedService(null);
    setNotice(`${service.name} registrado en la caja`);
  };

  const addWithdrawal = (reason: string, amount: number) => {
    const withdrawal: Withdrawal = { id: makeId('withdrawal'), kind: 'withdrawal', reason, amount, occurredAt: new Date().toISOString() };
    setStore((current) => ({ ...current, operations: [withdrawal, ...current.operations] }));
    setSheet(null);
    setNotice('Salida registrada correctamente');
  };

  const annulSale = (saleId: string) => {
    const sale = store.operations.find((operation): operation is Sale => operation.kind === 'sale' && operation.id === saleId);
    if (!sale || sale.status === 'ANULADA') return;
    if (!window.confirm('¿Querés anular esta venta?')) return;
    const annulledAt = new Date().toISOString();
    setStore((current) => ({
      ...current,
      operations: current.operations.map((operation) =>
        operation.kind === 'sale' && operation.id === saleId ? { ...operation, status: 'ANULADA', annulledAt } : operation,
      ),
    }));
    setNotice('Venta anulada y caja actualizada');
  };

  const saveService = (draft: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>, serviceId?: string) => {
    const updatedAt = new Date().toISOString();
    setStore((current) => {
      if (serviceId) {
        return {
          ...current,
          services: current.services.map((service) => service.id === serviceId ? { ...service, ...draft, updatedAt } : service),
        };
      }
      const created: Service = { ...draft, id: makeId('service'), createdAt: updatedAt, updatedAt };
      return { ...current, services: [...current.services, created] };
    });
    setSheet(null);
    setEditingService(null);
    setNotice(serviceId ? 'Servicio actualizado' : 'Servicio agregado al catálogo');
  };

  const toggleService = (serviceId: string) => {
    setStore((current) => ({
      ...current,
      services: current.services.map((service) => service.id === serviceId ? { ...service, active: !service.active, updatedAt: new Date().toISOString() } : service),
    }));
    setNotice('Estado del servicio actualizado');
  };

  const deleteService = (serviceId: string) => {
    const service = store.services.find((item) => item.id === serviceId);
    if (!service || !window.confirm(`¿Eliminar ${service.name}? Esta acción no se puede deshacer.`)) return;
    setStore((current) => ({ ...current, services: current.services.filter((item) => item.id !== serviceId) }));
    setNotice('Servicio eliminado');
  };

  const closeCash = () => {
    const closedAt = new Date().toISOString();
    const closure: CashClosure = {
      id: makeId('closure'),
      openedAt: store.activeOpenedAt,
      closedAt,
      salesTotal: totals.salesTotal,
      withdrawalsTotal: totals.withdrawalsTotal,
      netTotal: totals.netTotal,
      salesCount: totals.activeSales.length,
      withdrawalsCount: totals.withdrawals.length,
    };
    setStore((current) => ({ ...current, closures: [closure, ...current.closures], activeOpenedAt: closedAt }));
    setSheet(null);
    setNotice('Caja cerrada. Comenzó un nuevo período.');
  };

  const clearData = () => {
    if (!window.confirm('¿Borrar todos los datos locales, servicios y movimientos?')) return;
    const fresh = { services: seedServices(), operations: [], closures: [], activeOpenedAt: new Date().toISOString() };
    setStore(fresh);
    setSheet(null);
    setNotice('Datos reiniciados');
  };

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Switch>
            <Route path="/">
              <HomePage now={now} totals={totals} services={activeServices} onService={(service) => { setSelectedService(service); setSheet('sale'); }} onWithdrawal={() => setSheet('withdrawal')} onClose={() => setSheet('close')} onMenu={() => setSheet('menu')} />
            </Route>
            <Route path="/registro">
              <HistoryPage operations={store.operations} onMenu={() => setSheet('menu')} onAnnul={annulSale} />
            </Route>
            <Route path="/configuracion">
              <SettingsPage services={store.services} onMenu={() => setSheet('menu')} onAdd={() => { setEditingService(null); setSheet('service'); }} onEdit={(service) => { setEditingService(service); setSheet('service'); }} onToggle={toggleService} onDelete={deleteService} />
            </Route>
            <Route>
              <NotFound />
            </Route>
          </Switch>
          {sheet === 'menu' && <MenuSheet onClose={() => setSheet(null)} onClear={clearData} onCloseCash={() => setSheet('close')} closures={store.closures} />}
          {sheet === 'sale' && selectedService && <SaleSheet service={selectedService} onClose={() => { setSheet(null); setSelectedService(null); }} onConfirm={addSale} />}
          {sheet === 'withdrawal' && <WithdrawalSheet onClose={() => setSheet(null)} onConfirm={addWithdrawal} />}
          {sheet === 'close' && <CloseSheet totals={totals} onClose={() => setSheet(null)} onConfirm={closeCash} />}
          {sheet === 'service' && <ServiceSheet service={editingService} onClose={() => { setSheet(null); setEditingService(null); }} onConfirm={saveService} />}
          {notice && <div className="toast-message" role="status"><Check size={17} strokeWidth={3} />{notice}</div>}
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

function AppHeader({ now, onMenu, back }: { now?: Date; onMenu: () => void; back?: string }) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        {back ? <Link href="/" className="round-icon inline-icon" aria-label="Volver al inicio"><ArrowLeft size={21} /></Link> : <div className="brand-mark" aria-hidden="true"><PawPrint size={26} strokeWidth={2.5} /></div>}
        <div>
          <div className="brand-name">Bruno</div>
          <div className="brand-sub">Peluquería Canina</div>
          {now && <div className="date-strip">{formatDateTime(now)}</div>}
        </div>
      </div>
      <button className="round-icon" onClick={onMenu} aria-label="Abrir menú"><Menu size={23} strokeWidth={2.5} /></button>
    </header>
  );
}

function HomePage({ now, totals, services, onService, onWithdrawal, onClose, onMenu }: { now: Date; totals: ReturnType<typeof cashTotals>; services: Service[]; onService: (service: Service) => void; onWithdrawal: () => void; onClose: () => void; onMenu: () => void }) {
  return (
    <main className="app-shell">
      <WorldDecor />
      <div className="screen-pad">
        <AppHeader now={now} onMenu={onMenu} />
        <section className="hero-card">
          <div className="hero-sticker"><Star size={13} fill="currentColor" /><span>día feliz</span></div>
          <div className="hero-copy">
            <div className="hero-kicker">Caja del día</div>
            <div className="hero-total">{formatMoney(totals.netTotal)}</div>
            <div className="hero-kicker hero-date">{formatDateTime(now)}</div>
          </div>
          <div className="hero-meta">
            <div className="hero-meta-row"><span>Ventas</span><strong>{formatMoney(totals.salesTotal)}</strong></div>
            <div className="hero-meta-row"><span>Salidas</span><strong>-{formatMoney(totals.withdrawalsTotal)}</strong></div>
          </div>
          <img className="hero-mascot" src={`${import.meta.env.BASE_URL}bruno-mascot.png`} alt="Bruno en su bañera" />
          <PawPrint className="hero-doodle" size={35} strokeWidth={2.5} aria-hidden="true" />
        </section>
        <section aria-labelledby="catalog-title">
          <div className="section-heading">
            <div>
              <div className="heading-row"><PawPrint className="heading-paw" size={19} fill="currentColor" aria-hidden="true" /><span className="micro-label" style={{ color: '#e66986' }}>Catálogo activo</span></div>
              <h1 id="catalog-title">¿Qué vendiste?</h1>
            </div>
            <span className="count-pill">{services.length} opciones</span>
          </div>
          <div className="catalog">
            {services.map((service) => <ServiceCard service={service} key={service.id} onSelect={onService} />)}
            {!services.length && <div className="empty-card">No hay servicios activos. Podés habilitarlos desde Configuración.</div>}
          </div>
          <button className="expense-entry expense-last" onClick={onWithdrawal}>
            <span className="expense-icon"><ReceiptText size={25} strokeWidth={2.3} /></span>
            <span className="expense-copy"><strong>Salida de caja</strong><span>Registrar un gasto, retiro o devolución</span></span>
            <ArrowRight className="expense-arrow" size={25} strokeWidth={2.7} />
          </button>
        </section>
        <div className="hint-bar"><CalendarDays size={17} strokeWidth={2.5} /><span>Todo queda guardado automáticamente · Tocá + para vender</span></div>
        <button className="close-register" onClick={onClose}><LockKeyhole size={17} /> CERRAR CAJA</button>
        <div className="bottom-doodles" aria-hidden="true"><PawPrint size={19} /><span>•</span><Dog size={22} /><span>•</span><PawPrint size={19} /></div>
      </div>
    </main>
  );
}

function ServiceCard({ service, onSelect }: { service: Service; onSelect: (service: Service) => void }) {
  const style = service.icon === 'bath' ? 'bath' : service.icon === 'cut' ? 'cut' : service.icon === 'transport' ? 'transport' : 'custom';
  return (
    <article className={`service-card ${style}`}>
      <div className="service-art">{iconForService(service.icon)}</div>
      <div className="service-info"><div className="service-name">{service.name}</div><div className="service-type">{service.category}</div></div>
      <div className="service-price">{formatMoney(service.price)}</div>
      <button className="service-add" onClick={() => onSelect(service)} aria-label={`Agregar ${service.name}`}><Plus size={25} strokeWidth={3} /></button>
    </article>
  );
}

function PageFrame({ title, subtitle, now, onMenu, children }: { title: string; subtitle: string; now?: Date; onMenu: () => void; children: ReactNode }) {
  return <main className="app-shell"><WorldDecor variant="page" /><div className="screen-pad"><AppHeader now={now} onMenu={onMenu} back="/" /><div className="page-heading"><div className="heading-row"><PawPrint className="heading-paw" size={18} fill="currentColor" /><span className="micro-label" style={{ color: '#e66986' }}>{title}</span></div><h1>{subtitle}</h1></div>{children}</div></main>;
}

function HistoryPage({ operations, onMenu, onAnnul }: { operations: Operation[]; onMenu: () => void; onAnnul: (id: string) => void }) {
  const [filter, setFilter] = useState<'all' | 'sale' | 'withdrawal'>('all');
  const filtered = operations.filter((operation) => filter === 'all' || operation.kind === filter);
  return (
    <PageFrame title="Registro" subtitle="Movimientos de caja" onMenu={onMenu}>
      <div className="filter-row">
        <button className={filter === 'all' ? 'filter-chip active' : 'filter-chip'} onClick={() => setFilter('all')}>Todo</button>
        <button className={filter === 'sale' ? 'filter-chip active' : 'filter-chip'} onClick={() => setFilter('sale')}>Ventas</button>
        <button className={filter === 'withdrawal' ? 'filter-chip active' : 'filter-chip'} onClick={() => setFilter('withdrawal')}>Salidas</button>
      </div>
      <div className="history-list">
        {filtered.map((operation) => <OperationRow key={operation.id} operation={operation} onAnnul={onAnnul} />)}
        {!filtered.length && <div className="empty-card"><History size={25} /><strong>Todavía no hay movimientos</strong><span>Las ventas y salidas que registres aparecerán acá.</span></div>}
      </div>
    </PageFrame>
  );
}

function OperationRow({ operation, onAnnul }: { operation: Operation; onAnnul: (id: string) => void }) {
  if (operation.kind === 'withdrawal') {
    return <article className="history-row withdrawal-row"><div className="history-icon withdrawal-icon"><ReceiptText size={20} /></div><div className="history-main"><strong>SALIDA DE CAJA</strong><span>{operation.reason}</span><small>{formatDate(operation.occurredAt)} · {formatTime(operation.occurredAt)}</small></div><div className="history-amount negative">-{formatMoney(operation.amount)}</div></article>;
  }
  const annulled = operation.status === 'ANULADA';
  return <article className={`history-row ${annulled ? 'annulled-row' : ''}`}><div className="history-icon"><ReceiptText size={20} /></div><div className="history-main"><strong>{operation.status}</strong><span>{operation.serviceName} · {operation.quantity} {operation.quantity === 1 ? 'unidad' : 'unidades'}</span><small>{formatDate(operation.occurredAt)} · {formatTime(operation.occurredAt)}{annulled && operation.annulledAt ? ` · Anulada ${formatTime(operation.annulledAt)}` : ''}</small></div><div className="history-side"><div className={annulled ? 'history-amount struck' : 'history-amount'}>{formatMoney(operation.total)}</div>{!annulled && <button className="annul-button" onClick={() => onAnnul(operation.id)}>ANULAR VENTA</button>}</div></article>;
}

function SettingsPage({ services, onMenu, onAdd, onEdit, onToggle, onDelete }: { services: Service[]; onMenu: () => void; onAdd: () => void; onEdit: (service: Service) => void; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <PageFrame title="Configuración" subtitle="Servicios del catálogo" onMenu={onMenu}>
      <button className="action-button teal settings-add" onClick={onAdd}><Plus size={19} strokeWidth={3} /> AGREGAR SERVICIO</button>
      <p className="settings-note">Los servicios activos aparecen en la pantalla de ventas. Podés cambiar precios cuando quieras.</p>
      <div className="settings-list">
        {services.map((service) => <article className={`settings-row ${service.active ? '' : 'inactive-row'}`} key={service.id}><div className="settings-service-icon">{iconForService(service.icon, 25)}</div><div className="settings-service-info"><strong>{service.name}</strong><span>{service.category} · {formatMoney(service.price)}</span><small>{service.active ? 'Activo en catálogo' : 'Inactivo'}</small></div><div className="settings-actions"><button onClick={() => onEdit(service)} aria-label={`Editar ${service.name}`}><Edit3 size={17} /></button><button onClick={() => onToggle(service.id)} aria-label={service.active ? `Desactivar ${service.name}` : `Activar ${service.name}`}><RotateCcw size={17} /></button><button className="delete-action" onClick={() => onDelete(service.id)} aria-label={`Eliminar ${service.name}`}><Trash2 size={17} /></button></div></article>)}
      </div>
    </PageFrame>
  );
}

function SheetFrame({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) {
  return <><button className="scrim" onClick={onClose} aria-label="Cerrar ventana" /><section className="sheet" role="dialog" aria-modal="true" aria-label={title}><div className="sheet-handle" /><div className="sheet-head"><div><h2 className="sheet-title">{title}</h2><p className="sheet-subtitle">{subtitle}</p></div><button className="sheet-close" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>{children}</section></>;
}

function SaleSheet({ service, onClose, onConfirm }: { service: Service; onClose: () => void; onConfirm: (service: Service, quantity: number) => void }) {
  const [quantity, setQuantity] = useState('1');
  const parsed = Math.max(1, Math.min(99, Number(quantity) || 1));
  return <SheetFrame title={`Registrar ${service.name.toLowerCase()}`} subtitle="Confirmá los datos de la venta" onClose={onClose}><div className={`service-card ${service.icon === 'bath' ? 'bath' : service.icon === 'cut' ? 'cut' : 'transport'}`} style={{ marginTop: 18 }}><div className="service-art">{iconForService(service.icon, 28)}</div><div className="service-info"><div className="service-name">{service.name}</div><div className="service-type">{service.category}</div></div><div className="service-price">{formatMoney(service.price)}</div></div><div className="sale-detail-grid"><div><label className="field-label" htmlFor="sale-quantity">Cantidad</label><input className="text-input" id="sale-quantity" type="number" inputMode="numeric" min="1" max="99" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></div><div><span className="field-label">Total</span><div className="total-preview">{formatMoney(service.price * parsed)}</div></div></div><div className="operation-time"><CalendarDays size={17} /> {formatDateTime(new Date())}</div><button className="action-button" onClick={() => onConfirm(service, parsed)}><Check size={19} strokeWidth={3} /> CONFIRMAR VENTA</button></SheetFrame>;
}

function WithdrawalSheet({ onClose, onConfirm }: { onClose: () => void; onConfirm: (reason: string, amount: number) => void }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const parsedAmount = Number(amount.replace(/\D/g, ''));
  return <SheetFrame title="Salida de caja" subtitle="Registrá un gasto, retiro o devolución" onClose={onClose}><label className="field-label" htmlFor="withdrawal-reason">Motivo</label><input className="text-input" id="withdrawal-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ej. Compra de productos" /><div className="reason-chips">{['Compra de productos', 'Retiro de dinero', 'Gasto', 'Devolución', 'Otro'].map((item) => <button key={item} onClick={() => setReason(item)}>{item}</button>)}</div><label className="field-label" htmlFor="withdrawal-amount">Importe</label><div className="money-input"><CircleDollarSign size={21} /><input id="withdrawal-amount" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} placeholder="0" /></div><div className="operation-time"><CalendarDays size={17} /> {formatDateTime(new Date())}</div><button className="action-button teal" disabled={parsedAmount <= 0 || !reason.trim()} onClick={() => onConfirm(reason.trim(), parsedAmount)}><ReceiptText size={18} /> REGISTRAR SALIDA</button></SheetFrame>;
}

function CloseSheet({ totals, onClose, onConfirm }: { totals: ReturnType<typeof cashTotals>; onClose: () => void; onConfirm: () => void }) {
  return <SheetFrame title="Cerrar caja" subtitle="Revisá el resumen antes de finalizar" onClose={onClose}><div className="summary-list"><div className="summary-row"><span>Total de ventas</span><strong>{formatMoney(totals.salesTotal)}</strong></div><div className="summary-row"><span>Total de salidas</span><strong>-{formatMoney(totals.withdrawalsTotal)}</strong></div><div className="summary-row"><span>Total neto</span><strong>{formatMoney(totals.netTotal)}</strong></div><div className="summary-row"><span>Operaciones</span><strong>{totals.activeSales.length} ventas · {totals.withdrawals.length} salidas</strong></div><div className="summary-row"><span>Fecha del cierre</span><strong>{formatDate(new Date())}</strong></div></div><button className="action-button" onClick={onConfirm}><LockKeyhole size={18} /> CONFIRMAR CIERRE</button></SheetFrame>;
}

function ServiceSheet({ service, onClose, onConfirm }: { service: Service | null; onClose: () => void; onConfirm: (draft: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>, id?: string) => void }) {
  const [name, setName] = useState(service?.name ?? '');
  const [category, setCategory] = useState(service?.category ?? 'Servicio');
  const [price, setPrice] = useState(service ? String(service.price) : '');
  const [icon, setIcon] = useState<ServiceIconName>(service?.icon ?? 'dog');
  const [active, setActive] = useState(service?.active ?? true);
  const parsedPrice = Number(price.replace(/\D/g, ''));
  return <SheetFrame title={service ? 'Editar servicio' : 'Agregar servicio'} subtitle="Completá la información del catálogo" onClose={onClose}><label className="field-label" htmlFor="service-name">Nombre del servicio</label><input className="text-input" id="service-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Corte de uñas" /><label className="field-label" htmlFor="service-category">Tipo / categoría</label><input className="text-input" id="service-category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Servicio" /><label className="field-label" htmlFor="service-price">Precio</label><div className="money-input"><CircleDollarSign size={21} /><input id="service-price" inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value.replace(/\D/g, ''))} placeholder="0" /></div><label className="field-label" htmlFor="service-icon">Icono</label><select className="text-input select-input" id="service-icon" value={icon} onChange={(event) => setIcon(event.target.value as ServiceIconName)}><option value="bath">Baño</option><option value="cut">Tijera</option><option value="dog">Mascota</option><option value="transport">Transporte</option><option value="sparkle">Brillos</option></select><label className="toggle-field"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span className="toggle-visual" /><span>Servicio activo en el catálogo</span></label><button className="action-button" disabled={!name.trim() || parsedPrice <= 0} onClick={() => onConfirm({ name: name.trim(), category: category.trim() || 'Servicio', price: parsedPrice, icon, active }, service?.id)}><Check size={19} strokeWidth={3} /> {service ? 'GUARDAR CAMBIOS' : 'AGREGAR SERVICIO'}</button></SheetFrame>;
}

function MenuSheet({ onClose, onClear, onCloseCash, closures }: { onClose: () => void; onClear: () => void; onCloseCash: () => void; closures: CashClosure[] }) {
  return <SheetFrame title="Menú Bruno" subtitle="Todo queda guardado en este dispositivo" onClose={onClose}><nav className="menu-links"><Link href="/" onClick={onClose}><PawPrint size={19} /> Inicio <ChevronRight size={18} /></Link><Link href="/" onClick={onClose}><ReceiptText size={19} /> Registrar venta <ChevronRight size={18} /></Link><Link href="/registro" onClick={onClose}><History size={19} /> Registro <ChevronRight size={18} /></Link><Link href="/configuracion" onClick={onClose}><Settings size={19} /> Configuración <ChevronRight size={18} /></Link><button className="menu-link-button" onClick={onCloseCash}><LockKeyhole size={19} /> Cerrar caja <ChevronRight size={18} /></button></nav><div className="menu-stat"><FileText size={17} /><span>Cierres guardados</span><strong>{closures.length}</strong></div><button className="close-register danger-outline" onClick={onClear}><Trash2 size={17} /> BORRAR DATOS LOCALES</button></SheetFrame>;
}

function NotFound() {
  return <main className="app-shell"><div className="screen-pad"><div className="closed-stamp"><FileText size={28} style={{ margin: '0 auto 7px' }} />Esta página no existe.<br /><Link href="/">Volver al inicio</Link></div></div></main>;
}

function RootApp() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}

export default function AppWithProviders() {
  return <RootApp />;
}