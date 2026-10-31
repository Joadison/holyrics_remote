"use client"

import { useState } from "react"
import { ArrowLeft, Check, LockKeyhole, PlugZap, ShieldCheck, X } from "lucide-react"
import {
  getHolyricsErrorMessage,
  validateHolyricsConnection,
  type HolyricsConnection,
} from "@/lib/holyrics-api"

export function ConnectionSettings({
  initialConfig,
  onClose,
  onSave,
  onTest,
}: {
  initialConfig: HolyricsConnection | null
  onClose: () => void
  onSave: (connection: HolyricsConnection) => void
  onTest: (connection: HolyricsConnection) => Promise<string>
}) {
  const [host, setHost] = useState(initialConfig?.host ?? "192.168.")
  const [port, setPort] = useState(initialConfig?.port ?? "8091")
  const [replaceToken, setReplaceToken] = useState(!initialConfig?.token)
  const [newToken, setNewToken] = useState("")
  const [error, setError] = useState("")
  const [testResult, setTestResult] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [pending, setPending] = useState<"save" | "test" | "">("")
  const [protocol, setProtocol] = useState<"http" | "https">(initialConfig?.protocol === "https" ? "https" : "http")

  function getCandidateConnection() {
    const token = replaceToken ? newToken : initialConfig?.token ?? ""
    return validateHolyricsConnection(host, port, token, protocol)
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setTestResult(null)
    setPending("save")
    try {
      const connection = getCandidateConnection()
      onSave(connection)
    } catch (saveError) {
      setError(getHolyricsErrorMessage(saveError))
      setPending("")
    }
  }

  async function handleTest() {
    setError("")
    setTestResult(null)
    setPending("test")
    try {
      const connection = getCandidateConnection()
      const message = await onTest(connection)
      setTestResult({ type: "success", message })
    } catch (testError) {
      setTestResult({ type: "error", message: getHolyricsErrorMessage(testError) })
    } finally {
      setPending("")
    }
  }

  return (
    <main className="settings-page">
      <div className="settings-topbar">
        <button className="icon-button" onClick={onClose} type="button" aria-label="Voltar ao painel">
          <ArrowLeft aria-hidden="true" />
        </button>
        <span>Conexão local</span>
        <span className="settings-topbar-spacer" />
      </div>

      <div className="settings-content">
        <div className="settings-title-block">
          <p className="eyebrow">HOLYRICS REMOTE</p>
          <h1>{initialConfig ? "Ajustes da conexão" : "Conecte seu Holyrics"}</h1>
          <p>
            Configure o endereço do computador para controlar o telão pelo celular.
          </p>
        </div>

        <form className="settings-card" onSubmit={handleSave}>
          <div className="settings-card-heading">
            <div className="settings-card-icon"><PlugZap aria-hidden="true" /></div>
            <div>
              <h2>Servidor do Holyrics</h2>
              <p>O computador e o celular precisam estar na mesma rede local.</p>
            </div>
          </div>

          <div className="settings-grid">
            <label className="field-label" htmlFor="holyrics-protocol">
              Protocolo
              <select
                className="field-input"
                id="holyrics-protocol"
                onChange={(event) => setProtocol(event.target.value === "https" ? "https" : "http")}
                value={protocol}
              >
                <option value="http">http (rede local)</option>
                <option value="https">https (túnel seguro / proxy)</option>
              </select>
            </label>
            <label className="field-label" htmlFor="holyrics-host">
              IP ou nome do computador
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="field-input"
                id="holyrics-host"
                inputMode="url"
                onChange={(event) => setHost(event.target.value)}
                placeholder="192.168.0.10"
                required
                spellCheck={false}
                value={host}
              />
            </label>
            <label className="field-label" htmlFor="holyrics-port">
              Porta da API
              <input
                className="field-input"
                id="holyrics-port"
                inputMode="numeric"
                max="65535"
                min="1"
                onChange={(event) => setPort(event.target.value)}
                placeholder="8090"
                required
                type="number"
                value={port}
              />
            </label>
          </div>

          {initialConfig?.token && !replaceToken ? (
            <div className="saved-token-card">
              <div className="saved-token-icon"><LockKeyhole aria-hidden="true" /></div>
              <div className="saved-token-copy">
                <strong>Token guardado neste aparelho</strong>
                <span>Ele será mantido ao salvar alterações de endereço ou porta.</span>
              </div>
              <button
                className="text-action token-change-button"
                onClick={() => {
                  setReplaceToken(true)
                  setNewToken("")
                  setTestResult(null)
                }}
                type="button"
              >
                Trocar token
              </button>
            </div>
          ) : (
            <div className="token-entry">
              <label className="field-label" htmlFor="holyrics-token">
                {initialConfig?.token ? "Novo token de acesso" : "Token de acesso"}
                <input
                  autoComplete="new-password"
                  className="field-input"
                  id="holyrics-token"
                  onChange={(event) => setNewToken(event.target.value)}
                  placeholder="Cole o token do Holyrics"
                  required
                  type="password"
                  value={newToken}
                />
              </label>
              {initialConfig?.token ? (
                <button
                  className="text-action cancel-token-change"
                  onClick={() => {
                    setReplaceToken(false)
                    setNewToken("")
                    setTestResult(null)
                  }}
                  type="button"
                >
                  Manter token atual
                </button>
              ) : null}
            </div>
          )}

          <div className="persistence-note">
            <ShieldCheck aria-hidden="true" />
            <p>
              A conexão fica salva neste navegador. Perder a conexão ou fechar o app não apaga seu token.
            </p>
          </div>

          <div className="settings-actions">
            <button className="button-secondary" disabled={Boolean(pending)} onClick={() => void handleTest()} type="button">
              {pending === "test" ? <span className="spinner-dot" /> : <PlugZap />}
              Testar conexão
            </button>
            <button className="button-primary" disabled={Boolean(pending)} type="submit">
              {pending === "save" ? <span className="spinner-dot spinner-dot-dark" /> : <Check />}
              Salvar conexão
            </button>
          </div>

          {error ? <p className="inline-feedback is-error" role="alert"><X />{error}</p> : null}
          {testResult ? (
            <p className={`inline-feedback is-${testResult.type}`} role="status">
              {testResult.type === "success" ? <Check /> : <X />}
              {testResult.message}
            </p>
          ) : null}
        </form>

        <div className="local-api-note">
          <div className="local-api-note-icon"><ShieldCheck aria-hidden="true" /></div>
          <div>
            <strong>Conexão direta com a rede local</strong>
            <p>
              As chamadas vão do navegador direto ao computador, sem salvar o token no servidor do app. Se o app estiver publicado em HTTPS e a API do Holyrics usar HTTP, o navegador pode bloquear a conexão; nesse caso, use um ambiente local seguro ou habilite HTTPS/CORS na API.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
