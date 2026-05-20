import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Organization, type Engagement } from '../api/client';
import { Card, PageHeader, Badge, formatMoney, formatDate } from '../components/ui';
import { ImportExport } from '../components/ImportExport';
import { ColumnToggle, usePersistedToggle } from '../components/ColumnToggle';

type ClientRow = Organization & { engagements: Engagement[] };

export function Clients() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [showSpk, setShowSpk] = usePersistedToggle('clients_col_spk', false);
  const [showSpkPulse, setShowSpkPulse] = usePersistedToggle('clients_col_spk_pulse', false);

  async function reload() {
    const clients = await api.get<Organization[]>('/organizations?status=client');
    const enriched = await Promise.all(
      clients.map(async c => {
        const engs = await api.get<Engagement[]>(`/engagements?organizationId=${c.id}`);
        return { ...c, engagements: engs };
      })
    );
    setRows(enriched);
  }

  useEffect(() => { reload(); }, []);

  return (
    <div className="p-8 max-w-7xl">
      <PageHeader
        title="Clients"
        subtitle={`${rows.length} client${rows.length > 1 ? 's' : ''} actif${rows.length > 1 ? 's' : ''}`}
        actions={<ImportExport kind="clients" onImported={reload} />}
      />

      <div className="mb-4">
        <ColumnToggle
          columns={[
            { key: 'spk', label: 'SPK', show: showSpk, onToggle: setShowSpk },
            { key: 'spkPulse', label: 'SPK PULSE', show: showSpkPulse, onToggle: setShowSpkPulse },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-reform-mauve">
            <tr className="text-left text-xs uppercase tracking-wider text-reform-gray">
              <th className="px-6 py-3 font-medium">Client</th>
              <th className="px-6 py-3 font-medium">SIREN</th>
              <th className="px-6 py-3 font-medium">Secteur</th>
              {showSpk && <th className="px-6 py-3 font-medium">SPK</th>}
              {showSpkPulse && <th className="px-6 py-3 font-medium">SPK PULSE</th>}
              <th className="px-6 py-3 font-medium">Prestations</th>
              <th className="px-6 py-3 font-medium">Période</th>
              <th className="px-6 py-3 font-medium text-right">CA total</th>
              <th className="px-6 py-3 font-medium text-right">À facturer</th>
              <th className="px-6 py-3 font-medium text-right">En attente</th>
              <th className="px-6 py-3 font-medium text-right">Encaissé</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const totalCA = r.engagements.reduce((s, e) => s + e.totalAmount, 0);
              const toInvoice = r.engagements.filter(e => e.invoiceStatus === 'to_invoice').reduce((s, e) => s + e.totalAmount, 0);
              const invoicedUnpaid = r.engagements
                .filter(e => e.invoiceStatus === 'invoiced' || e.invoiceStatus === 'partially_paid')
                .reduce((s, e) => s + (e.totalAmount - e.paidAmount), 0);
              const paid = r.engagements.reduce((s, e) => s + e.paidAmount, 0);
              const starts = r.engagements.map(e => e.startedAt).filter(Boolean).sort();
              const ends = r.engagements.map(e => e.endedAt).filter(Boolean).sort();
              const earliestStart = starts[0];
              const latestEnd = ends[ends.length - 1];
              return (
                <tr key={r.id} className="border-t border-reform-border hover:bg-reform-mauve/40">
                  <td className="px-6 py-4">
                    <Link to={`/clients/${r.id}`} className="font-medium text-reform-ink hover:text-reform-violet">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-reform-gray font-mono">{r.siren || '—'}</td>
                  <td className="px-6 py-4 text-sm text-reform-gray">{r.industry || '—'}</td>
                  {showSpk && <td className="px-6 py-4 text-sm">{r.spk ? <Badge tone="blue">Oui</Badge> : <span className="text-reform-gray-soft text-xs">Non</span>}</td>}
                  {showSpkPulse && <td className="px-6 py-4 text-sm">{r.spkPulse ? <Badge tone="violet">Oui</Badge> : <span className="text-reform-gray-soft text-xs">Non</span>}</td>}
                  <td className="px-6 py-4 text-sm">
                    <Badge tone="violet">{r.engagements.length}</Badge>
                  </td>
                  <td className="px-6 py-4 text-xs text-reform-gray">
                    {earliestStart || latestEnd ? `${formatDate(earliestStart)} → ${formatDate(latestEnd)}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-right">{formatMoney(totalCA)}</td>
                  <td className="px-6 py-4 text-sm text-right text-amber-700">{formatMoney(toInvoice)}</td>
                  <td className="px-6 py-4 text-sm text-right text-blue-700">{formatMoney(invoicedUnpaid)}</td>
                  <td className="px-6 py-4 text-sm text-right text-emerald-700 font-medium">{formatMoney(paid)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9 + (showSpk ? 1 : 0) + (showSpkPulse ? 1 : 0)} className="px-6 py-12 text-center text-reform-gray">Aucun client. Les prospects passés à "gagné" deviennent clients.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
