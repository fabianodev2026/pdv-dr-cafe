import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './LoginScreen.css'

interface LoginScreenProps {
  onLoginSuccess: (userData: any) => void
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!username || !password) {
      setErrorMessage('Preencha usuário e senha.')
      return
    }

    setIsLoading(true)
    setErrorMessage('')

    try {
      const { data, error } = await supabase
        .from('pdv_users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single()

      if (error || !data) {
        setErrorMessage('Usuário ou senha incorretos!')
        setIsLoading(false)
        return
      }

      onLoginSuccess(data)
    } catch (err) {
      setErrorMessage('Erro ao conectar com o servidor.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-glass-box">
        <h2>Acesso ao Sistema</h2>

        <div className="form-group">
          <label>Usuário</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin(e as any)}
            placeholder="Digite seu login"
            autoComplete="off"
          />
        </div>

        <div className="form-group">
          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin(e as any)}
            placeholder="******"
          />
        </div>

        {errorMessage && <p className="error-msg">{errorMessage}</p>}

        <button
          onClick={(e) => handleLogin(e as any)}
          className="btn-login"
          disabled={isLoading}
        >
          {isLoading ? 'Verificando...' : 'Entrar no PDV'}
        </button>
      </div>
    </div>
  )
}
