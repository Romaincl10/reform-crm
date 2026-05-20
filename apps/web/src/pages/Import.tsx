import { useState, type ChangeEvent } from 'react';
import { Upload, FileText } from 'lucide-react';
import { api } from '../api/client';
import { Button, Card, PageHeader } from '../components/ui';

interface ImportResult {
  inserted: number;
  skipped: number;
  details?: { skipped: any[] };
}

export function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const r = await api.upload<ImportResult>('/import/organizations', file);
      setResult(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader title="Import" subtitle="Importer un fichier CSV d'organisations dans la base." />

      <Card className="p-6 mb-6">
        <h3 className="font-display text-lg mb-3">Format attendu</h3>
        <p className="text-sm text-reform-gray mb-3">
          Fichier CSV avec en-têtes en première ligne. Colonnes reconnues (FR ou EN, casse insensible) :
        </p>
        <code className="block text-xs bg-reform-mauve p-3 rounded-lg font-mono">
          name, status, industry, size, website, address, city, zipcode, country, notes
        </code>
        <p className="text-xs text-reform-gray mt-3">
          <strong>name</strong> (ou <em>nom</em>) est obligatoire. <strong>status</strong> = "prospect", "client" ou "inactive" (défaut : prospect).
          Synonymes acceptés : <em>nom, secteur, taille, site, adresse, ville, code postal, pays, statut</em>.
        </p>
      </Card>

      <Card className="p-6">
        <label className="block border-2 border-dashed border-reform-border rounded-2xl p-10 text-center cursor-pointer hover:border-reform-violet transition">
          <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <Upload size={32} className="mx-auto text-reform-violet mb-3" />
          <div className="font-medium text-reform-ink">{file ? file.name : 'Choisir un fichier CSV'}</div>
          <div className="text-xs text-reform-gray mt-1">{file ? `${(file.size / 1024).toFixed(1)} Ko` : 'Glisse-dépose ou clique pour parcourir'}</div>
        </label>

        {file && (
          <div className="flex justify-end mt-4">
            <Button onClick={upload} disabled={uploading}>
              {uploading ? 'Import en cours…' : `Importer ${file.name}`}
            </Button>
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>}

        {result && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText size={16} className="text-emerald-600" />
              <span className="font-medium">{result.inserted} organisation{result.inserted > 1 ? 's' : ''} importée{result.inserted > 1 ? 's' : ''}</span>
              {result.skipped > 0 && <span className="text-amber-700">· {result.skipped} ligne{result.skipped > 1 ? 's' : ''} ignorée{result.skipped > 1 ? 's' : ''}</span>}
            </div>
            {result.details?.skipped && result.details.skipped.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-reform-gray">Voir les lignes ignorées</summary>
                <pre className="mt-2 bg-reform-mauve p-3 rounded-lg overflow-x-auto">{JSON.stringify(result.details.skipped, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
