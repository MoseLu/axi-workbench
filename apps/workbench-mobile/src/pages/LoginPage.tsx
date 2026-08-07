import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@axi/workbench-foundation';
import { AxiMark } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();
  const { t } = useMobileI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validation, setValidation] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidation(t('login.error.email'));
      return;
    }
    if (password.length < 8) {
      setValidation(t('login.error.password'));
      return;
    }
    setValidation('');
    try {
      await login({ email, password });
      navigate('/home', { replace: true });
    } catch {
      // Shared auth provider exposes the request error below the form.
    }
  };

  return (
    <main className="axi-mobile-login">
      <div className="axi-mobile-login__brand"><AxiMark size={34} /><span>{t('app.name')}</span></div>
      <div className="axi-mobile-login__copy"><p>{t('login.eyebrow')}</p><h1>{t('login.title')}</h1></div>
      <form className="axi-mobile-login__form" onSubmit={submit}>
        <label><span>{t('login.email')}</span><input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" inputMode="email" type="email" /></label>
        <label><span>{t('login.password')}</span><input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" type="password" /></label>
        {(validation || error) && <p className="axi-mobile-login__error">{validation || error}</p>}
        <button type="submit" disabled={isLoading}>{isLoading ? t('login.loading') : t('login.submit')}</button>
      </form>
    </main>
  );
}
