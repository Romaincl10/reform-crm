import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Users, Briefcase, AlertCircle, Target, Sparkles, Zap } from 'lucide-react';
import { api, type Organization, type Deal, type Engagement } from '../api/client';
import { Card, PageHeader, Badge, formatMoney, formatDate } from '../components/ui';

export function Dashboard() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<Organization[]>('/organizations'),
      api.get<Deal[]>('/deals'),
      api.get<Engagement[]>('/engagements'),
    ]).then(([o, d, e]) => {
      setOrgs(o);
      setDeals(d);
      setEngagements(e);
    });
  }, []);

  const prospects = orgs.filter(o => o.status === 'prospect').length;
  const clients = orgs.filter(o => o.status === 'client').length;
  const openDeals = deals.filter(d => !['won', 'lost'].includes(d.stage));
  const pipelineValue = openDeals.reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const pipelineWeighted = openDeals.reduce((sum, d) => sum + ((d.amount ?? 0) * (d.probability ?? 0)) / 100, 0);
  const toInvoice = engagements.filter(e => e.invoiceStatus === 'to_invoice').reduce((s, e) => s + e.totalAmount, 0);
  const spkPulseCA = engagements.filter(e => e.spkPulse).reduce((s, e) => s + e.totalAmount, 0);
  const spkPulseCount = engagements.filter(e => e.spkPulse).length;

  // Derniers prospects/devis ajoutés (top 6 par updatedAt sur les deals ouverts)
  const recentDeals = [...openDeals]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 6);

  const upcomingStarts = engagements
    .filter(e => e.startedAt && new Date(e.startedAt) >= new Date())
    .sort((a, b) => new Date(a.startedAt!).getTime() - new Date(b.startedAt!).getTime())
    .slice(0, 6);

  return (
    <div className="p-8 max-w-7xl">
      <PageHeader title="Tableau de bord" subtitle="Vue d'ensemble de l'activité commerciale REFORM" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <Stat icon={<Briefcase size={20} />} label="Prospects actifs" value={prospects.toString()} />
        <Stat icon={<Users size={20} />} label="Clients" value={clients.toString()} />
        <Stat icon={<AlertCircle size={20} />} label="À facturer" value={formatMoney(toInvoice)} tone="amber" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Stat icon={<TrendingUp size={20} />} label="Pipeline brut" value={formatMoney(pipelineValue)} tone="violet" />
        <Stat icon={<Target size={20} />} label="Pipeline probabilisé" value={formatMoney(pipelineWeighted)} tone="violet" />
        <Stat icon={<Zap size={20} />} label={`CA SPK PULSE${spkPulseCount > 0 ? ` (${spkPulseCount})` : ''}`} value={formatMoney(spkPulseCA)} tone="pulse" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl">Derniers devis / prospects</h2>
            <Sparkles size={18} className="text-reform-violet" />
          </div>
          {recentDeals.length === 0 ? (
            <p className="text-sm text-reform-gray">Aucun devis ouvert.</p>
          ) : (
            <ul className="space-y-3">
              {recentDeals.map(d => {
                const org = orgs.find(o => o.id === d.organizationId);
                return (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2 border-b border-reform-border last:border-0">
                    <div className="min-w-0 flex-1">
                      <Link to={`/crm/${org?.id}`} className="font-medium text-reform-ink hover:text-reform-violet block truncate">
                        {org?.name}
                      </Link>
                      <div className="text-xs text-reform-gray truncate">{d.title} · {formatDate(d.updatedAt)}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-medium">{formatMoney(d.amount)}</div>
                      {d.probability != null && <div className="text-xs text-reform-gray">{d.probability}%</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl">Prestations à venir</h2>
            <Badge tone="violet">{upcomingStarts.length}</Badge>
          </div>
          {upcomingStarts.length === 0 ? (
            <p className="text-sm text-reform-gray">Aucune prestation à démarrer.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingStarts.map(e => {
                const org = orgs.find(o => o.id === e.organizationId);
                return (
                  <li key={e.id} className="flex items-center justify-between py-2 border-b border-reform-border last:border-0">
                    <div>
                      <Link to={`/clients/${org?.id}`} className="font-medium text-reform-ink hover:text-reform-violet">
                        {org?.name}
                      </Link>
                      <div className="text-xs text-reform-gray">{e.title} · début {formatDate(e.startedAt)}</div>
                    </div>
                    <div className="text-sm font-medium">{formatMoney(e.totalAmount)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone = 'neutral' }: { icon: React.ReactNode; label: string; value: string; tone?: 'neutral' | 'violet' | 'amber' | 'pulse' }) {
  const toneClass =
    tone === 'violet' ? 'bg-reform-violet-light text-reform-violet' :
    tone === 'amber' ? 'bg-amber-50 text-amber-700' :
    tone === 'pulse' ? 'bg-gradient-to-br from-reform-violet to-reform-violet-dark text-white' :
    'bg-reform-mauve text-reform-ink';
  return (
    <Card className="p-5">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl ${toneClass} mb-3`}>{icon}</div>
      <div className="text-xs uppercase tracking-widest text-reform-gray">{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </Card>
  );
}
