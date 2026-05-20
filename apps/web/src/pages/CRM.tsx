import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { api, OFFER_TYPES, type Organization, type Deal, type DealStage } from '../api/client';
import { Button, Card, Field, Input, Modal, PageHeader, Select, Textarea, Badge, formatMoney } from '../components/ui';
import { ImportExport } from '../components/ImportExport';

function relativeDate(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return "aujourd'hui";
  if (days < 2) return 'hier';
  if (days < 7) return `il y a ${days}j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

const STAGES: { id: DealStage; label: string }[] = [
  { id: 'to_qualify', label: 'À qualifier' },
  { id: 'contacted', label: 'Contacté' },
  { id: 'meeting', label: 'RDV' },
  { id: 'proposal', label: 'Propale envoyée' },
  { id: 'won', label: 'Gagné' },
  { id: 'lost', label: 'Perdu' },
];

export function CRM() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [newOrgOpen, setNewOrgOpen] = useState(false);

  async function reload() {
    const [o, d] = await Promise.all([
      api.get<Organization[]>('/organizations?status=prospect'),
      api.get<Deal[]>('/deals'),
    ]);
    setOrgs(o);
    setDeals(d);
  }

  useEffect(() => {
    reload();
  }, []);

  const prospectOrgIds = useMemo(() => new Set(orgs.map(o => o.id)), [orgs]);
  const prospectDeals = useMemo(
    () => deals.filter(d => prospectOrgIds.has(d.organizationId) && !['won', 'lost'].includes(d.stage)),
    [deals, prospectOrgIds]
  );

  async function moveStage(deal: Deal, stage: DealStage) {
    await api.patch(`/deals/${deal.id}`, { stage });
    if (stage === 'won') {
      // Le backend a déjà basculé l'orga en client + créé l'engagement
      window.location.href = `/clients/${deal.organizationId}`;
      return;
    }
    reload();
  }

  return (
    <div className="p-8 max-w-[1600px]">
      <PageHeader
        title="CRM — Prospects"
        subtitle={`${orgs.length} organisation${orgs.length > 1 ? 's' : ''} en cours · ${prospectDeals.length} opportunité${prospectDeals.length > 1 ? 's' : ''}`}
        actions={
          <>
            <div className="flex bg-reform-mauve rounded-full p-1">
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition ${view === 'kanban' ? 'bg-white text-reform-violet shadow-sm' : 'text-reform-gray'}`}
              >
                <LayoutGrid size={14} /> Pipeline
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition ${view === 'list' ? 'bg-white text-reform-violet shadow-sm' : 'text-reform-gray'}`}
              >
                <List size={14} /> Liste
              </button>
            </div>
            <ImportExport kind="prospects" onImported={reload} />
            <Button onClick={() => setNewOrgOpen(true)}>
              <Plus size={16} /> Nouveau prospect
            </Button>
          </>
        }
      />

      {view === 'kanban' ? (
        <Kanban stages={STAGES.filter(s => !['won', 'lost'].includes(s.id))} deals={prospectDeals} orgs={orgs} onMove={moveStage} />
      ) : (
        <ProspectList orgs={orgs} deals={prospectDeals} />
      )}

      <NewProspectModal open={newOrgOpen} onClose={() => setNewOrgOpen(false)} onCreated={reload} />
    </div>
  );
}

function Kanban({ stages, deals, orgs, onMove }: { stages: { id: DealStage; label: string }[]; deals: Deal[]; orgs: Organization[]; onMove: (d: Deal, s: DealStage) => void }) {
  return (
    <div className="grid grid-flow-col auto-cols-[280px] gap-4 overflow-x-auto pb-4">
      {stages.map(stage => {
        const stageDeals = deals.filter(d => d.stage === stage.id);
        const total = stageDeals.reduce((s, d) => s + (d.amount ?? 0), 0);
        return (
          <div key={stage.id} className="bg-reform-mauve rounded-2xl p-3 min-h-[400px]">
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="font-medium text-sm text-reform-ink">{stage.label}</div>
              <Badge tone="violet">{stageDeals.length}</Badge>
            </div>
            <div className="text-xs text-reform-gray px-2 mb-3">{formatMoney(total)}</div>
            <div className="space-y-2">
              {stageDeals.map(d => {
                const org = orgs.find(o => o.id === d.organizationId);
                return (
                  <Card key={d.id} className="p-3 cursor-pointer hover:border-reform-violet transition">
                    <Link to={`/crm/${org?.id}`} className="block">
                      <div className="font-display text-base text-reform-ink leading-tight line-clamp-2" title={org?.name}>{org?.name}</div>
                      <div className="text-xs text-reform-gray mt-1 line-clamp-1" title={d.title}>
                        {d.offerType ? <span className="text-reform-violet font-medium">{d.offerType}</span> : null}
                        {d.offerType && d.title ? ' · ' : ''}
                        {d.title}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm font-medium text-reform-violet">{formatMoney(d.amount)}</span>
                        {d.probability != null && <span className="text-xs text-reform-gray">{d.probability}%</span>}
                      </div>
                      <div className="text-[10px] text-reform-gray-soft mt-1.5">Créé {relativeDate(d.createdAt)}</div>
                    </Link>
                    <div className="flex gap-1 mt-3 pt-2 border-t border-reform-border">
                      <select
                        value={d.stage}
                        onChange={e => onMove(d, e.target.value as DealStage)}
                        className="text-xs bg-transparent text-reform-gray hover:text-reform-violet outline-none cursor-pointer flex-1"
                      >
                        {STAGES.map(s => (
                          <option key={s.id} value={s.id}>→ {s.label}</option>
                        ))}
                      </select>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProspectList({ orgs, deals }: { orgs: Organization[]; deals: Deal[] }) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full">
        <thead className="bg-reform-mauve">
          <tr className="text-left text-xs uppercase tracking-wider text-reform-gray">
            <th className="px-6 py-3 font-medium">Organisation</th>
            <th className="px-6 py-3 font-medium">Secteur</th>
            <th className="px-6 py-3 font-medium">Ville</th>
            <th className="px-6 py-3 font-medium">Deals actifs</th>
            <th className="px-6 py-3 font-medium text-right">Potentiel</th>
          </tr>
        </thead>
        <tbody>
          {orgs.map(o => {
            const orgDeals = deals.filter(d => d.organizationId === o.id);
            const total = orgDeals.reduce((s, d) => s + (d.amount ?? 0), 0);
            return (
              <tr key={o.id} className="border-t border-reform-border hover:bg-reform-mauve/40">
                <td className="px-6 py-4">
                  <Link to={`/crm/${o.id}`} className="font-medium text-reform-ink hover:text-reform-violet">
                    {o.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-reform-gray">{o.industry || '—'}</td>
                <td className="px-6 py-4 text-sm text-reform-gray">{o.city || '—'}</td>
                <td className="px-6 py-4 text-sm">{orgDeals.length}</td>
                <td className="px-6 py-4 text-sm font-medium text-right">{formatMoney(total)}</td>
              </tr>
            );
          })}
          {orgs.length === 0 && (
            <tr><td colSpan={5} className="px-6 py-12 text-center text-reform-gray">Aucun prospect pour le moment.</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function NewProspectModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const initial = {
    name: '', siren: '', industry: '', city: '', notes: '', spk: false, spkPulse: false,
    dealTitle: '', dealAmount: '', dealProbability: '30', offerType: '',
    serviceStartAt: '', serviceEndAt: '',
    invoiceDate1: '', invoiceAmount1: '',
    invoiceDate2: '', invoiceAmount2: '',
    invoiceDate3: '', invoiceAmount3: '',
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const org = await api.post<{ id: string }>('/organizations', {
        name: form.name,
        siren: form.siren || null,
        spk: form.spk,
        spkPulse: form.spkPulse,
        industry: form.industry || null,
        city: form.city || null,
        notes: form.notes || null,
        status: 'prospect',
      });
      await api.post('/deals', {
        organizationId: org.id,
        title: form.dealTitle,
        stage: 'to_qualify',
        offerType: form.offerType || null,
        amount: Number(form.dealAmount),
        probability: Number(form.dealProbability),
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouveau prospect">
      <form onSubmit={submit} className="space-y-4">
        <div className="text-xs uppercase tracking-wider text-reform-gray font-medium">Organisation</div>
        <Field label="Nom *">
          <Input value={form.name} onChange={e => set('name', e.target.value)} required autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SIREN" hint="9 chiffres">
            <Input value={form.siren} onChange={e => set('siren', e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="ex. 819522699" />
          </Field>
          <Field label="Ville">
            <Input value={form.city} onChange={e => set('city', e.target.value)} />
          </Field>
        </div>
        <Field label="Secteur">
          <Input value={form.industry} onChange={e => set('industry', e.target.value)} />
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

        <div className="border-t border-reform-border pt-4 mt-4">
          <div className="text-xs uppercase tracking-wider text-reform-gray font-medium mb-3">Opportunité (devis prévu)</div>
          <Field label="Titre de l'opportunité *">
            <Input value={form.dealTitle} onChange={e => set('dealTitle', e.target.value)} required placeholder="ex. ACRSE 2026" />
          </Field>
          <div className="mt-3">
            <Field label="Type d'offre">
              <Select value={form.offerType} onChange={e => set('offerType', e.target.value)}>
                <option value="">— Choisir —</option>
                {OFFER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Enveloppe / devis (€) *">
              <Input type="number" min={0} value={form.dealAmount} onChange={e => set('dealAmount', e.target.value)} required />
            </Field>
            <Field label="Probabilité réussite (%) *">
              <Input type="number" min={0} max={100} value={form.dealProbability} onChange={e => set('dealProbability', e.target.value)} required />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Début prestation prévu">
              <Input type="date" value={form.serviceStartAt} onChange={e => set('serviceStartAt', e.target.value)} />
            </Field>
            <Field label="Fin prestation prévue">
              <Input type="date" value={form.serviceEndAt} onChange={e => set('serviceEndAt', e.target.value)} />
            </Field>
          </div>

          <div className="text-xs uppercase tracking-wider text-reform-gray font-medium mt-5 mb-2">Échéancier de facturation prévisionnel</div>
          <div className="space-y-2">
            <InvoiceLine n={1} label="Acompte" date={form.invoiceDate1} amount={form.invoiceAmount1} onDate={v => set('invoiceDate1', v)} onAmount={v => set('invoiceAmount1', v)} />
            <InvoiceLine n={2} label="Intermédiaire" date={form.invoiceDate2} amount={form.invoiceAmount2} onDate={v => set('invoiceDate2', v)} onAmount={v => set('invoiceAmount2', v)} />
            <InvoiceLine n={3} label="Solde" date={form.invoiceDate3} amount={form.invoiceAmount3} onDate={v => set('invoiceDate3', v)} onAmount={v => set('invoiceAmount3', v)} />
          </div>
        </div>

        <Field label="Notes">
          <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>

        {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Création…' : 'Créer le prospect'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function InvoiceLine({ n, label, date, amount, onDate, onAmount }: { n: number; label: string; date: string; amount: string; onDate: (v: string) => void; onAmount: (v: string) => void }) {
  return (
    <div className="grid grid-cols-[80px_1fr_1fr] gap-2 items-center text-xs">
      <div className="text-reform-gray">F{n} · {label}</div>
      <Input type="date" value={date} onChange={e => onDate(e.target.value)} />
      <Input type="number" min={0} placeholder="Montant (€)" value={amount} onChange={e => onAmount(e.target.value)} />
    </div>
  );
}

export { STAGES };
