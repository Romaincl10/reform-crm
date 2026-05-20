import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Upload, FileSpreadsheet } from 'lucide-react';
import { api } from '../api/client';
import { Button, Modal } from './ui';

type Kind = 'prospects' | 'clients' | 'prestations';

const TITLES: Record<Kind, string> = {
  prospects: 'Importer des prospects',
  clients: 'Importer des clients',
  prestations: 'Importer des prestations',
};

const HINTS: Record<Kind, string> = {
  prospects: 'un prospect avec contact + opportunité optionnels',
  clients: 'une prestation (plusieurs lignes même client OK, fusion sur le nom)',
  prestations: 'une prestation rattachée à un client (matching par nom, création de l\'orga si absente)',
};

interface Result {
  orgsCreated?: number;
  contactsCreated?: number;
  dealsCreated?: number;
  engCreated?: number;
  skipped?: number;
  details?: { skipped: any[] };
}

export function ImportExport({ kind, onImported }: { kind: Kind; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportData() {
    setExporting(true);
    try {
      const token = localStorage.getItem('reform_token');
      const res = await fetch(`/api/export/${kind}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export échoué');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="(.+)"/);
      const filename = match?.[1] ?? `REFORM_${kind}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Export échoué : ' + e.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Upload size={14} /> Importer
      </Button>
      <Button variant="ghost" size="sm" onClick={exportData} disabled={exporting}>
        <Download size={14} /> {exporting ? 'Export…' : 'Exporter'}
      </Button>
      <ImportModal open={open} onClose={() => setOpen(false)} kind={kind} onImported={onImported} />
    </>
  );
}

function ImportModal({ open, onClose, kind, onImported }: { open: boolean; onClose: () => void; kind: Kind; onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function downloadTemplate() {
    const token = localStorage.getItem('reform_token');
    const res = await fetch(`/api/export/template/${kind}`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `REFORM_template_${kind}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const r = await api.upload<Result>(`/import/${kind}`, file);
      setResult(r);
      onImported();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={TITLES[kind]}>
      <div className="space-y-5">
        <div className="bg-reform-mauve p-4 rounded-xl">
          <div className="flex items-start gap-3">
            <FileSpreadsheet size={20} className="text-reform-violet flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-reform-ink font-medium">Format attendu</p>
              <p className="text-xs text-reform-gray mt-1">
                Excel (.xlsx) ou CSV. Une ligne = {HINTS[kind]}.
              </p>
              <button onClick={downloadTemplate} className="mt-2 text-xs text-reform-violet hover:underline inline-flex items-center gap-1">
                <Download size={12} /> Télécharger le template
              </button>
            </div>
          </div>
        </div>

        <label className="block border-2 border-dashed border-reform-border rounded-2xl p-8 text-center cursor-pointer hover:border-reform-violet transition">
          <input ref={fileInput} type="file" accept=".xlsx,.xlsm,.csv" onChange={pickFile} className="hidden" />
          <Upload size={28} className="mx-auto text-reform-violet mb-2" />
          <div className="font-medium text-sm">{file ? file.name : 'Choisir un fichier'}</div>
          <div className="text-xs text-reform-gray mt-1">{file ? `${(file.size / 1024).toFixed(1)} Ko` : 'Excel (.xlsx) ou CSV'}</div>
        </label>

        {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>}

        {result && (
          <div className="bg-emerald-50 px-4 py-3 rounded-xl text-sm space-y-1">
            {result.orgsCreated != null && result.orgsCreated > 0 && <div>✓ <strong>{result.orgsCreated}</strong> {kind === 'prospects' ? 'prospect(s)' : 'client(s)'} créé(s)</div>}
            {result.contactsCreated != null && result.contactsCreated > 0 && <div>✓ {result.contactsCreated} contact(s)</div>}
            {result.dealsCreated != null && result.dealsCreated > 0 && <div>✓ {result.dealsCreated} opportunité(s)</div>}
            {result.engCreated != null && result.engCreated > 0 && <div>✓ {result.engCreated} prestation(s)</div>}
            {result.skipped != null && result.skipped > 0 && <div className="text-amber-700">⚠ {result.skipped} ligne(s) ignorée(s)</div>}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={handleClose}>Fermer</Button>
          {file && !result && (
            <Button onClick={upload} disabled={uploading}>
              {uploading ? 'Import…' : 'Importer'}
            </Button>
          )}
          {result && (
            <Button onClick={() => { reset(); }}>Importer un autre fichier</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
