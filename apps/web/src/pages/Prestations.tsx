import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import { api, OFFER_TYPES, type Engagement, type InvoiceStatus, type Organization } from '../api/client';
import { Badge, Card, Input, PageHeader, Select, formatDate, formatMoney } from '../components/ui';
import { ImportExport } from '../components/ImportExport';
import { ColumnToggle, usePersistedToggle } from '../components/ColumnToggle';

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

type SortKey = 'client' | 'title' | 'offerType' | 'spk' | 'spkPulse' | 'totalAmount' | 'paidAmount' | 'startedAt' | 'endedAt' | 'invoiceStatus';
type SortDir = 'asc' | 'desc';

type Row = Engagement & { orgName: string; orgId: string; orgSiren?: string | null };

export function Prestations() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [offerFilter, setOfferFilter] = useState<string>('all');
  const [pulseFilter, setPulseFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [spkFilter, setSpkFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [showSpkCol, setShowSpkCol] = usePersistedToggle('prestations_col_spk', false);
  const [showSpkPulseCol, setShowSpkPulseCol] = usePersistedToggle('prestations_col_spk_pulse', false);
  const [sortKey, setSortKey] = useState<SortKey>('startedAt');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  async function reload() {
    const [e, o] = await Promise.all([
      api.get<Engagement[]>('/engagements'),
      api.get<Organization[]>('/organizations'),
    ]);
    setEngagements(e); setOrgs(o);
  }

  useEffect(() => { reload(); }, []);

  const rows: Row[] = useMemo(() => {
    return engagements.map(e => {
      const org = orgs.find(o => o.id === e.organizationId);
      return { ...e, orgName: org?.name ?? '—', orgId: org?.id ?? '', orgSiren: org?.siren };
    });
  }, [engagements, orgs]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(x => x.orgName.toLowerCase().includes(q) || x.title.toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') r = r.filter(x => x.invoiceStatus === statusFilter);
    if (clientFilter !== 'all') r = r.filter(x => x.orgId === clientFilter);
    if (offerFilter !== 'all') r = r.filter(x => x.offerType === offerFilter);
    if (showSpkPulseCol && pulseFilter !== 'all') r = r.filter(x => !!x.spkPulse === (pulseFilter === 'yes'));
    if (showSpkCol && spkFilter !== 'all') r = r.filter(x => !!x.spk === (spkFilter === 'yes'));

    return [...r].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      const getVal = (row: Row): unknown => {
        if (sortKey === 'client') return row.orgName;
        return (row as unknown as Record<string, unknown>)[sortKey];
      };
      const va = getVal(a);
      const vb = getVal(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mul;
      return String(va).localeCompare(String(vb)) * mul;
    });
  }, [rows, search, statusFilter, clientFilter, offerFilter, pulseFilter, spkFilter, showSpkCol, showSpkPulseCol, sortKey, sortDir]);

  const totals = useMemo(() => ({
    count: filtered.length,
    ca: filtered.reduce((s, r) => s + r.totalAmount, 0),
    paid: filtered.reduce((s, r) => s + r.paidAmount, 0),
  }), [filtered]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }

  const SortBtn = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className={`flex items-center gap-1 text-xs uppercase tracking-wider text-reform-gray hover:text-reform-violet font-medium ${align === 'right' ? 'ml-auto' : ''}`}
    >
      {label}
      {sortKey === k && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );

  const clientOptions = useMemo(
    () => [...orgs].sort((a, b) => a.name.localeCompare(b.name)),
    [orgs]
  );

  return (
    <div className="p-8 max-w-[1600px]">
      <PageHeader
        title="Prestations"
        subtitle={`${totals.count} prestation${totals.count > 1 ? 's' : ''} · ${formatMoney(totals.ca)} CA · ${formatMoney(totals.paid)} encaissé`}
        actions={<ImportExport kind="prestations" onImported={reload} />}
      />

      <div className="mb-4">
        <ColumnToggle
          columns={[
            { key: 'spk', label: 'SPK', show: showSpkCol, onToggle: setShowSpkCol },
            { key: 'spkPulse', label: 'SPK PULSE', show: showSpkPulseCol, onToggle: setShowSpkPulseCol },
          ]}
        />
      </div>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-reform-gray" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Recherche client ou titre…"
              className="pl-9"
            />
          </div>
          <Select value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
            <option value="all">Tous les clients</option>
            {clientOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <Select value={offerFilter} onChange={e => setOfferFilter(e.target.value)}>
            <option value="all">Toutes les offres</option>
            {OFFER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
          </Select>
          <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value as InvoiceStatus | 'all')}>
            <option value="all">Tous les statuts</option>
            {Object.entries(INV_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        {(showSpkCol || showSpkPulseCol) && (
          <div className="mt-3 flex items-center gap-6 flex-wrap">
            {showSpkCol && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-reform-gray font-medium">SPK :</span>
                <div className="flex bg-reform-mauve rounded-full p-1">
                  {[{ v: 'all', l: 'Tous' }, { v: 'yes', l: 'Oui' }, { v: 'no', l: 'Non' }].map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setSpkFilter(o.v as 'all' | 'yes' | 'no')}
                      className={`px-3 py-1 rounded-full text-xs transition ${spkFilter === o.v ? 'bg-white text-reform-violet shadow-sm font-medium' : 'text-reform-gray'}`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showSpkPulseCol && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-reform-gray font-medium">SPK PULSE :</span>
                <div className="flex bg-reform-mauve rounded-full p-1">
                  {[{ v: 'all', l: 'Tous' }, { v: 'yes', l: 'Oui' }, { v: 'no', l: 'Non' }].map(o => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setPulseFilter(o.v as 'all' | 'yes' | 'no')}
                      className={`px-3 py-1 rounded-full text-xs transition ${pulseFilter === o.v ? 'bg-white text-reform-violet shadow-sm font-medium' : 'text-reform-gray'}`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-reform-mauve">
            <tr>
              <th className="px-6 py-3 text-left"><SortBtn k="client" label="Client" /></th>
              <th className="px-6 py-3 text-left"><SortBtn k="title" label="Prestation" /></th>
              <th className="px-6 py-3 text-left"><SortBtn k="offerType" label="Offre" /></th>
              {showSpkCol && <th className="px-6 py-3 text-left"><SortBtn k="spk" label="SPK" /></th>}
              {showSpkPulseCol && <th className="px-6 py-3 text-left"><SortBtn k="spkPulse" label="SPK PULSE" /></th>}
              <th className="px-6 py-3 text-left"><SortBtn k="startedAt" label="Date début" /></th>
              <th className="px-6 py-3 text-left"><SortBtn k="endedAt" label="Date fin" /></th>
              <th className="px-6 py-3 text-left"><SortBtn k="invoiceStatus" label="Statut" /></th>
              <th className="px-6 py-3 text-right"><SortBtn k="totalAmount" label="Montant" align="right" /></th>
              <th className="px-6 py-3 text-right"><SortBtn k="paidAmount" label="Encaissé" align="right" /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-t border-reform-border hover:bg-reform-mauve/40">
                <td className="px-6 py-3">
                  <Link to={`/clients/${r.orgId}`} className="text-sm font-medium text-reform-ink hover:text-reform-violet">
                    {r.orgName}
                  </Link>
                  {r.orgSiren && <div className="text-xs text-reform-gray font-mono">{r.orgSiren}</div>}
                </td>
                <td className="px-6 py-3 text-sm">{r.title}</td>
                <td className="px-6 py-3 text-xs">{r.offerType ? <Badge tone="neutral">{r.offerType}</Badge> : <span className="text-reform-gray">—</span>}</td>
                {showSpkCol && <td className="px-6 py-3 text-xs">{r.spk ? <Badge tone="blue">Oui</Badge> : <span className="text-reform-gray-soft">Non</span>}</td>}
                {showSpkPulseCol && <td className="px-6 py-3 text-xs">{r.spkPulse ? <Badge tone="violet">Oui</Badge> : <span className="text-reform-gray-soft">Non</span>}</td>}
                <td className="px-6 py-3 text-sm text-reform-gray">{formatDate(r.startedAt)}</td>
                <td className="px-6 py-3 text-sm text-reform-gray">{formatDate(r.endedAt)}</td>
                <td className="px-6 py-3"><Badge tone={INV_TONE[r.invoiceStatus]}>{INV_LABEL[r.invoiceStatus]}</Badge></td>
                <td className="px-6 py-3 text-sm font-medium text-right">{formatMoney(r.totalAmount)}</td>
                <td className="px-6 py-3 text-sm text-right text-emerald-700">{formatMoney(r.paidAmount)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8 + (showSpkCol ? 1 : 0) + (showSpkPulseCol ? 1 : 0)} className="px-6 py-12 text-center text-reform-gray">Aucune prestation ne correspond aux filtres.</td></tr>
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-reform-mauve/40">
              <tr className="font-medium">
                <td className="px-6 py-3 text-sm" colSpan={6 + (showSpkCol ? 1 : 0) + (showSpkPulseCol ? 1 : 0)}>TOTAL ({totals.count})</td>
                <td className="px-6 py-3 text-sm text-right">{formatMoney(totals.ca)}</td>
                <td className="px-6 py-3 text-sm text-right text-emerald-700">{formatMoney(totals.paid)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </Card>
    </div>
  );
}
