import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Field, Input } from '../components/ui';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message === 'invalid_credentials' ? 'Identifiant ou mot de passe incorrect' : err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-reform-beige px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="font-display text-5xl tracking-tight">REFORM</div>
          <div className="text-reform-gray text-sm mt-2 uppercase tracking-widest">CRM interne</div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-reform-border space-y-5">
          <Field label="Identifiant">
            <Input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="email ou identifiant" required autoFocus autoComplete="username" />
          </Field>
          <Field label="Mot de passe">
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </Field>

          {error && <div className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</div>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>

        <p className="text-center text-xs text-reform-gray mt-6">
          De l'engagement à l'action.
        </p>
      </div>
    </div>
  );
}
