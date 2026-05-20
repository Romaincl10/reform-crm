import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { api, OFFER_TYPES, type Engagement, type InvoiceStatus, type OrgDetail } from '../api/client';
import { Badge, Button, Card, Field, formatDate, formatMoney, Input, Modal, Select, Textarea, PageHeader } from '../components/ui';

const INV_LABEL: Record<InvoiceStatus, string> = {
  to_invoice: 'À facturer',
  invoiced: 'Facturé',
  partially_paid: 'Paiement partiel',
  paid: 'Payé',
};

const INV_TONE: Record<InvoiceStatus, 'amber' | 'blue' | 'violet' | 'green'> = {
  to_invoice: 'amber',
  invoiced: 'blue',
  partially_paid: 'violet',
  paid: 'green',
};

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [newEngOpen, setNewEngOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const orgData = await api.get<OrgDetail>(`/organizations/${id}`);
    setOrg(orgData);
    setEngagements(orgData.engagements);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!org) return <div className="p-8 text-reform-gray">Chargement…</div>;

  const totalCA = engagements.reduce((s, e) => s + e.totalAmount, 0);
  const paid = engagements.reduce((s, e) => s + e.paidAmount, 0);
  const toInvoice = engagements.filter(e => e.invoiceStatus === 'to_invoice').reduce((s, e) => s + e.totalAmount, 0);
  const invoicedUnpaid = engagements
    .filter(e => e.invoiceStatus === 'invoiced' || e.invoiceStatus === 'partially_paid')
    .reduce((s, e) => s + (e.totalAmount - e.paidAmount), 0);

  return (
    <div className="p-8 max-w-6xl">
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-reform-gray hover:text-reform-violet mb-6">
        <ArrowLeft size={14} /> Tous les clients
      </Link>

      <PageHeader
        title={org.name}
        subtitle={[org.industry, org.city, org.siren ? `SIREN ${org.siren}` : null].filter(Boolean).join(' · ') || 'Client REFORM'}
        actions={
          <>
            <Link to={`/crm/${org.id}`}>
              <Button variant="ghost">Fiche commerciale</Button>
            </Link>
            <Button onClick={() => setNewEngOpen(true)}>
              <Plus size={16} /> Nouvelle prestation
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Stat label="CA contractualisé" value={formatMoney(totalCA)} tone="violet" />
        <Stat label="Encaissé" value={formatMoney(paid)} tone="green" />
        <Stat label="Facturé non payé" value={formatMoney(invoicedUnpaid)} tone="blue" />
        <Stat label="Reste à facturer" value={formatMoney(toInvoice)} tone="amber" />
      </div>

      <div className="space-y-4">
        {engagements.length === 0 ? (
          <Card className="p-12 text-center">
            <h3 className="font-display text-xl mb-2">Aucune prestation</h3>
            <p className="text-reform-gray text-sm mb-4">Crée la première prestation pour ce client.</p>
            <Button onClick={() => setNewEngOpen(true)}><Plus size={16} /> Nouvelle prestation</Button>
          </Card>
        ) : (
          engagements.map(eng => <EngagementRow key={eng.id} eng={eng} onChanged={load} />)
        )}
      </div>

      <NewEngagementModal open={newEngOpen} onClose={() => setNewEngOpen(false)} orgId={org.id} onCreated={load} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'violet' | 'green' | 'blue' | 'amber' }) {
  const cls = {
    violet: 'bg-reform-violet-light text-reform-violet',
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    amber: 'bg-amber-50 text-amber-700',
  }[tone];
  return (
    <Card className="p-5">
      <div className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</div>
      <div className="font-display text-2xl mt-3">{value}</div>
    </Card>
  );
}

function EngagementRow({ eng, onChanged }: { eng: Engagement; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [invoicing, setInvoicing] = useState(false);
  const progress = eng.totalAmount > 0 ? Math.min(100, (eng.paidAmount / eng.totalAmount) * 100) : 0;

  async function updateStatus(invoiceStatus: InvoiceStatus) {
    // Si on bascule sur "Facturé", on ouvre le modal de saisie au lieu de patcher direct
    if (invoiceStatus === 'invoiced' && eng.invoiceStatus !== 'invoiced') {
      setInvoicing(true);
      return;
    }
    const patch: any = { invoiceStatus };
    if (invoiceStatus === 'paid') patch.paidAmount = eng.totalAmount;
    if (invoiceStatus === 'to_invoice') patch.paidAmount = 0;
    await api.patch(`/engagements/${eng.id}`, patch);
    onChanged();
  }

  async function remove() {
    if (!confirm(`Supprimer la prestation "${eng.title}" ?`)) return;
    await api.delete(`/engagements/${eng.id}`);
    onChanged();
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-display text-lg">{eng.title}</h3>
            <Badge tone={INV_TONE[eng.invoiceStatus]}>{INV_LABEL[eng.invoiceStatus]}</Badge>
            {eng.offerType && <Badge tone="neutral">{eng.offerType}</Badge>}
            {eng.spk && <Badge tone="blue">SPK</Badge>}
            {eng.spkPulse && <Badge tone="violet">SPK PULSE</Badge>}
          </div>
          {eng.description && <p className="text-sm text-reform-gray mt-1">{eng.description}</p>}
          <div className="text-xs text-reform-gray mt-2">
            {eng.startedAt ? `Début ${formatDate(eng.startedAt)}` : 'Date début à définir'}
            {eng.endedAt ? ` · Fin ${formatDate(eng.endedAt)}` : ''}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-display text-2xl">{formatMoney(eng.totalAmount)}</div>
          {eng.paidAmount > 0 && eng.paidAmount < eng.totalAmount && (
            <div className="text-xs text-emerald-700 mt-1">{formatMoney(eng.paidAmount)} encaissé</div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="h-1.5 bg-reform-mauve rounded-full overflow-hidden">
          <div className="h-full bg-reform-violet transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-reform-gray">Statut :</span>
          <select
            value={eng.invoiceStatus}
            onChange={e => updateStatus(e.target.value as InvoiceStatus)}
            className="text-xs bg-reform-mauve px-3 py-1.5 rounded-full text-reform-ink outline-none cursor-pointer hover:bg-reform-violet-light"
          >
            {Object.entries(INV_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Modifier</Button>
          <Button size="sm" variant="ghost" onClick={remove} className="text-red-600 hover:bg-red-50"><Trash2 size={12} /></Button>
        </div>
      </div>

      {(eng.invoicedAt || eng.invoicedAmount || eng.invoiceRef) && (
        <div className="mt-3 text-xs text-reform-gray flex flex-wrap gap-2">
          {eng.invoicedAt && <span>Facturé le <strong>{formatDate(eng.invoicedAt)}</strong></span>}
          {eng.invoicedAmount != null && <span>· {formatMoney(eng.invoicedAmount)}</span>}
          {eng.invoiceRef && <span>· réf <span className="font-mono">{eng.invoiceRef}</span></span>}
        </div>
      )}

      <EditEngagementModal open={editing} onClose={() => setEditing(false)} eng={eng} onSaved={onChanged} />
      <MarkInvoicedModal open={invoicing} onClose={() => setInvoicing(false)} eng={eng} onSaved={onChanged} />
    </Card>
  );
}

function MarkInvoicedModal({ open, onClose, eng, onSaved }: { open: boolean; onClose: () => void; eng: Engagement; onSaved: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    invoicedAt: today,
    invoicedAmount: String(eng.totalAmount),
    invoiceRef: '',
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.patch(`/engagements/${eng.id}`, {
      invoiceStatus: 'invoiced',
      invoicedAt: form.invoicedAt || null,
      invoicedAmount: form.invoicedAmount ? Number(form.invoicedAmount) : null,
      invoiceRef: form.invoiceRef || null,
    });
    onClose();
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Marquer facturé — ${eng.title}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="bg-reform-mauve p-3 rounded-xl text-sm">
          Montant total prestation : <strong>{formatMoney(eng.totalAmount)}</strong>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de facturation *"><Input type="date" value={form.invoicedAt} onChange={e => setForm({ ...form, invoicedAt: e.target.value })} required autoFocus /></Field>
          <Field label="Montant facturé (€) *"><Input type="number" value={form.invoicedAmount} onChange={e => setForm({ ...form, invoicedAmount: e.target.value })} required /></Field>
        </div>
        <Field label="Référence facture" hint="ex. FA-2026-0042"><Input value={form.invoiceRef} onChange={e => setForm({ ...form, invoiceRef: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit">Enregistrer la facture</Button>
        </div>
      </form>
    </Modal>
  );
}

function NewEngagementModal({ open, onClose, orgId, onCreated }: { open: boolean; onClose: () => void; orgId: string; onCreated: () => void }) {
  const initial = { title: '', description: '', offerType: '', spk: false, spkPulse: false, totalAmount: '', startedAt: '', endedAt: '', invoiceStatus: 'to_invoice' as InvoiceStatus };
  const [form, setForm] = useState(initial);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.post<Engagement>('/engagements', {
      organizationId: orgId,
      title: form.title,
      description: form.description || null,
      offerType: form.offerType || null,
      spk: form.spk,
      spkPulse: form.spkPulse,
      totalAmount: Number(form.totalAmount) || 0,
      startedAt: form.startedAt || null,
      endedAt: form.endedAt || null,
      invoiceStatus: form.invoiceStatus,
    });
    setForm(initial);
    onClose();
    onCreated();
  }
  return (
    <Modal open={open} onClose={onClose} title="Nouvelle prestation">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Titre *"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required autoFocus /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type d'offre">
            <Select value={form.offerType} onChange={e => setForm({ ...form, offerType: e.target.value })}>
              <option value="">— Choisir —</option>
              {OFFER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Montant total (€) *"><Input type="number" value={form.totalAmount} onChange={e => setForm({ ...form, totalAmount: e.target.value })} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de début"><Input type="date" value={form.startedAt} onChange={e => setForm({ ...form, startedAt: e.target.value })} /></Field>
          <Field label="Date de fin prévue"><Input type="date" value={form.endedAt} onChange={e => setForm({ ...form, endedAt: e.target.value })} /></Field>
        </div>
        <Field label="Statut facturation">
          <Select value={form.invoiceStatus} onChange={e => setForm({ ...form, invoiceStatus: e.target.value as InvoiceStatus })}>
            {Object.entries(INV_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.spk} onChange={e => setForm({ ...form, spk: e.target.checked })} className="w-4 h-4 accent-reform-violet" />
            <span><strong>SPK</strong></span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.spkPulse} onChange={e => setForm({ ...form, spkPulse: e.target.checked })} className="w-4 h-4 accent-reform-violet" />
            <span><strong>SPK PULSE</strong></span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit">Créer</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditEngagementModal({ open, onClose, eng, onSaved }: { open: boolean; onClose: () => void; eng: Engagement; onSaved: () => void }) {
  const toDate = (s?: string | null) => s ? new Date(s).toISOString().split('T')[0] : '';
  const [form, setForm] = useState({
    title: eng.title,
    description: eng.description ?? '',
    offerType: eng.offerType ?? '',
    spk: !!eng.spk,
    spkPulse: !!eng.spkPulse,
    totalAmount: String(eng.totalAmount),
    paidAmount: String(eng.paidAmount),
    startedAt: toDate(eng.startedAt),
    endedAt: toDate(eng.endedAt),
    invoiceStatus: eng.invoiceStatus,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.patch(`/engagements/${eng.id}`, {
      title: form.title,
      description: form.description || null,
      offerType: form.offerType || null,
      spk: form.spk,
      spkPulse: form.spkPulse,
      totalAmount: Number(form.totalAmount),
      paidAmount: Number(form.paidAmount),
      startedAt: form.startedAt || null,
      endedAt: form.endedAt || null,
      invoiceStatus: form.invoiceStatus,
    });
    onClose();
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Modifier la prestation">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Titre *"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></Field>
        <Field label="Description"><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Type d'offre">
          <Select value={form.offerType} onChange={e => setForm({ ...form, offerType: e.target.value })}>
            <option value="">— Choisir —</option>
            {OFFER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Montant total (€)"><Input type="number" value={form.totalAmount} onChange={e => setForm({ ...form, totalAmount: e.target.value })} /></Field>
          <Field label="Encaissé (€)"><Input type="number" value={form.paidAmount} onChange={e => setForm({ ...form, paidAmount: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de début"><Input type="date" value={form.startedAt} onChange={e => setForm({ ...form, startedAt: e.target.value })} /></Field>
          <Field label="Date de fin prévue"><Input type="date" value={form.endedAt} onChange={e => setForm({ ...form, endedAt: e.target.value })} /></Field>
        </div>
        <Field label="Statut facturation">
          <Select value={form.invoiceStatus} onChange={e => setForm({ ...form, invoiceStatus: e.target.value as InvoiceStatus })}>
            {Object.entries(INV_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.spk} onChange={e => setForm({ ...form, spk: e.target.checked })} className="w-4 h-4 accent-reform-violet" />
            <span><strong>SPK</strong></span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.spkPulse} onChange={e => setForm({ ...form, spkPulse: e.target.checked })} className="w-4 h-4 accent-reform-violet" />
            <span><strong>SPK PULSE</strong></span>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
