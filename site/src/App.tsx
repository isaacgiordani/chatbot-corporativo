import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { appConfig } from './config'
import {
  completePasswordReset,
  confirmUserSignUp,
  getSignedInUser,
  login,
  logout,
  registerUser,
  resendUserSignUpCode,
  requestPasswordReset,
  type AppUser,
} from './services/auth'
import { useChatSocket, type ConnectionState } from './hooks/useChatSocket'
import type { ChatMessage } from './types'

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Olá! Sou o assistente virtual. Posso ajudar com dúvidas, compartilhar informações e orientar você. O que gostaria de saber?',
  createdAt: new Date(),
}

const SUGGESTIONS = [
  'Tirar uma dúvida',
  'Conhecer os serviços',
  'Falar com a equipe',
]

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand${compact ? ' brand--compact' : ''}`} aria-label={appConfig.name}>
      <span className="brand-mark" aria-hidden="true">
        <Bot size={24} strokeWidth={2} />
      </span>
      <span className="brand-name">{appConfig.name}</span>
    </div>
  )
}

function translateAuthError(error: unknown) {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''
  if (name === 'NotAuthorizedException') return 'E-mail ou senha incorretos.'
  if (name === 'UserNotFoundException') return 'Não encontramos uma conta com esse e-mail.'
  if (name === 'UserNotConfirmedException') return 'Sua conta ainda precisa ser confirmada.'
  if (name === 'LimitExceededException') return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (name === 'CodeMismatchException') return 'O código informado não é válido.'
  if (name === 'ExpiredCodeException') return 'Esse código expirou. Solicite um novo código.'
  if (name === 'InvalidPasswordException') return 'A senha deve ter no mínimo 8 caracteres, incluindo uma letra maiúscula, uma letra minúscula, um número e um caractere especial.'
  if (name === 'UsernameExistsException') return 'Já existe uma conta cadastrada com esse e-mail.'
  if (name === 'AliasExistsException') return 'Este e-mail já está associado a outra conta.'
  if (name === 'InvalidParameterException') return 'Revise os dados informados e tente novamente.'
  return message || 'Não foi possível concluir a solicitação. Tente novamente.'
}

type AuthMode = 'login' | 'signup' | 'confirm-signup' | 'forgot' | 'confirm-reset'

function LoginScreen({ onAuthenticated }: { onAuthenticated: (user: AppUser) => void }) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!appConfig.cognito.isConfigured) {
      setError('Configure o Cognito no arquivo .env para entrar com uma conta real.')
      return
    }
    setIsSubmitting(true)
    try {
      const user = await login(email, password, remember)
      onAuthenticated(user)
    } catch (caughtError) {
      if (caughtError instanceof Error && caughtError.name === 'UserNotConfirmedException') {
        setNotice('Confirme sua conta com o código enviado pelo Cognito.')
        setMode('confirm-signup')
        return
      }
      setError(translateAuthError(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!appConfig.cognito.isConfigured) {
      setError('Configure o Cognito no arquivo .env para recuperar uma senha.')
      return
    }
    setIsSubmitting(true)
    try {
      await requestPasswordReset(email)
      setNotice(`Enviamos um código de verificação para ${email}.`)
      setMode('confirm-reset')
    } catch (caughtError) {
      setError(translateAuthError(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!appConfig.cognito.isConfigured) {
      setError('Configure o Cognito no arquivo .env para criar uma conta real.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas informadas não são iguais.')
      return
    }
    setIsSubmitting(true)
    try {
      const result = await registerUser(email, password, name)
      setCode('')
      if (result.isSignUpComplete) {
        setNotice('Conta criada. Você já pode entrar.')
        setMode('login')
      } else {
        setNotice(`Enviamos um código de confirmação para ${email}.`)
        setMode('confirm-signup')
      }
    } catch (caughtError) {
      setError(translateAuthError(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConfirmSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const result = await confirmUserSignUp(email, code)
      if (!result.isSignUpComplete) throw new Error('O Cognito ainda exige uma etapa adicional de confirmação.')
      setCode('')
      setConfirmPassword('')
      setNotice('Conta confirmada. Entre com seu e-mail e senha.')
      setMode('login')
    } catch (caughtError) {
      setError(translateAuthError(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleResendSignUpCode() {
    setError('')
    setIsSubmitting(true)
    try {
      await resendUserSignUpCode(email)
      setNotice(`Enviamos um novo código para ${email}.`)
    } catch (caughtError) {
      setError(translateAuthError(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConfirmPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await completePasswordReset(email, code, newPassword)
      setPassword('')
      setCode('')
      setNewPassword('')
      setNotice('Senha atualizada. Você já pode entrar com a nova senha.')
      setMode('login')
    } catch (caughtError) {
      setError(translateAuthError(caughtError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDemoLogin() {
    setError('')
    setIsSubmitting(true)
    await new Promise((resolve) => window.setTimeout(resolve, 350))
    onAuthenticated({ id: 'demo-user', email: 'visitante@demo.local', name: 'Visitante' })
    setIsSubmitting(false)
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <BrandMark />
        <div className="login-card">
          {mode === 'login' ? (
            <>
              <div className="eyebrow"><span /> Assistente virtual</div>
              <h1>Que bom ter você<br />de volta.</h1>
              <p className="intro">Entre para continuar sua conversa com o nosso assistente.</p>
              <form onSubmit={handleLogin}>
                <label htmlFor="email">E-mail</label>
                <div className="field">
                  <input id="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" placeholder="voce@exemplo.com" required />
                </div>
                <label htmlFor="password">Senha</label>
                <div className="field password-field">
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Digite sua senha" required />
                  <button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
                <div className="form-options">
                  <label className="check-label">
                    <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                    <span className="checkbox" aria-hidden="true">{remember && <Check size={13} strokeWidth={3} />}</span>
                    Lembrar de mim
                  </label>
                  <button type="button" className="text-button" onClick={() => changeMode('forgot')}>Esqueci minha senha</button>
                </div>
                {error && <div className="form-feedback form-feedback--error" role="alert">{error}</div>}
                {notice && <div className="form-feedback form-feedback--success" role="status">{notice}</div>}
                <button className="primary-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <LoaderCircle className="spin" size={20} /> : <>Entrar <ArrowRight size={19} /></>}
                </button>
              </form>
              {appConfig.demoEnabled && (
                <>
                  <div className="divider"><span />ou<span /></div>
                  <button className="secondary-button" type="button" onClick={handleDemoLogin} disabled={isSubmitting}>
                    <Sparkles size={18} /> Acessar demonstração
                  </button>
                </>
              )}
              <p className="auth-switch">Ainda não tem uma conta? <button type="button" onClick={() => changeMode('signup')}>Criar conta</button></p>
              <div className="secure-note"><LockKeyhole size={15} /> Seus dados estão protegidos</div>
            </>
          ) : mode === 'signup' ? (
            <>
              <button className="back-button" type="button" onClick={() => changeMode('login')}><ArrowLeft size={18} /> Voltar ao login</button>
              <div className="reset-icon"><UserRound size={24} /></div>
              <h1 className="reset-title">Crie sua conta.</h1>
              <p className="intro">Cadastre-se para acessar o atendimento e manter suas conversas protegidas.</p>
              <form onSubmit={handleSignUp}>
                <label htmlFor="signup-name">Nome</label>
                <div className="field"><input id="signup-name" type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Seu nome" required /></div>
                <label htmlFor="signup-email">E-mail</label>
                <div className="field"><input id="signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="voce@exemplo.com" required /></div>
                <label htmlFor="signup-password">Senha</label>
                <div className="field password-field">
                  <input id="signup-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" minLength={8} required />
                  <button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button>
                </div>
                <p className="password-requirements">Use 8 ou mais caracteres, com maiúscula, minúscula, número e caractere especial.</p>
                <label htmlFor="signup-confirm-password">Confirmar senha</label>
                <div className="field"><input id="signup-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Repita sua senha" minLength={8} required /></div>
                {error && <div className="form-feedback form-feedback--error" role="alert">{error}</div>}
                <button className="primary-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <LoaderCircle className="spin" size={20} /> : <>Criar conta <ArrowRight size={19} /></>}
                </button>
              </form>
            </>
          ) : mode === 'confirm-signup' ? (
            <>
              <button className="back-button" type="button" onClick={() => changeMode('signup')}><ArrowLeft size={18} /> Voltar ao cadastro</button>
              <div className="reset-icon"><ShieldCheck size={24} /></div>
              <h1 className="reset-title">Confirme sua conta.</h1>
              <p className="intro">Digite o código enviado pelo Cognito para <strong>{email}</strong>.</p>
              <form onSubmit={handleConfirmSignUp}>
                {notice && <div className="form-feedback form-feedback--info" role="status">{notice}</div>}
                <label htmlFor="signup-code">Código de confirmação</label>
                <div className="field"><input id="signup-code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" placeholder="000000" required /></div>
                {error && <div className="form-feedback form-feedback--error" role="alert">{error}</div>}
                <button className="primary-button" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <LoaderCircle className="spin" size={20} /> : <>Confirmar conta <ArrowRight size={19} /></>}
                </button>
                <button className="resend-button" type="button" onClick={handleResendSignUpCode} disabled={isSubmitting}>Reenviar código</button>
              </form>
            </>
          ) : (
            <>
              <button className="back-button" type="button" onClick={() => changeMode('login')}><ArrowLeft size={18} /> Voltar ao login</button>
              <div className="reset-icon"><KeyRound size={24} /></div>
              <h1 className="reset-title">{mode === 'forgot' ? 'Recupere sua senha.' : 'Crie uma nova senha.'}</h1>
              <p className="intro">
                {mode === 'forgot'
                  ? 'Informe o e-mail cadastrado para receber um código de verificação.'
                  : 'Digite o código recebido e escolha uma nova senha para sua conta.'}
              </p>
              {mode === 'forgot' ? (
                <form onSubmit={handleForgotPassword}>
                  <label htmlFor="reset-email">E-mail</label>
                  <div className="field"><input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="voce@exemplo.com" required /></div>
                  {error && <div className="form-feedback form-feedback--error" role="alert">{error}</div>}
                  <button className="primary-button" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <LoaderCircle className="spin" size={20} /> : <>Enviar código <ArrowRight size={19} /></>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmPassword}>
                  {notice && <div className="form-feedback form-feedback--info" role="status">{notice}</div>}
                  <label htmlFor="code">Código de verificação</label>
                  <div className="field"><input id="code" inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" placeholder="000000" required /></div>
                  <label htmlFor="new-password">Nova senha</label>
                  <div className="field"><input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" minLength={8} required /></div>
                  <p className="password-requirements">Use 8 ou mais caracteres, com maiúscula, minúscula, número e caractere especial.</p>
                  {error && <div className="form-feedback form-feedback--error" role="alert">{error}</div>}
                  <button className="primary-button" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <LoaderCircle className="spin" size={20} /> : <>Atualizar senha <ArrowRight size={19} /></>}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
        <footer>© 2026 {appConfig.name} <span /> Privacidade <span /> Termos de uso</footer>
      </section>

      <aside className="visual-panel" aria-label={`Atendimento digital ${appConfig.name}`}>
        <div className="visual-grid" />
        <div className="visual-glow visual-glow-one" />
        <div className="visual-glow visual-glow-two" />
        <div className="visual-content">
          <div className="availability"><span /> Disponível agora</div>
          <blockquote>“Boas respostas começam com uma boa conversa.”</blockquote>
          <p>Tire dúvidas, explore informações e encontre o próximo passo em uma conversa simples e segura.</p>
          <div className="assistant-preview">
            <div className="assistant-icon"><Bot size={21} /></div>
            <div><span>{appConfig.name}</span><strong>Olá! Como posso ajudar você hoje?</strong></div>
            <span className="typing"><i /><i /><i /></span>
          </div>
        </div>
        <div className="conversation-art" aria-hidden="true">
          <svg className="conversation-art-ribbons" viewBox="0 0 900 430" fill="none" preserveAspectRatio="xMidYMid slice">
            <path className="conversation-ribbon conversation-ribbon--blue" d="M-30 310C117 310 116 97 281 130C418 157 342 330 507 300C639 276 663 111 934 104" />
            <path className="conversation-ribbon conversation-ribbon--cyan" d="M-41 353C120 353 161 187 279 189C405 191 403 353 552 354C685 355 740 218 943 208" />
            <path className="conversation-ribbon conversation-ribbon--violet" d="M-24 268C115 268 157 50 316 70C473 90 462 245 579 250C719 257 753 139 934 150" />
            <circle className="conversation-orb conversation-orb--one" cx="280" cy="189" r="8" />
            <circle className="conversation-orb conversation-orb--two" cx="552" cy="354" r="6" />
            <circle className="conversation-orb conversation-orb--three" cx="579" cy="250" r="5" />
          </svg>
          <span className="conversation-word conversation-word--one">escutar</span>
          <span className="conversation-word conversation-word--two">perguntar</span>
          <span className="conversation-word conversation-word--three">responder</span>
          <span className="conversation-caption">toda conversa abre caminhos</span>
        </div>
      </aside>
    </main>
  )
}

function connectionLabel(state: ConnectionState) {
  if (state === 'connected') return 'Conectado'
  if (state === 'connecting') return 'Conectando…'
  if (state === 'demo') return 'Modo demonstração'
  return 'Reconectando…'
}

function mockReply(message: string) {
  if (!message.trim()) return 'Olá! Como posso ajudar você hoje?'
  return 'Entendi. Conte um pouco mais para que eu possa orientar você.'
}

function ChatScreen({ user, onLogout }: { user: AppUser; onLogout: () => Promise<void> }) {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [draft, setDraft] = useState('')
  const [sendError, setSendError] = useState('')
  const [isAssistantTyping, setIsAssistantTyping] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID())

  const { state: connectionState, send: sendToSocket, reconnect } = useChatSocket({
    conversationId,
    enabled: user.id !== 'demo-user',
    onMessage: (content) => {
      setIsAssistantTyping(false)
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content, createdAt: new Date() }])
    },
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAssistantTyping])

  function newConversation() {
    setMessages([{ ...INITIAL_MESSAGE, id: crypto.randomUUID(), createdAt: new Date() }])
    setConversationId(crypto.randomUUID())
    setDraft('')
    setSendError('')
    setSidebarOpen(false)
  }

  function submitMessage(content: string): boolean {
    const cleanContent = content.trim()
    if (!cleanContent || isAssistantTyping) return false
    setSendError('')
    if (user.id === 'demo-user') {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: cleanContent, createdAt: new Date() }])
      setDraft('')
      setIsAssistantTyping(true)
      window.setTimeout(() => {
        setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: mockReply(cleanContent), createdAt: new Date() }])
        setIsAssistantTyping(false)
      }, 850)
      return true
    }

    if (!sendToSocket(cleanContent)) {
      setSendError('Mensagem não enviada. Aguarde a conexão com o assistente e tente novamente.')
      return false
    }
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: cleanContent, createdAt: new Date() }])
    setDraft('')
    setIsAssistantTyping(true)
    return true
  }

  useEffect(() => {
    if (!document.modelContext?.registerTool) return
    const lifecycle = new AbortController()

    void Promise.resolve(document.modelContext.registerTool({
      name: 'send_support_message',
      title: 'Enviar mensagem ao suporte',
      description: 'Envia uma nova mensagem na conversa visível com o assistente virtual.',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string', minLength: 1, maxLength: 4000 } },
        required: ['message'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const message = typeof input === 'object' && input !== null && 'message' in input
          ? (input as { message?: unknown }).message
          : undefined
        if (typeof message !== 'string' || !message.trim()) throw new Error('A mensagem é obrigatória.')
        if (message.length > 4000) throw new Error('A mensagem deve ter no máximo 4.000 caracteres.')
        if (isAssistantTyping) throw new Error('Aguarde a resposta atual antes de enviar outra mensagem.')
        if (!submitMessage(message)) throw new Error('A mensagem não foi enviada. Confira a conexão com o assistente.')
        return { status: 'sent', conversationId }
      },
    }, { signal: lifecycle.signal })).catch(() => undefined)

    return () => lifecycle.abort()
  }, [conversationId, isAssistantTyping])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitMessage(draft)
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submitMessage(draft)
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true)
    await onLogout()
  }

  const initials = (user.name || user.email).split(/\s|@/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')

  return (
    <main className="chat-shell">
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`chat-sidebar${sidebarOpen ? ' chat-sidebar--open' : ''}`}>
        <div className="sidebar-header">
          <BrandMark compact />
          <button className="mobile-close" type="button" aria-label="Fechar menu" onClick={() => setSidebarOpen(false)}><X size={21} /></button>
        </div>
        <button className="new-chat-button" type="button" onClick={newConversation}><Plus size={18} /> Nova conversa</button>
        <nav className="conversation-list" aria-label="Conversas">
          <span className="sidebar-label">Hoje</span>
          <button className="conversation-item conversation-item--active" type="button">
            <MessageSquareText size={18} />
            <span><strong>Conversa inicial</strong><small>{messages.at(-1)?.content || 'Nova conversa'}</small></span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-help"><span><CircleHelp size={18} /></span><div><strong>Precisa de mais ajuda?</strong><small>Entre em contato com nossa equipe</small></div></div>
          <p>Suas conversas são protegidas e tratadas com segurança.</p>
        </div>
      </aside>

      <section className="chat-main">
        <header className="chat-header">
          <button className="menu-button" type="button" aria-label="Abrir menu" onClick={() => setSidebarOpen(true)}><Menu size={22} /></button>
          <div className="chat-identity">
            <div className="bot-avatar"><Bot size={21} /></div>
            <div><strong>Assistente virtual</strong><span className={`connection-state connection-state--${connectionState}`}><i /> {connectionLabel(connectionState)}</span></div>
          </div>
          <div className="profile-area">
            <button className="profile-button" type="button" onClick={() => setIsProfileOpen((value) => !value)} aria-expanded={isProfileOpen}>
              <span className="user-avatar">{initials || <UserRound size={17} />}</span>
              <span className="profile-copy"><strong>{user.name || 'Minha conta'}</strong><small>{user.email}</small></span>
              <ChevronDown size={16} />
            </button>
            {isProfileOpen && (
              <div className="profile-menu">
                <div><strong>{user.name || 'Minha conta'}</strong><small>{user.email}</small></div>
                <button type="button" onClick={handleLogout} disabled={isLoggingOut}>{isLoggingOut ? <LoaderCircle className="spin" size={17} /> : <LogOut size={17} />} Sair</button>
              </div>
            )}
          </div>
        </header>

        {(connectionState === 'disconnected' || connectionState === 'error') && appConfig.websocket.isConfigured && (
          <div className="connection-banner" role="status">A conexão foi interrompida. Tentaremos novamente automaticamente.<button type="button" onClick={reconnect}><RefreshCw size={15} /> Reconectar</button></div>
        )}

        <div className="chat-scroll" aria-live="polite">
          <div className="messages">
            <div className="chat-date"><span>Hoje</span></div>
            {messages.map((message) => (
              <article className={`message message--${message.role}`} key={message.id}>
                {message.role === 'assistant' && <div className="message-avatar"><Bot size={19} /></div>}
                <div className="message-content">
                  <div className="message-bubble">{message.content}</div>
                  <time>{message.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
                </div>
              </article>
            ))}
            {messages.length === 1 && (
              <div className="suggestions" aria-label="Sugestões">
                {SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => submitMessage(suggestion)}>{suggestion}<ArrowRight size={16} /></button>)}
              </div>
            )}
            {isAssistantTyping && (
              <article className="message message--assistant">
                <div className="message-avatar"><Bot size={19} /></div>
                <div className="message-content"><div className="message-bubble typing-bubble" aria-label="O assistente está digitando"><i /><i /><i /></div></div>
              </article>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="composer-wrap">
          {sendError && <div className="form-feedback form-feedback--error send-error" role="alert">{sendError}</div>}
          <form className="composer" onSubmit={handleSubmit}>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="Digite sua mensagem…" aria-label="Mensagem" rows={1} />
            <button type="submit" aria-label="Enviar mensagem" disabled={!draft.trim() || isAssistantTyping}><Send size={19} /></button>
          </form>
          <p>O assistente pode cometer erros. Confirme informações importantes com nossa equipe.</p>
        </div>
      </section>
    </main>
  )
}

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  useEffect(() => {
    getSignedInUser().then(setUser).finally(() => setIsRestoringSession(false))
  }, [])

  async function handleLogout() {
    await logout()
    setUser(null)
  }

  if (isRestoringSession) {
    return <main className="app-loading"><BrandMark /><LoaderCircle className="spin" size={24} /></main>
  }
  return user ? <ChatScreen user={user} onLogout={handleLogout} /> : <LoginScreen onAuthenticated={setUser} />
}
