import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './LoginScreen.css'

interface PdvUser {
  username: string
  role: string
}

interface LoginScreenProps {
  onLoginSuccess: (userData: PdvUser) => void
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim() || !password) {
      setErrorMessage('Preencha usuario e senha.')
      return
    }

    setIsLoading(true)
    setErrorMessage('')

    try {
      const { data, error } = await supabase.rpc('login_pdv_user', {
        p_username: username.trim(),
        p_password: password,
      })

      if (error) {
        console.error('Erro no login:', error)
        setErrorMessage(
          error.code === '42883'
            ? 'Login nao configurado no Supabase. Execute o SQL da funcao login_pdv_user.'
            : 'Erro ao validar login no Supabase.',
        )
        return
      }

      const user = Array.isArray(data) ? data[0] : data

      if (!user) {
        setErrorMessage('Usuario ou senha incorretos!')
        return
      }

      onLoginSuccess({
        username: user.username ?? user['nome de usuário'] ?? user.nome_usuario,
        role: user.role ?? user.papel ?? user.funcao ?? user['função'],
      })
    } catch (err) {
      setErrorMessage('Erro ao conectar com o servidor.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-wrapper">
      <form className="login-glass-box" onSubmit={handleLogin}>
        <img src="/logo.jpeg" alt="Dr. Cafe" className="login-logo" />
        <h2>Acesso ao Sistema</h2>

        <div className="form-group">
          <label>Usuario</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Digite seu login"
            autoComplete="username"
            maxLength={15}
          />
        </div>

        <div className="form-group">
          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="******"
            autoComplete="current-password"
            maxLength={15}
          />
        </div>

        {errorMessage && <p className="error-msg">{errorMessage}</p>}

        <button type="submit" className="btn-login" disabled={isLoading}>
          {isLoading ? 'Verificando...' : 'Entrar no PDV'}
        </button>
      </form>
    </div>
  )
}
