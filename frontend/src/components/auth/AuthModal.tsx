import { useState } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { checkPasswordStrength } from '../../api/client'

interface Props { onClose: () => void }

export default function AuthModal({ onClose }: Props) {
  const { signIn, signUp, isLoading } = useAuth()
  const [tab, setTab] = useState<'signin' | 'register'>('signin')
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  // Sign in
  const [siUser, setSiUser] = useState('')
  const [siPass, setSiPass] = useState('')

  // Register
  const [regUser, setRegUser] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPass, setRegPass] = useState('')
  const [strength, setStrength] = useState<{ score: number; label: string; color: string } | null>(null)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signIn(siUser, siPass)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Incorrect username or password.')
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signUp(regUser, regEmail, regPass)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Registration failed.')
    }
  }

  async function onPasswordChange(pw: string) {
    setRegPass(pw)
    if (pw.length > 2) {
      try {
        const s = await checkPasswordStrength(pw)
        setStrength(s)
      } catch { /* ignore */ }
    } else {
      setStrength(null)
    }
  }

  const strengthW = strength ? `${(strength.score + 1) * 20}%` : '0%'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,15,30,0.80)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid rgba(212,175,55,0.20)',
        borderRadius: 20, width: 440, maxWidth: '95vw',
        padding: 40, position: 'relative',
        animation: 'fade-up 0.3s ease forwards',
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-tertiary)',
        }}>
          <X size={18} />
        </button>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ width: 12, height: 12, background: 'var(--gold)', transform: 'rotate(45deg)', boxShadow: '0 0 10px rgba(212,175,55,0.6)' }} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 18, fontWeight: 700, letterSpacing: '3px' }}>
            THAMANI <span style={{ color: 'var(--teal)' }}>AI</span>
          </span>
        </div>
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 28 }}>
          Kenya Land Intelligence Platform
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
          {(['signin', 'register'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError('') }} style={{
              flex: 1, padding: '10px', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--gold)' : '2px solid transparent',
              cursor: 'pointer', fontSize: 14, fontFamily: 'DM Sans, sans-serif',
              color: tab === t ? 'var(--gold)' : 'var(--text-tertiary)',
              fontWeight: tab === t ? 600 : 400,
              transition: 'all 0.2s',
            }}>
              {t === 'signin' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
            {error}
          </div>
        )}

        {/* Sign In */}
        {tab === 'signin' && (
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Username or Email
              </label>
              <input
                type="text" value={siUser} onChange={e => setSiUser(e.target.value)}
                placeholder="Enter username or email" required
                className="input-field"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'} value={siPass}
                  onChange={e => setSiPass(e.target.value)}
                  placeholder="Enter password" required
                  className="input-field" style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
                }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', borderRadius: 12, height: 52 }} disabled={isLoading}>
              {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
            </button>
          </form>
        )}

        {/* Register */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Username</label>
              <input type="text" value={regUser} onChange={e => setRegUser(e.target.value)} placeholder="Choose a username" required className="input-field" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Email</label>
              <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="your@email.com" required className="input-field" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
              <input
                type="password" value={regPass}
                onChange={e => onPasswordChange(e.target.value)}
                placeholder="Min 8 chars, upper, lower, digit, special" required
                className="input-field"
              />
              {strength && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: strengthW, background: strength.color, borderRadius: 2, transition: 'width 0.3s, background 0.3s' }} />
                  </div>
                  <p style={{ fontSize: 11, marginTop: 4, color: strength.color }}>{strength.label}</p>
                </div>
              )}
            </div>
            <button type="submit" className="btn-gold" disabled={isLoading}>
              {isLoading ? 'CREATING...' : 'CREATE ACCOUNT'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
