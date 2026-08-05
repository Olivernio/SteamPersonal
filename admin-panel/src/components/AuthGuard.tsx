import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseAdmin';
import { Lock, LogOut, ShieldCheck } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface AuthGuardProps {
  children: (user: User) => React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0E14', color: 'rgba(255,255,255,0.4)' }}>
        Cargando autenticación...
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B0E14' }}>
        <form
          onSubmit={handleLogin}
          style={{
            width: '360px',
            padding: '32px',
            borderRadius: '16px',
            backgroundColor: '#151922',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#A5B4FC', marginBottom: '12px' }}>
              <Lock size={24} />
            </div>
            <h2 style={{ margin: 0, color: '#E2E8F0', fontSize: '20px', fontWeight: 700 }}>Panel de Administración</h2>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Ingresa tus credenciales de admin Supabase</p>
          </div>

          {errorMsg && (
            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '12px' }}>
              {errorMsg}
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Correo Electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@steampersonal.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#E2E8F0',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#E2E8F0',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: '#6366F1',
              border: 'none',
              color: '#FFF',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              marginTop: '8px'
            }}
          >
            Iniciar Sesión
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Admin Header */}
      <div style={{ height: '52px', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#151922', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#A5B4FC', fontWeight: 700, fontSize: '15px' }}>
          <ShieldCheck size={20} /> Steam Personal — Panel Admin
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{user.email}</span>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <LogOut size={13} /> Salir
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children(user)}
      </div>
    </div>
  );
};
