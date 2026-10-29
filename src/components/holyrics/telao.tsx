"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Eye, EyeOff, Maximize2, RefreshCw } from "lucide-react"
import {
  readSavedHolyricsConnection,
  type HolyricsConnection,
} from "@/lib/holyrics-api"

const VIEW_PORT = "80"
const VIEW_PATH = "/view/widescreen" // ajuste se o visualizador do seu Holyrics usar outro caminho

export default function TelaoPage() {
  const [connection, setConnection] = useState<HolyricsConnection | null>(null)
  const [ready, setReady] = useState(false)
  const [showTelao, setShowTelao] = useState(false) 
  const [reloadKey, setReloadKey] = useState(0)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setConnection(readSavedHolyricsConnection())
    setReady(true)
  }, [])

  if (!ready) return null

  const src = connection
    ? `http://${connection.host}${VIEW_PORT === "80" ? "" : `:${VIEW_PORT}`}${VIEW_PATH}`
    : null

  
  return (
    <main className={`telao-page${showTelao ? "" : " is-hidden"}`}>
      <header className="telao-bar">
        <strong>Telão ao vivo</strong>
        <div className="telao-actions">
          <button
            aria-label={showTelao ? "Ocultar telão" : "Exibir telão"}
            aria-pressed={showTelao}
            className={`icon-button${showTelao ? " is-active" : ""}`}
            onClick={() => setShowTelao((visible) => !visible)}
            type="button"
          >
            {showTelao ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </button>
          <button
            aria-label="Recarregar"
            className="icon-button"
            disabled={!src}
            onClick={() => setReloadKey((key) => key + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" />
          </button>
          <button
            aria-label="Tela cheia"
            className="icon-button"
            disabled={!src}
            onClick={() => void frameRef.current?.requestFullscreen()}
            type="button"
          >
            <Maximize2 aria-hidden="true" />
          </button>
          {src ? (
            <a
              aria-label="Abrir em nova aba"
              className="icon-button"
              href={src}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" />
            </a>
          ) : null}
        </div>
      </header>

    {showTelao ? (
        src ? (
            <iframe
            allow="fullscreen; autoplay"
            className="telao-frame"
            key={reloadKey}
            ref={frameRef}
            src={src}
            title="Telão do Holyrics"
            />
        ) : (
            <div className="empty-state">
            <h3>Conexão não configurada</h3>
            <p>Salve o IP do computador nas configurações para ver o telão.</p>
            </div>
        )
        ) : null}

    </main>
  )
}