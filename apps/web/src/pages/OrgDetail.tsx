import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Calendar, FileText, MessageSquare, CheckSquare, Plus, Pencil } from 'lucide-react';
import { api, OFFER_TYPES, type OrgDetail as OrgDetailType, type Activity, type Contact, type Deal, type DealStage } from '../api/client';
import { Badge, Button, Card, Field, formatDate, formatMoney, Input, Modal, Select, Textarea } from '../components/ui';

const STAGE_LABELS: Record<DealStage, string> = {
  to_qualify: 'À qualifier',
  contacted: 'Contacté',
  meeting: 'RDV',
  proposal: 'Propale envoyée',
  negotiation: 'Négociation', // legacy — masqué du pipeline
  won: 'Gagné',
  lost: 'Perdu',
};

export function OrgDetail() {
  const { id } = useParams<{ id: string }>();
  const [org, setOrg] = useState<OrgDetailType | null>(null);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [newActivityOpen, setNewActivityOpen] = useState(false);
  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const data = await api.get<OrgDetailType>(`/organizations/${id}`);
    setOrg(data);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!org) return <div className="p-8 text-reform-gray">Chargement…</div>;

  return (
    <div className="p-8 max-w-6xl">
      <Link to={org.status === 'client' ? '/clients' : '/crm'} className="inline-flex items-center gap-1.5 text-sm text-reform-gray hover:text-reform-violet mb-6">
        <ArrowLeft size={14} /> Retour
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-4xl">{org.name}</h1>
            <Badge tone={org.status === 'client' ? 'green' : org.status === 'inactive' ? 'neutral' : 'violet'}>
              {org.status === 'prospect' ? 'Prospect' : org.status === 'client' ? 'Client' : 'Inactif'}
            </Badge>
            {org.spk && <Badge tone="blue">SPK</Badge>}
            {org.spkPulse && <Badge tone="violet">SPK PULSE</Badge>}
          </div>
          <div className="text-reform-gray mt-2 text-sm">
            {[org.industry, org.size, org.city].filter(Boolean).join(' · ') || 'Aucune info'}
          </div>
          {org.siren && (
            <div className="text-xs text-reform-gray mt-1">SIREN <span className="font-mono">{org.siren}</span></div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="ghost" onClick={() => setEditOrgOpen(true)}>
            <Pencil size={14} /> Modifier
          </Button>
          {org.status === 'client' && (
            <Link to={`/clients/${org.id}`}>
              <Button variant="secondary">Voir prestations →</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Deals */}
          <Card className="p-6">
            <SectionHeader title="Opportunités" count={org.deals.length} action={
              <Button size="sm" variant="secondary" onClick={() => setNewDealOpen(true)}>
                <Plus size={14} /> Deal
              </Button>
            } />
            {org.deals.length === 0 ? (
              <p className="text-sm text-reform-gray">Aucune opportunité.</p>
            ) : (
              <ul className="divide-y divide-reform-border">
                {org.deals.map(d => (
                  <li key={d.id} className="py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-reform-ink">{d.title}</div>
                        <div className="text-xs text-reform-gray mt-0.5 flex items-center flex-wrap gap-x-2 gap-y-1">
                          <Badge tone={d.stage === 'won' ? 'green' : d.stage === 'lost' ? 'red' : 'violet'}>{STAGE_LABELS[d.stage]}</Badge>
                          {d.offerType && <Badge tone="neutral">{d.offerType}</Badge>}
                          {d.probability != null && <span>{d.probability}% prob.</span>}
                          {(d.serviceStartAt || d.serviceEndAt) && (
                            <span>· presta {formatDate(d.serviceStartAt)} → {formatDate(d.serviceEndAt)}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-reform-gray-soft mt-1">
                          Créé le {formatDate(d.createdAt)}
                          {d.stage === 'won' && d.closedAt && <> · <span className="text-emerald-600 font-medium">Signé le {formatDate(d.closedAt)}</span></>}
                          {d.stage === 'lost' && d.closedAt && <> · <span className="text-red-600">Perdu le {formatDate(d.closedAt)}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-sm font-medium">{formatMoney(d.amount)}</div>
                        <button onClick={() => setEditDeal(d)} className="text-reform-gray hover:text-reform-violet p-1 rounded" title="Modifier">
                          <Pencil size={14} />
                        </button>
                      </div>
                    </div>
                    {(d.invoiceDate1 || d.invoiceDate2 || d.invoiceDate3) && (
                      <div className="mt-2 ml-1 flex flex-wrap gap-2 text-xs">
                        {[1, 2, 3].map(n => {
                          const date = d[`invoiceDate${n}` as 'invoiceDate1'];
                          const amount = d[`invoiceAmount${n}` as 'invoiceAmount1'];
                          if (!date && !amount) return null;
                          const labels = { 1: 'Acompte', 2: 'Inter.', 3: 'Solde' } as const;
                          return (
                            <span key={n} className="bg-reform-mauve text-reform-ink px-2 py-1 rounded-md">
                              <span className="text-reform-violet font-medium">{labels[n as 1|2|3]}</span> · {formatDate(date)}{amount ? ` · ${formatMoney(amount)}` : ''}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Activities */}
          <Card className="p-6">
            <SectionHeader title="Activités" count={org.activities.length} action={
              <Button size="sm" variant="secondary" onClick={() => setNewActivityOpen(true)}>
                <Plus size={14} /> Activité
              </Button>
            } />
            {org.activities.length === 0 ? (
              <p className="text-sm text-reform-gray">Pas encore d'historique.</p>
            ) : (
              <ul className="space-y-3">
                {org.activities.map(a => <ActivityRow key={a.id} a={a} />)}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Contacts */}
          <Card className="p-6">
            <SectionHeader title="Contacts" count={org.contacts.length} action={
              <Button size="sm" variant="secondary" onClick={() => setNewContactOpen(true)}>
                <Plus size={14} /> Contact
              </Button>
            } />
            {org.contacts.length === 0 ? (
              <p className="text-sm text-reform-gray">Aucun contact.</p>
            ) : (
              <ul className="space-y-4">
                {org.contacts.map(c => <ContactCard key={c.id} c={c} />)}
              </ul>
            )}
          </Card>

          {/* Notes */}
          <Card className="p-6">
            <h3 className="font-display text-lg mb-3">Notes</h3>
            {org.notes ? (
              <p className="text-sm text-reform-ink whitespace-pre-wrap">{org.notes}</p>
            ) : (
              <p className="text-sm text-reform-gray">Aucune note.</p>
            )}
          </Card>
        </div>
      </div>

      <NewContactModal open={newContactOpen} onClose={() => setNewContactOpen(false)} orgId={org.id} onCreated={load} />
      <NewDealModal open={newDealOpen} onClose={() => setNewDealOpen(false)} orgId={org.id} onCreated={load} />
      <NewActivityModal open={newActivityOpen} onClose={() => setNewActivityOpen(false)} orgId={org.id} onCreated={load} />
      <EditOrgModal open={editOrgOpen} onClose={() => setEditOrgOpen(false)} org={org} onSaved={load} />
      {editDeal && <EditDealModal deal={editDeal} onClose={() => setEditDeal(null)} onSaved={load} />}
    </div>
  );
}

function EditOrgModal({ open, onClose, org, onSaved }: { open: boolean; onClose: () => void; org: OrgDetailType; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: org.name,
    siren: org.siren ?? '',
    spk: !!org.spk,
    spkPulse: !!org.spkPulse,
    industry: org.industry ?? '',
    size: org.size ?? '',
    website: org.website ?? '',
    city: org.city ?? '',
    zipcode: org.zipcode ?? '',
    country: org.country ?? 'France',
    notes: org.notes ?? '',
    status: org.status,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.patch(`/organizations/${org.id}`, {
      name: form.name,
      siren: form.siren || null,
      spk: form.spk,
      spkPulse: form.spkPulse,
      industry: form.industry || null,
      size: form.size || null,
      website: form.website || null,
      city: form.city || null,
      zipcode: form.zipcode || null,
      country: form.country || null,
      notes: form.notes || null,
      status: form.status,
    });
    onClose();
    onSaved();
  }

  async function remove() {
    if (!confirm(`Supprimer définitivement "${org.name}" et tout son contenu ?`)) return;
    await api.delete(`/organizations/${org.id}`);
    window.location.href = org.status === 'client' ? '/clients' : '/crm';
  }

  return (
    <Modal open={open} onClose={onClose} title={`Modifier ${org.name}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nom *"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SIREN" hint="9 chiffres"><Input value={form.siren} onChange={e => setForm({ ...form, siren: e.target.value.replace(/\D/g, '').slice(0, 9) })} /></Field>
          <Field label="Statut">
            <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}>
              <option value="prospect">Prospect</option>
              <option value="client">Client</option>
              <option value="inactive">Inactif</option>
            </Select>
          </Field>
        </div>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Secteur"><Input value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} /></Field>
          <Field label="Taille"><Input value={form.size} onChange={e => setForm({ ...form, size: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ville"><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="Code postal"><Input value={form.zipcode} onChange={e => setForm({ ...form, zipcode: e.target.value })} /></Field>
        </div>
        <Field label="Site web"><Input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></Field>
        <Field label="Notes"><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="flex justify-between gap-2 pt-2">
          <Button type="button" variant="danger" onClick={remove}>Supprimer</Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function EditDealModal({ deal, onClose, onSaved }: { deal: Deal; onClose: () => void; onSaved: () => void }) {
  const toDate = (s?: string | null) => s ? new Date(s).toISOString().split('T')[0] : '';
  const [form, setForm] = useState({
    title: deal.title,
    stage: deal.stage,
    offerType: deal.offerType ?? '',
    amount: String(deal.amount ?? ''),
    probability: String(deal.probability ?? ''),
    serviceStartAt: toDate(deal.serviceStartAt),
    serviceEndAt: toDate(deal.serviceEndAt),
    invoiceDate1: toDate(deal.invoiceDate1),
    invoiceAmount1: String(deal.invoiceAmount1 ?? ''),
    invoiceDate2: toDate(deal.invoiceDate2),
    invoiceAmount2: String(deal.invoiceAmount2 ?? ''),
    invoiceDate3: toDate(deal.invoiceDate3),
    invoiceAmount3: String(deal.invoiceAmount3 ?? ''),
    notes: deal.notes ?? '',
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.patch(`/deals/${deal.id}`, {
      title: form.title,
      stage: form.stage,
      offerType: form.offerType || null,
      amount: form.amount ? Number(form.amount) : null,
      probability: form.probability ? Number(form.probability) : null,
      serviceStartAt: form.serviceStartAt || null,
      serviceEndAt: form.serviceEndAt || null,
      invoiceDate1: form.invoiceDate1 || null,
      invoiceAmount1: form.invoiceAmount1 ? Number(form.invoiceAmount1) : null,
      invoiceDate2: form.invoiceDate2 || null,
      invoiceAmount2: form.invoiceAmount2 ? Number(form.invoiceAmount2) : null,
      invoiceDate3: form.invoiceDate3 || null,
      invoiceAmount3: form.invoiceAmount3 ? Number(form.invoiceAmount3) : null,
      notes: form.notes || null,
    });
    onClose();
    onSaved();
  }

  async function remove() {
    if (!confirm(`Supprimer l'opportunité "${deal.title}" ?`)) return;
    await api.delete(`/deals/${deal.id}`);
    onClose();
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={`Modifier — ${deal.title}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Titre *"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Étape">
            <Select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as DealStage })}>
              {Object.entries(STAGE_LABELS).filter(([k]) => k !== 'negotiation').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Type d'offre">
            <Select value={form.offerType} onChange={e => setForm({ ...form, offerType: e.target.value })}>
              <option value="">— Choisir —</option>
              {OFFER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Enveloppe / devis (€)"><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Probabilité (%)"><Input type="number" min={0} max={100} value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début prestation"><Input type="date" value={form.serviceStartAt} onChange={e => setForm({ ...form, serviceStartAt: e.target.value })} /></Field>
          <Field label="Fin prestation prévue"><Input type="date" value={form.serviceEndAt} onChange={e => setForm({ ...form, serviceEndAt: e.target.value })} /></Field>
        </div>
        <div className="border-t border-reform-border pt-3 mt-2">
          <div className="text-xs uppercase tracking-wider text-reform-gray font-medium mb-2">Échéancier facturation</div>
          {[1, 2, 3].map(n => {
            const labels = { 1: 'Acompte', 2: 'Intermédiaire', 3: 'Solde' } as const;
            const dateKey = `invoiceDate${n}` as 'invoiceDate1' | 'invoiceDate2' | 'invoiceDate3';
            const amtKey = `invoiceAmount${n}` as 'invoiceAmount1' | 'invoiceAmount2' | 'invoiceAmount3';
            return (
              <div key={n} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center text-xs mb-2">
                <div className="text-reform-gray">F{n} · {labels[n as 1|2|3]}</div>
                <Input type="date" value={form[dateKey]} onChange={e => setForm({ ...form, [dateKey]: e.target.value })} />
                <Input type="number" placeholder="€" value={form[amtKey]} onChange={e => setForm({ ...form, [amtKey]: e.target.value })} />
              </div>
            );
          })}
        </div>
        <Field label="Notes"><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="flex justify-between gap-2 pt-2">
          <Button type="button" variant="danger" onClick={remove}>Supprimer</Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function SectionHeader({ title, count, action }: { title: string; count: number; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="font-display text-xl">{title}</h2>
        <Badge tone="neutral">{count}</Badge>
      </div>
      {action}
    </div>
  );
}

function ContactCard({ c }: { c: Contact }) {
  return (
    <li className="border border-reform-border rounded-xl p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">{c.firstName} {c.lastName}</div>
        {c.isPrimary && <Badge tone="violet" className="ml-2">Principal</Badge>}
      </div>
      {c.role && <div className="text-xs text-reform-gray mt-0.5">{c.role}</div>}
      <div className="mt-2 space-y-1">
        {c.email && (
          <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs text-reform-ink hover:text-reform-violet">
            <Mail size={12} /> {c.email}
          </a>
        )}
        {c.phone && (
          <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-xs text-reform-ink hover:text-reform-violet">
            <Phone size={12} /> {c.phone}
          </a>
        )}
      </div>
    </li>
  );
}

const ACTIVITY_ICONS = { call: Phone, email: Mail, meeting: Calendar, note: FileText, task: CheckSquare };

function ActivityRow({ a }: { a: Activity }) {
  const Icon = ACTIVITY_ICONS[a.type] ?? MessageSquare;
  return (
    <li className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-reform-mauve flex items-center justify-center text-reform-violet">
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium text-sm">{a.subject}</div>
          <div className="text-xs text-reform-gray flex-shrink-0">{formatDate(a.occurredAt)}</div>
        </div>
        {a.body && <p className="text-xs text-reform-ink mt-0.5 whitespace-pre-wrap">{a.body}</p>}
      </div>
    </li>
  );
}

function NewContactModal({ open, onClose, orgId, onCreated }: { open: boolean; onClose: () => void; orgId: string; onCreated: () => void }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', role: '', email: '', phone: '', isPrimary: false });
  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.post('/contacts', { organizationId: orgId, ...form });
    setForm({ firstName: '', lastName: '', role: '', email: '', phone: '', isPrimary: false });
    onClose();
    onCreated();
  }
  return (
    <Modal open={open} onClose={onClose} title="Nouveau contact">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prénom"><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required autoFocus /></Field>
          <Field label="Nom"><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required /></Field>
        </div>
        <Field label="Fonction"><Input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Téléphone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isPrimary} onChange={e => setForm({ ...form, isPrimary: e.target.checked })} />
          Contact principal
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit">Créer</Button>
        </div>
      </form>
    </Modal>
  );
}

function NewDealModal({ open, onClose, orgId, onCreated }: { open: boolean; onClose: () => void; orgId: string; onCreated: () => void }) {
  const initial = {
    title: '', stage: 'to_qualify' as DealStage, amount: '', probability: '30', offerType: '',
    serviceStartAt: '', serviceEndAt: '',
    invoiceDate1: '', invoiceAmount1: '',
    invoiceDate2: '', invoiceAmount2: '',
    invoiceDate3: '', invoiceAmount3: '',
  };
  const [form, setForm] = useState(initial);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.post('/deals', {
      organizationId: orgId,
      title: form.title,
      stage: form.stage,
      offerType: form.offerType || null,
      amount: Number(form.amount),
      probability: Number(form.probability),
      serviceStartAt: form.serviceStartAt || null,
      serviceEndAt: form.serviceEndAt || null,
      invoiceDate1: form.invoiceDate1 || null,
      invoiceAmount1: form.invoiceAmount1 ? Number(form.invoiceAmount1) : null,
      invoiceDate2: form.invoiceDate2 || null,
      invoiceAmount2: form.invoiceAmount2 ? Number(form.invoiceAmount2) : null,
      invoiceDate3: form.invoiceDate3 || null,
      invoiceAmount3: form.invoiceAmount3 ? Number(form.invoiceAmount3) : null,
    });
    setForm(initial);
    onClose();
    onCreated();
  }
  return (
    <Modal open={open} onClose={onClose} title="Nouvelle opportunité">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Titre *"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Étape">
            <Select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value as DealStage })}>
              {Object.entries(STAGE_LABELS)
                .filter(([k]) => k !== 'negotiation')
                .map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Type d'offre">
            <Select value={form.offerType} onChange={e => setForm({ ...form, offerType: e.target.value })}>
              <option value="">— Choisir —</option>
              {OFFER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Enveloppe / devis (€) *"><Input type="number" min={0} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required /></Field>
          <Field label="Probabilité (%) *"><Input type="number" min={0} max={100} value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} required /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début prestation prévu"><Input type="date" value={form.serviceStartAt} onChange={e => setForm({ ...form, serviceStartAt: e.target.value })} /></Field>
          <Field label="Fin prestation prévue"><Input type="date" value={form.serviceEndAt} onChange={e => setForm({ ...form, serviceEndAt: e.target.value })} /></Field>
        </div>

        <div className="border-t border-reform-border pt-3 mt-2">
          <div className="text-xs uppercase tracking-wider text-reform-gray font-medium mb-2">Échéancier de facturation prévisionnel</div>
          <div className="space-y-2">
            {[1, 2, 3].map(n => {
              const labels = { 1: 'Acompte', 2: 'Intermédiaire', 3: 'Solde' } as const;
              const dateKey = `invoiceDate${n}` as 'invoiceDate1' | 'invoiceDate2' | 'invoiceDate3';
              const amountKey = `invoiceAmount${n}` as 'invoiceAmount1' | 'invoiceAmount2' | 'invoiceAmount3';
              return (
                <div key={n} className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center text-xs">
                  <div className="text-reform-gray">F{n} · {labels[n as 1|2|3]}</div>
                  <Input type="date" value={form[dateKey]} onChange={e => setForm({ ...form, [dateKey]: e.target.value })} />
                  <Input type="number" min={0} placeholder="Montant (€)" value={form[amountKey]} onChange={e => setForm({ ...form, [amountKey]: e.target.value })} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit">Créer</Button>
        </div>
      </form>
    </Modal>
  );
}

function NewActivityModal({ open, onClose, orgId, onCreated }: { open: boolean; onClose: () => void; orgId: string; onCreated: () => void }) {
  const [form, setForm] = useState({ type: 'note' as Activity['type'], subject: '', body: '' });
  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.post('/activities', { organizationId: orgId, ...form });
    setForm({ type: 'note', subject: '', body: '' });
    onClose();
    onCreated();
  }
  return (
    <Modal open={open} onClose={onClose} title="Nouvelle activité">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Type">
          <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Activity['type'] })}>
            <option value="note">Note</option>
            <option value="call">Appel</option>
            <option value="email">Email</option>
            <option value="meeting">RDV</option>
            <option value="task">Tâche</option>
          </Select>
        </Field>
        <Field label="Sujet"><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required autoFocus /></Field>
        <Field label="Détails"><Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </form>
    </Modal>
  );
}
