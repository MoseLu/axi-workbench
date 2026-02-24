import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LoginInput } from '@epap/schemas';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();
  
  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: '',
  });
  
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof LoginInput, string>>>({});

  const validate = (): boolean => {
    const errors: Partial<Record<keyof LoginInput, string>> = {};
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    try {
      await login(formData);
      navigate('/');
    } catch {
      // Error is handled by AuthContext
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear validation error when user types
    if (validationErrors[name as keyof LoginInput]) {
      setValidationErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: 14,
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    color: '#fff',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.75)',
    marginBottom: 8,
  };

  const errorTextStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#ff4d4f',
    marginTop: 4,
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: 40,
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ 
            fontSize: 28, 
            fontWeight: 600, 
            color: '#fff',
            marginBottom: 8,
            letterSpacing: '-0.5px',
          }}>
            Welcome Back
          </h1>
          <p style={{ 
            fontSize: 14, 
            color: 'rgba(255, 255, 255, 0.5)',
          }}>
            Sign in to your EPAP Portal account
          </p>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(255, 77, 79, 0.1)',
            border: '1px solid rgba(255, 77, 79, 0.3)',
            borderRadius: 8,
            color: '#ff4d4f',
            fontSize: 13,
            marginBottom: 24,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="email" style={labelStyle}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@company.com"
              style={{
                ...inputStyle,
                borderColor: validationErrors.email ? '#ff4d4f' : 'rgba(255, 255, 255, 0.1)',
              }}
            />
            {validationErrors.email && (
              <span style={errorTextStyle}>{validationErrors.email}</span>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <label htmlFor="password" style={labelStyle}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              style={{
                ...inputStyle,
                borderColor: validationErrors.password ? '#ff4d4f' : 'rgba(255, 255, 255, 0.1)',
              }}
            />
            {validationErrors.password && (
              <span style={errorTextStyle}>{validationErrors.password}</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '14px 24px',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              background: isLoading ? 'rgba(24, 144, 255, 0.6)' : '#1890ff',
              border: 'none',
              borderRadius: 8,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, transform 0.1s',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: 24,
          fontSize: 13,
          color: 'rgba(255, 255, 255, 0.5)',
        }}>
          Don't have an account?{' '}
          <Link 
            to="/register" 
            style={{
              color: '#1890ff',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
