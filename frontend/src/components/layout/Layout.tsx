import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Map, BarChart2, Zap, Cpu, History, LogOut, Moon, Sun } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import AuthModal from '../auth/AuthModal'

const NAV = [
  { to: '/',          label: 'Home' },
  { to: '/estimator', label: 'Estimator', icon: Zap },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { to: '/map',       label: 'Map',       icon: Map },
  { to: '/model',     label: 'Model',     icon: Cpu },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const navigate = useNavigate()

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header style={{
        background: 'rgba(10,15,30,0.90)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(12px)',
        position: 'sticky', top: 0, zIndex: 50,
        height: '64px', display: 'flex', alignItems: 'center',
      }}>
        <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => navigate('/')} className="flex items-center gap-3">
            <div style={{
              width: 12, height: 12,
              background: 'var(--gold)',
              transform: 'rotate(45deg)',
              boxShadow: '0 0 10px rgba(212,175,55,0.6)'
            }} />
            <span style={{
              fontFamily: 'Space Mono, monospace',
              fontSize: 16, fontWeight: 700,
              letterSpacing: '3px', color: 'var(--text-primary)'
            }}>
              THAMANI <span style={{ color: 'var(--teal)' }}>AI</span>
            </span>
          </button>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to} to={to}
                style={({ isActive }) => ({
                  fontFamily: 'Space Mono, monospace',
                  fontSize: 12, letterSpacing: '1px',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  color: isActive ? 'var(--gold)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--gold-dim)' : 'transparent',
                  border: isActive ? '1px solid var(--gold-border)' : '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: '9999px', padding: '6px 12px',
                cursor: 'pointer', color: 'var(--text-tertiary)',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11 }}>
                {theme === 'dark' ? 'Light' : 'Dark'}
              </span>
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--gold)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Space Mono, monospace', fontSize: 13, fontWeight: 700,
                  color: '#0A0F1E',
                }}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {user.username}
                </span>
                <button
                  onClick={() => { signOut(); navigate('/') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}
                >
                  <LogOut size={14} />
                </button>
                <NavLink
                  to="/history"
                  style={{ color: 'var(--text-tertiary)', display: 'flex' }}
                >
                  <History size={16} />
                </NavLink>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: 12 }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '20px 24px',
        background: 'var(--bg-surface)',
      }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '2px' }}>
            THAMANI AI · KENYA LAND INTELLIGENCE
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            813 records · 47 counties · MLP ensemble
          </span>
        </div>
      </footer>

      {/* Auth modal */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}
