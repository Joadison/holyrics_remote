"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import useSWR from "swr"
import {
  Activity,
  ArrowRight,
  BookOpen,
  FileText,
  FolderOpen,
  ListMusic,
  LoaderCircle,
  Music2,
  Settings2,
  ShieldCheck,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react"
import { ConnectionSettings } from "@/components/holyrics/connection-settings"
import {
  BiblePanel,
  FilesPanel,
  PraisePanel,
  QuickPanel,
  StageControls,
  TextsPanel,
  type ApiRequest,
  type Presentation,
} from "@/components/holyrics/remote-panels"
import {
  getHolyricsErrorMessage,
  HOLYRICS_STORAGE_KEY,
  readSavedHolyricsConnection,
  requestHolyricsApi,
  type HolyricsConnection,
} from "@/lib/holyrics-api"

type PanelId = "praise" | "texts" | "bible" | "files" | "quick"
type View = "remote" | "settings"
type Notice = { type: "success" | "error"; message: string }
type LogItem = { id: number; time: string; message: string; type: "success" | "error" }

const navigation: { id: PanelId; label: string; icon: ReactNode }[] = [
  { id: "praise", label: "Louvor", icon: <Music2 aria-hidden="true" /> },
  { id: "texts", label: "Textos", icon: <FileText aria-hidden="true" /> },
  { id: "bible", label: "Bíblia", icon: <BookOpen aria-hidden="true" /> },
  { id: "files", label: "Arquivos", icon: <FolderOpen aria-hidden="true" /> },
  { id: "quick", label: "Rápido", icon: <Zap aria-hidden="true" /> },
]

function getHealthVersion(health: unknown) {
  if (!health || typeof health !== "object" || !("version" in health)) return ""
  const version = (health as { version?: unknown }).version
  return typeof version === "string" || typeof version === "number" ? String(version) : ""
}

export function HolyricsRemote() {
  const [isHydrated, setIsHydrated] = useState(false)
  const [connection, setConnection] = useState<HolyricsConnection | null>(null)
  const [view, setView] = useState<View>("remote")
  const [activePanel, setActivePanel] = useState<PanelId>("praise")
  const [notice, setNotice] = useState<Notice | null>(null)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [currentPresentation, setCurrentPresentation] = useState<Presentation | null>(null)

  useEffect(() => {
    setConnection(readSavedHolyricsConnection())
    setIsHydrated(true)
  }, [])

  const connectionKey = isHydrated && connection
    ? [connection.host, connection.port, connection.token] as const
    : null

  const fetchHealth = async ([host, port, token]: readonly [string, string, string]) =>
    requestHolyricsApi({ host, port, token }, "GetTokenInfo", {})

  const {
    data: health,
    error: healthError,
    isLoading: healthLoading,
    mutate: refreshHealth,
  } = useSWR(connectionKey, fetchHealth, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  })

  const addLog = useCallback((message: string, type: LogItem["type"]) => {
    const time = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date())
    setLogs((previous) => [
      { id: Date.now() + Math.random(), time, message, type },
      ...previous,
    ].slice(0, 8))
  }, [])

  const request = useCallback<ApiRequest>(async (action, body = {}) => {
    if (!connection) {
      const error = new Error("Configure a conexão local antes de enviar comandos.")
      setNotice({ type: "error", message: error.message })
      throw error
    }

    try {
      const data = await requestHolyricsApi(connection, action, body)
      addLog(`${action} enviado`, "success")
      setNotice({ type: "success", message: `${action} enviado ao Holyrics.` })
      void refreshHealth().catch(() => undefined)
      return data
    } catch (error) {
      const message = getHolyricsErrorMessage(error)
      addLog(`${action}: ${message}`, "error")
      setNotice({ type: "error", message })
      void refreshHealth().catch(() => undefined)
      throw error
    }
  }, [addLog, connection, refreshHealth])

  function saveConnection(nextConnection: HolyricsConnection) {
    window.localStorage.setItem(HOLYRICS_STORAGE_KEY, JSON.stringify(nextConnection))
    setConnection(nextConnection)
    setView("remote")
    setNotice({ type: "success", message: "Conexão salva neste navegador." })
    addLog("Configuração local salva", "success")
  }

  async function testConnection(candidate: HolyricsConnection) {
    const data = await requestHolyricsApi<Record<string, unknown>>(candidate, "GetTokenInfo", {})
    const version = data && (typeof data.version === "string" || typeof data.version === "number")
      ? ` Versão ${data.version}.`
      : ""
    return `Holyrics respondeu com sucesso.${version}`
  }

  if (!isHydrated) {
    return (
      <main className="app-shell hydration-shell">
        <div aria-label="Carregando Holyrics Remote" className="boot-loader" role="status">
          <div className="brand-mark"><Music2 aria-hidden="true" /></div>
          <LoaderCircle className="spin" />
        </div>
      </main>
    )
  }

  if (view === "settings") {
    return (
      <div className="app-shell settings-shell">
        <ConnectionSettings
          initialConfig={connection}
          onClose={() => setView("remote")}
          onSave={saveConnection}
          onTest={testConnection}
        />
      </div>
    )
  }

  const version = getHealthVersion(health)
  const connectionStatus = !connection
    ? "unconfigured"
    : healthError
      ? "offline"
      : health
        ? "online"
        : "checking"
  const connectionLabel = connectionStatus === "online"
    ? "Conectado"
    : connectionStatus === "checking" || healthLoading
      ? "Verificando"
      : connectionStatus === "offline"
        ? "Sem conexão"
        : "Não configurado"
  const panelProps = {
    request,
    isConfigured: Boolean(connection),
    onOpenSettings: () => setView("settings"),
    onPresented: setCurrentPresentation,
  }

  return (
    <main className="app-shell">
      <header className="remote-header">
        <div className="brand-lockup">
          <div className="brand-mark"><Music2 aria-hidden="true" /></div>
          <div className="brand-copy">
            <span>HOLYRICS</span>
            <strong>REMOTE</strong>
          </div>
        </div>
        <div className="header-actions">
          <div className={`connection-pill is-${connectionStatus}`}>
            <span aria-hidden="true" className="connection-dot" />
            <span>{connectionLabel}</span>
          </div>
          <button
            aria-label="Abrir configurações da conexão"
            className="icon-button header-settings"
            onClick={() => setView("settings")}
            type="button"
          >
            <Settings2 aria-hidden="true" />
          </button>
        </div>
      </header>

      {connectionStatus === "offline" ? (
        <div className="connection-alert" role="status">
          <WifiOff aria-hidden="true" />
          <div>
            <strong>Sem resposta do computador</strong>
            <p>Seu token continua salvo. Confira a rede e tente novamente.</p>
          </div>
          <button
            aria-label="Testar conexão novamente"
            className="icon-button small-icon-button"
            onClick={() => void refreshHealth()}
            type="button"
          >
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {!connection ? (
        <section className="connect-banner">
          <div className="connect-banner-icon"><Wifi aria-hidden="true" /></div>
          <div className="connect-banner-copy">
            <p className="eyebrow">PRIMEIRO ACESSO</p>
            <h2>Conecte ao computador</h2>
            <p>Salve o IP e o token uma vez. Eles ficam neste navegador até você escolher trocar o token.</p>
          </div>
          <button className="button-primary connect-banner-button" onClick={() => setView("settings")} type="button">
            Configurar <ArrowRight aria-hidden="true" />
          </button>
        </section>
      ) : null}

      {notice ? (
        <div className={`notice-banner is-${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>
          <span>{notice.message}</span>
          <button aria-label="Fechar aviso" className="notice-close" onClick={() => setNotice(null)} type="button">
            <X aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="remote-tabs-wrap">
        <nav aria-label="Áreas de controle" className="remote-tabs" role="tablist">
          {navigation.map(({ id, label, icon }) => (
            <button
              aria-selected={activePanel === id}
              className={`remote-tab${activePanel === id ? " is-active" : ""}`}
              key={id}
              onClick={() => setActivePanel(id)}
              role="tab"
              type="button"
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="workspace-layout">
        <div className="workspace-main">
          {/* <section aria-label="Última ação enviada" className="presentation-card">
            <div className="presentation-indicator"><span /></div>
            <div className="presentation-copy">
              <p className="eyebrow">ÚLTIMA AÇÃO ENVIADA</p>
              {currentPresentation ? (
                <>
                  <h2>{currentPresentation.title}</h2>
                  <span>{currentPresentation.type}</span>
                </>
              ) : (
                <>
                  <h2>Nenhuma apresentação enviada</h2>
                  <span>Escolha um conteúdo para começar.</span>
                </>
              )}
            </div>
            <div className="presentation-status">
              <span className={`presentation-status-dot is-${connectionStatus}`} />
              {connectionStatus === "online" ? "Pronto" : connectionStatus === "offline" ? "Offline" : "Local"}
            </div>
          </section> */}

          {activePanel === "praise" ? <PraisePanel {...panelProps} /> : null}
          {activePanel === "texts" ? <TextsPanel {...panelProps} /> : null}
          {activePanel === "bible" ? <BiblePanel {...panelProps} /> : null}
          {activePanel === "files" ? <FilesPanel {...panelProps} /> : null}
          {activePanel === "quick" ? <QuickPanel {...panelProps} /> : null}
        </div>

        <aside aria-label="Resumo da conexão e controles" className="workspace-aside">
          {/* <section className="aside-card connection-card">
            <div className="aside-card-heading">
              <div className="aside-icon"><Activity aria-hidden="true" /></div>
              <div><p className="eyebrow">STATUS</p><h2>Conexão local</h2></div>
            </div>
            <div className="connection-detail">
              <span className={`connection-detail-dot is-${connectionStatus}`} />
              <div>
                <strong>{connectionLabel}</strong>
                <span>{connection ? `${connection.host}:${connection.port}` : "Configure um computador"}</span>
              </div>
            </div>
            {version ? <p className="version-note">Holyrics versão {version}</p> : null}
            {connectionStatus === "offline" ? (
              <p className="offline-note">A configuração não foi removida. O app tentará novamente automaticamente.</p>
            ) : null}
            <div className="aside-actions">
              <button className="button-secondary button-full" onClick={() => setView("settings")} type="button">
                <Settings2 /> {connection ? "Configurar conexão" : "Conectar Holyrics"}
              </button>
              {connection ? (
                <button className="quiet-action" onClick={() => void refreshHealth()} type="button">
                  <Wifi /> Testar agora
                </button>
              ) : null}
            </div>
          </section> */}

          {/* <section className="aside-card stage-card">
            <div className="aside-card-heading">
              <div className="aside-icon"><ListMusic aria-hidden="true" /></div>
              <div><p className="eyebrow">TELÃO</p><h2>Controles rápidos</h2></div>
            </div>
            <p className="aside-description">Navegue pela apresentação atual sem sair da tela.</p>
            <StageControls
              compact
              isConfigured={Boolean(connection)}
              onClosed={() => setCurrentPresentation({ title: "Apresentação encerrada", type: "Controle" })}
              request={request}
            />
          </section> */}

          <details className="aside-card activity-card">
            <summary>
              <div className="aside-card-heading">
                <div className="aside-icon"><ShieldCheck aria-hidden="true" /></div>
                <div><p className="eyebrow">SESSÃO</p><h2>Atividade recente</h2></div>
              </div>
              <span className="activity-chevron"><ArrowRight aria-hidden="true" /></span>
            </summary>
            {logs.length ? (
              <ul className="activity-list">
                {logs.map((log) => (
                  <li className={`activity-item is-${log.type}`} key={log.id}>
                    <span className="activity-time">{log.time}</span>
                    <span>{log.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="activity-empty">As ações enviadas aparecerão aqui.</p>
            )}
          </details>
        </aside>
      </div>

      <nav aria-label="Navegação principal" className="mobile-bottom-nav" role="tablist">
        {navigation.map(({ id, label, icon }) => (
          <button
            aria-selected={activePanel === id}
            className={`bottom-nav-item${activePanel === id ? " is-active" : ""}`}
            key={id}
            onClick={() => setActivePanel(id)}
            role="tab"
            type="button"
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <footer className="app-footer">
        <span>Holyrics Remote</span>
        <span><ShieldCheck aria-hidden="true" /> Token armazenado somente neste navegador</span>
      </footer>
    </main>
  )
}
