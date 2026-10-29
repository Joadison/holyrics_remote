"use client"

import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react"
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Music2,
  Play,
  Search,
  Send,
  Video,
  Volume2,
  X,
  Zap,
} from "lucide-react"
import { getHolyricsErrorMessage } from "@/lib/holyrics-api"

export type ApiRequest = (
  action: string,
  body?: Record<string, unknown>,
) => Promise<unknown>

export type Presentation = {
  title: string
  type: string
}

type SharedPanelProps = {
  request: ApiRequest
  isConfigured: boolean
  onOpenSettings: () => void
  onPresented: (presentation: Presentation) => void
  currentThemeId?: string | null
}

type Song = {
  id: string | number
  title?: string
  artist?: string
  groups?: string[] | string
}

type TextItem = {
  id: string | number
  title?: string
  folder?: string
}

type MediaFile = {
  name: string
  length?: number
  isDir?: boolean
}

type SearchBarProps = {
  value: string
  placeholder: string
  disabled: boolean
  busy: boolean
  onChange: (value: string) => void
  onSearch: () => void
}

function SearchBar({
  value,
  placeholder,
  disabled,
  busy,
  onChange,
  onSearch,
}: SearchBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSearch()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      event.key === "Enter" &&
      (event.nativeEvent.isComposing || event.keyCode === 229)
    ) {
      event.preventDefault()
    }
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit} role="search">
      <Search aria-hidden="true" className="search-leading-icon" />
      <input
        aria-label={placeholder}
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      <button
        aria-label="Buscar"
        className="search-submit"
        disabled={disabled || busy}
        type="submit"
      >
        {busy ? <LoaderCircle className="spin" /> : <Search />}
      </button>
    </form>
  )
}

function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && onAction ? (
        <button className="text-action" onClick={onAction} type="button">
          {action} <ArrowRight aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

function PanelIntro({
  eyebrow,
  id,
  title,
  description,
  icon,
}: {
  eyebrow: string
  id: string
  title: string
  description: string
  icon: ReactNode
}) {
  return (
    <div className="panel-intro">
      <div className="panel-icon">{icon}</div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        <p className="panel-description">{description}</p>
      </div>
    </div>
  )
}

export function StageControls({
  request,
  isConfigured,
  onClosed,
  compact = false,
}: {
  request: ApiRequest
  isConfigured: boolean
  onClosed?: () => void
  compact?: boolean
}) {
  const [pendingAction, setPendingAction] = useState("")

  async function run(action: string) {
    setPendingAction(action)
    try {
      await request(action)
      if (action === "CloseCurrentPresentation") onClosed?.()
    } catch {
      // O painel principal apresenta o erro e o mantém no histórico de atividade.
    } finally {
      setPendingAction("")
    }
  }

  return (
    <div className={`stage-controls${compact ? " stage-controls-compact" : ""}`}>
      <button
        aria-label="Apresentação anterior"
        className="control-button"
        disabled={!isConfigured || Boolean(pendingAction)}
        onClick={() => void run("ActionPrevious")}
        type="button"
      >
        {pendingAction === "ActionPrevious" ? (
          <LoaderCircle className="spin" />
        ) : (
          <ArrowLeft />
        )}
        <span>Anterior</span>
      </button>
      <button
        aria-label="Próxima apresentação"
        className="control-button"
        disabled={!isConfigured || Boolean(pendingAction)}
        onClick={() => void run("ActionNext")}
        type="button"
      >
        {pendingAction === "ActionNext" ? (
          <LoaderCircle className="spin" />
        ) : (
          <ArrowRight />
        )}
        <span>Próximo</span>
      </button>
      <button
        className="control-button control-button-danger"
        disabled={!isConfigured || Boolean(pendingAction)}
        onClick={() => void run("CloseCurrentPresentation")}
        type="button"
      >
        {pendingAction === "CloseCurrentPresentation" ? (
          <LoaderCircle className="spin" />
        ) : (
          <X />
        )}
      </button>
    </div>
  )
}

export function PraisePanel(props: SharedPanelProps) {
  type ValidSlide = { text: string; originalIndex: number }

  const { request, isConfigured, onOpenSettings, onPresented, currentThemeId } = props

  // Busca
  const [query, setQuery] = useState("")
  const [songs, setSongs] = useState<Song[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState("")

  // Música aberta (modo player)
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [slides, setSlides] = useState<ValidSlide[]>([])
  const [isLoadingSlides, setIsLoadingSlides] = useState(false)
  const [slidesError, setSlidesError] = useState("")
  const [liveIndex, setLiveIndex] = useState<number | null>(null) // posição em `slides`
  const [pending, setPending] = useState("") // "start" | "next" | "prev" | "close" | "slide-N"
  const [backgroundPending, setBackgroundPending] = useState(false)

  const busy = pending !== ""

  // Mantém o slide ao vivo visível na tela
  useEffect(() => {
    if (liveIndex === null) return
    document
      .getElementById(`praise-slide-${liveIndex}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [liveIndex])

  async function searchSongs() {
    if (!isConfigured) return
    setIsSearching(true)
    setHasSearched(true)
    setError("")
    try {
      const data = await request("SearchSong", {
        text: query.trim(),
        title: true,
        artist: true,
        note: true,
        lyrics: false,
        fields: "id,title,artist,groups",
      })
      setSongs(Array.isArray(data) ? (data as Song[]) : [])
    } catch (requestError) {
      setSongs([])
      setError(getHolyricsErrorMessage(requestError))
    } finally {
      setIsSearching(false)
    }
  }

  function normalizeSlides(rawSlides: { text?: string }[]) {
    const cleaned = rawSlides
      .map((slide, originalIndex) => ({
        text: (slide.text ?? "").trim(),
        originalIndex,
      }))
      .filter((s) => s.text.length > 0)

    return {
      title: cleaned[0]?.text ?? "",
      slides: cleaned,
    }
  }

  async function openSong(song: Song) {
    setSelectedSong(song)
    setSlides([])
    setSlidesError("")
    setLiveIndex(null)
    setIsLoadingSlides(true)

    try {
      const data = await request("GetSong", {
        id: song.id,
        fields: "id,title,slides",
      })
      const normalized = normalizeSlides(
        (data as { slides?: { text?: string }[] })?.slides ?? [],
      )
      setSlides(normalized.slides) // ✅ agora envia só o array
    } catch {
      try {
        const fallback = await request("GetLyrics", { id: song.id })
        const normalized = normalizeSlides(
          (fallback as { slides?: { text?: string }[] })?.slides ?? [],
        )
        setSlides(normalized.slides)
      } catch (secondError) {
        setSlidesError(getHolyricsErrorMessage(secondError))
      }
    } finally {
      setIsLoadingSlides(false)
    }
  }

  function backToSearch() {
    setSelectedSong(null)
    setSlides([])
    setSlidesError("")
    setLiveIndex(null)
  }

  const songTitle = selectedSong?.title?.trim() || "Música sem título"

  async function showFromStart() {
    if (!selectedSong) return
    setPending("start")
    try {
      if (currentThemeId) {
        await request("SetInterfaceInput", {
          id: "main_selected_theme",
          value: currentThemeId, // Theme ID
        })
      }
      await request("ShowSong", { id: selectedSong.id })
      setLiveIndex(slides.length > 0 ? 0 : null)
      onPresented({ title: songTitle, type: "Louvor" })
    } catch {
      // erro reportado pelo estado global
    } finally {
      setPending("")
    }
  }

  async function showSlide(position: number) {
    if (!selectedSong) return
    const slide = slides[position]
    if (!slide) return

    setPending(`slide-${position}`)
    try {
      await request("ShowSong", {
        id: selectedSong.id,
        initial_index: position + 1,
      })
      setLiveIndex(position)
      onPresented({ title: `${songTitle} · slide ${position + 1}`, type: "Louvor" })
    } catch {
      // ...
    } finally {
      setPending("")
    }
  }

  async function navigate(direction: "next" | "prev") {
    setPending(direction)
    try {
      await request(direction === "next" ? "ActionNext" : "ActionPrevious")
      setLiveIndex((current) => {
        if (slides.length === 0) return current
        if (direction === "next") {
          return Math.min((current ?? -1) + 1, slides.length - 1)
        }
        return Math.max((current ?? 1) - 1, 0)
      })
    } catch {
      // erro reportado pelo estado global
    } finally {
      setPending("")
    }
  }

  async function closePresentation() {
    setPending("close")
    try {
      await request("CloseCurrentPresentation")
      setLiveIndex(null)
      onPresented({ title: "Apresentação encerrada", type: "Controle" })
    } catch {
      // erro reportado pelo estado global
    } finally {
      setPending("")
    }
  }

  async function showBackgroundWithoutLyrics() {
    if (!selectedSong || backgroundPending) return
    setBackgroundPending(true)
    try {
      // Liga o F9 → esconde a letra, mantém o fundo
      await request("SetF9", { enable: true })
      setLiveIndex(null) // opcional: marca que não há slide "ao vivo"
      onPresented({ title: "Fundo sem letra (F9)", type: "Controle" })
    } catch {
      // tratamento
    } finally {
      setBackgroundPending(false)
    }
  }
  /* ---------------------------------------------------------------
     MODO PLAYER: só a música atual, a letra e os controles
  --------------------------------------------------------------- */
  if (selectedSong) {
    return (
      <section
        aria-labelledby="praise-title"
        className="panel-card praise-player"
        role="tabpanel"
      >
        <header className="player-head">
          <button
            aria-label="Voltar para a busca"
            className="icon-button"
            disabled={busy}
            onClick={backToSearch}
            type="button"
          >
            <ArrowLeft />
          </button>
          <div className="player-title">
            <p className="eyebrow">TOCANDO AGORA</p>
            <h2 id="praise-title">{songTitle}</h2>
            {selectedSong.artist?.trim() ? <p>{selectedSong.artist.trim()}</p> : null}
          </div>
        </header>

        {slidesError ? (
          <div className="inline-error" role="alert">{slidesError}</div>
        ) : isLoadingSlides ? (
          <div className="loading-state">
            <LoaderCircle className="spin" /> Carregando letra...
          </div>
        ) : slides.length === 0 ? (
          <div className="slides-empty">Nenhum slide disponível para esta música.</div>
        ) : (
          <>
            <button
              className="button-secondary button-full"
              disabled={busy}
              onClick={() => void showFromStart()}
              type="button"
            >
              {pending === "start" ? (
                <LoaderCircle className="spin" />
              ) : (
                <Play aria-hidden="true" fill="currentColor" />
              )}
              Projetar do início
            </button>

            <ol aria-label={`Letra de ${songTitle}`} className="slides-list">
              {slides.map((slide, position) => {
                const isLive = liveIndex === position
                const isPending = pending === `slide-${position}`
                return (
                  <li key={slide.originalIndex}>
                    <button
                      aria-current={isLive ? "true" : undefined}
                      aria-label={`Projetar slide ${position + 1}`}
                      className={`slide-tile${isLive ? " is-live" : ""}${isPending ? " is-pending" : ""}`}
                      disabled={busy}
                      id={`praise-slide-${position + 1}`}
                      onClick={() => void showSlide(position)}
                      type="button"
                    >
                      <span className="slide-index">
                        {isPending ? <LoaderCircle className="spin" /> : position + 1}
                      </span>
                      <span className="slide-text">{slide.text}</span>
                      {isLive ? <span className="slide-live-tag">No telão</span> : null}
                    </button>
                  </li>
                )
              })}
            </ol>
          </>
        )}


        <button
          className="button-secondary button-full"
          disabled={busy || backgroundPending}
          onClick={() => void showBackgroundWithoutLyrics()}
          type="button"
        >
          {backgroundPending ? <LoaderCircle className="spin" /> : null}
          Exibir apenas fundo (sem letra)
        </button>

        <div className="player-controls" role="group" aria-label="Controles de projeção">
          <button
            aria-label="Slide anterior"
            className="button-secondary nav-button"
            disabled={!isConfigured || busy}
            onClick={() => void navigate("prev")}
            type="button"
          >
            {pending === "prev" ? <LoaderCircle className="spin" /> : <ArrowLeft />}
            Anterior
          </button>
          <button
            aria-label="Próximo slide"
            className="button-primary nav-button"
            disabled={!isConfigured || busy}
            onClick={() => void navigate("next")}
            type="button"
          >
            Próximo
            {pending === "next" ? <LoaderCircle className="spin" /> : <ArrowRight />}
          </button>
          <button
            aria-label="Fechar apresentação"
            className="button-secondary nav-button nav-close"
            disabled={!isConfigured || busy}
            onClick={() => void closePresentation()}
            type="button"
          >
            {pending === "close" ? <LoaderCircle className="spin" /> : <X />}
          </button>
        </div>
      </section>
    )
  }

  /* ---------------------------------------------------------------
     MODO BUSCA
  --------------------------------------------------------------- */
  return (
    <section aria-labelledby="praise-title" className="panel-card" role="tabpanel">
      <PanelIntro
        id="praise-title"
        description="Encontre uma música e toque nela para abrir a letra."
        eyebrow="BIBLIOTECA"
        icon={<Music2 aria-hidden="true" />}
        title="Louvor"
      />
      <SearchBar
        busy={isSearching}
        disabled={!isConfigured}
        onChange={setQuery}
        onSearch={() => void searchSongs()}
        placeholder="Buscar música ou artista"
        value={query}
      />

      {!isConfigured ? (
        <EmptyState
          action="Configurar conexão"
          description="Adicione o IP e o token do computador que executa o Holyrics."
          icon={<Music2 aria-hidden="true" />}
          onAction={onOpenSettings}
          title="Conecte o Holyrics"
        />
      ) : error ? (
        <div className="inline-error" role="alert">{error}</div>
      ) : isSearching ? (
        <div className="loading-state">
          <LoaderCircle className="spin" /> Buscando músicas...
        </div>
      ) : hasSearched && songs.length === 0 ? (
        <EmptyState
          description="Tente outro título ou nome de artista."
          icon={<Music2 aria-hidden="true" />}
          title="Nenhuma música encontrada"
        />
      ) : !hasSearched ? (
        <EmptyState
          description="Digite um título ou artista. Você também pode buscar sem texto para listar a biblioteca."
          icon={<Search aria-hidden="true" />}
          title="Sua próxima música começa aqui"
        />
      ) : (
        <div aria-label="Resultados de músicas" className="result-list">
          {songs.map((song, index) => {
            const title = song.title?.trim() || "(sem título)"
            const artist = song.artist?.trim() || "Artista não informado"
            return (
              <button
                aria-label={`Abrir letra de ${title}`}
                className="result-row result-row-button"
                key={`${song.id}-${index}`}
                onClick={() => void openSong(song)}
                type="button"
              >
                <span className="result-copy">
                  <h3>{title}</h3>
                  <p>{artist}</p>
                </span>
                <ArrowRight aria-hidden="true" className="result-chevron" />
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function TextsPanel(props: SharedPanelProps) {
  const { request, isConfigured, onOpenSettings, onPresented, currentThemeId } = props
  const [query, setQuery] = useState("")
  const [texts, setTexts] = useState<TextItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [error, setError] = useState("")
  const [pendingId, setPendingId] = useState<string | number | null>(null)

  async function searchTexts() {
    if (!isConfigured) return
    setIsSearching(true)
    setHasSearched(true)
    setError("")
    try {
      const data = await request("SearchText", {
        text: query.trim(),
        fields: "id,title,folder",
      })
      setTexts(Array.isArray(data) ? (data as TextItem[]) : [])
    } catch (requestError) {
      setTexts([])
      setError(getHolyricsErrorMessage(requestError))
    } finally {
      setIsSearching(false)
    }
  }

  async function showText(text: TextItem) {
    const title = text.title?.trim() || "Texto sem título"
    setPendingId(text.id)
    try {
      if (currentThemeId) {
        await request("SetInterfaceInput", {
          id: "main_selected_theme",
          value: currentThemeId, // Theme ID
        })
      }
      await request("ShowText", { id: text.id })
      onPresented({ title, type: "Texto" })
    } catch {
      // O erro é comunicado pelo estado global do painel.
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section aria-labelledby="texts-title" className="panel-card" role="tabpanel">
      <PanelIntro
        id="texts-title"
        description="Pesquise textos salvos e projete com um toque."
        eyebrow="BIBLIOTECA"
        icon={<FileText aria-hidden="true" />}
        title="Textos"
      />
      <SearchBar
        busy={isSearching}
        disabled={!isConfigured}
        onChange={setQuery}
        onSearch={() => void searchTexts()}
        placeholder="Buscar texto ou pasta"
        value={query}
      />
      {!isConfigured ? (
        <EmptyState
          action="Configurar conexão"
          description="Conecte este celular ao computador com Holyrics."
          icon={<FileText aria-hidden="true" />}
          onAction={onOpenSettings}
          title="Conecte o Holyrics"
        />
      ) : error ? (
        <div className="inline-error" role="alert">{error}</div>
      ) : isSearching ? (
        <div className="loading-state"><LoaderCircle className="spin" /> Buscando textos...</div>
      ) : hasSearched && texts.length === 0 ? (
        <EmptyState
          description="Verifique o termo e tente novamente."
          icon={<FileText aria-hidden="true" />}
          title="Nenhum texto encontrado"
        />
      ) : !hasSearched ? (
        <EmptyState
          description="Pesquise por título ou pasta para localizar um texto."
          icon={<Search aria-hidden="true" />}
          title="Encontre um texto"
        />
      ) : (
        <div aria-label="Resultados de textos" className="result-list">
          {texts.map((text, index) => {
            const title = text.title?.trim() || "(sem título)"
            return (
              <article className="result-row" key={`${text.id}-${index}`}>
                <div className="result-copy">
                  <h3>{title}</h3>
                  <p>{text.folder?.trim() || "Sem pasta"}</p>
                </div>
                <button
                  aria-label={`Projetar ${title}`}
                  className="project-button"
                  disabled={pendingId !== null}
                  onClick={() => void showText(text)}
                  type="button"
                >
                  {pendingId === text.id ? (
                    <LoaderCircle className="spin" />
                  ) : (
                    <Play aria-hidden="true" fill="currentColor" />
                  )}
                  <span>Projetar</span>
                </button>
              </article>
            )
          })}
        </div>
      )}
      <StageControls
        isConfigured={isConfigured}
        onClosed={() => onPresented({ title: "Apresentação encerrada", type: "Controle" })}
        request={request}
      />
    </section>
  )
}

export function BiblePanel({
  request,
  isConfigured,
  onOpenSettings,
  onPresented,
}: SharedPanelProps) {
  const [reference, setReference] = useState("")
  const [versions, setVersions] = useState<{ key: string; title: string; language?: { name?: string } }[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionsError, setVersionsError] = useState("")
  const [version, setVersion] = useState("")
  const [pendingAction, setPendingAction] = useState("")
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  useEffect(() => {
    void loadBibleVersions()
  }, [isConfigured])

  async function loadBibleVersions() {  
    if (!isConfigured) return
    setVersionsLoading(true)
    setVersionsError("")
    try {
      const data = await request("GetBibleVersions", {})
      const all = Array.isArray(data) ? data : []
      const ptOnly = all.filter(
        (v) => v?.language?.id === "pt" || v?.language?.iso === "pt"
      )
      setVersions(ptOnly)
    } catch (error) {
      setVersions([])
      setVersionsError(getHolyricsErrorMessage(error))
    } finally {
      setVersionsLoading(false)
    }
  }

  async function showVerse(quick: boolean) {
    if (!reference.trim()) {
      setFeedback({ type: "error", message: "Digite uma referência bíblica." })
      return
    }

    setPendingAction(quick ? "quick" : "project")
    setFeedback(null)
    try {
      const body: Record<string, unknown> = { references: reference.trim() }
      if (version.trim()) body.version = version.trim()
      if (quick) body.quick_presentation = true
      await request("ShowVerse", body)
      const title = `${reference.trim()}${version.trim() ? ` · ${version.trim()}` : ""}`
      onPresented({ title, type: quick ? "Bíblia rápida" : "Bíblia" })
      setFeedback({
        type: "success",
        message: quick ? "Versículo aberto na janela rápida." : "Versículo enviado ao telão.",
      })
    } catch (error) {
      setFeedback({ type: "error", message: getHolyricsErrorMessage(error) })
    } finally {
      setPendingAction("")
    }
  }

  return (
    <section aria-labelledby="bible-title" className="panel-card" role="tabpanel">
      <PanelIntro
        id="bible-title"
        description="Envie uma passagem para a projeção ou abra na janela rápida."
        eyebrow="LEITURA"
        icon={<BookOpen aria-hidden="true" />}
        title="Bíblia"
      />
      {!isConfigured ? (
        <EmptyState
          action="Configurar conexão"
          description="Configure o computador do Holyrics para enviar referências bíblicas."
          icon={<BookOpen aria-hidden="true" />}
          onAction={onOpenSettings}
          title="Conecte o Holyrics"
        />
      ) : (
        <div className="form-stack">
          <label className="field-label" htmlFor="bible-reference">
            Referência
            <input
              autoComplete="off"
              className="field-input"
              id="bible-reference"
              onChange={(event) => setReference(event.target.value)}
              placeholder="Ex.: João 3:16 ou Rm 12:2"
              value={reference}
            />
          </label>
          <label className="field-label" htmlFor="bible-version">
            Versão <span className="optional-label">opcional</span>
            <select
              className="field-input"
              id="bible-version"
              onChange={(event) => setVersion(event.target.value)}
              value={version}
              disabled={versionsLoading}
            >
              <option value="">Padrão do Holyrics</option>
              {versions.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.title}
                  {v.language?.name ? ` — ${v.language.name}` : ""}
                </option>
              ))}
            </select>
          </label>
          {versionsError ? (
            <div className="inline-error" role="alert">{versionsError}</div>
          ) : null}
          <div className="button-row">
            <button
              className="button-primary"
              disabled={Boolean(pendingAction)}
              onClick={() => void showVerse(false)}
              type="button"
            >
              {pendingAction === "project" ? <LoaderCircle className="spin" /> : <BookOpen />}
              Projetar versículo
            </button>
            <button
              className="button-secondary"
              disabled={Boolean(pendingAction)}
              onClick={() => void showVerse(true)}
              type="button"
            >
              {pendingAction === "quick" ? <LoaderCircle className="spin" /> : <Zap />}
              Janela rápida
            </button>
          </div>
          {feedback ? (
            <p className={`inline-feedback is-${feedback.type}`} role="status">
              {feedback.type === "success" ? <Check /> : <X />}
              {feedback.message}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}

const fileTypes = [
  { id: "GetImages", label: "Imagens", icon: ImageIcon },
  { id: "GetVideos", label: "Vídeos", icon: Video },
  { id: "GetAudios", label: "Áudios", icon: Volume2 },
] as const

type FileType = (typeof fileTypes)[number]["id"]

function formatFileSize(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes)) return ""
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function FilesPanel(props: SharedPanelProps) {
  const { request, isConfigured, onOpenSettings, onPresented } = props
  const [fileType, setFileType] = useState<FileType>("GetImages")
  const [query, setQuery] = useState("")
  const [files, setFiles] = useState<MediaFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [error, setError] = useState("")
  const [pendingFile, setPendingFile] = useState("")

  async function loadFiles() {
    if (!isConfigured) return
    setIsLoading(true)
    setHasLoaded(true)
    setError("")
    try {
      const data = await request(fileType, {
        filter: query.trim(),
        include_metadata: true,
      })
      setFiles(Array.isArray(data) ? (data as MediaFile[]).filter((file) => !file.isDir) : [])
    } catch (requestError) {
      setFiles([])
      setError(getHolyricsErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }

  async function playFile(file: MediaFile) {
    const action = fileType === "GetImages"
      ? "ShowImage"
      : fileType === "GetVideos"
        ? "PlayVideo"
        : "PlayAudio"
    setPendingFile(file.name)
    try {
      await request(action, { file: file.name })
      onPresented({ title: file.name, type: fileType === "GetImages" ? "Imagem" : fileType === "GetVideos" ? "Vídeo" : "Áudio" })
    } catch {
      // O painel principal comunica e registra falhas da API.
    } finally {
      setPendingFile("")
    }
  }

  return (
    <section aria-labelledby="files-title" className="panel-card" role="tabpanel">
      <PanelIntro
        id="files-title"
        description="Selecione uma mídia da biblioteca do computador."
        eyebrow="MÍDIA LOCAL"
        icon={<ImageIcon aria-hidden="true" />}
        title="Arquivos"
      />
      {!isConfigured ? (
        <EmptyState
          action="Configurar conexão"
          description="A lista de arquivos vem diretamente do computador com Holyrics."
          icon={<ImageIcon aria-hidden="true" />}
          onAction={onOpenSettings}
          title="Conecte o Holyrics"
        />
      ) : (
        <>
          <div aria-label="Tipo de arquivo" className="media-tabs" role="tablist">
            {fileTypes.map(({ id, label, icon: Icon }) => (
              <button
                aria-selected={fileType === id}
                className={`media-tab${fileType === id ? " is-active" : ""}`}
                key={id}
                onClick={() => {
                  setFileType(id)
                  setFiles([])
                  setHasLoaded(false)
                  setError("")
                }}
                role="tab"
                type="button"
              >
                <Icon aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <SearchBar
            busy={isLoading}
            disabled={!isConfigured}
            onChange={setQuery}
            onSearch={() => void loadFiles()}
            placeholder="Filtrar pelo nome do arquivo"
            value={query}
          />
          {error ? (
            <div className="inline-error" role="alert">{error}</div>
          ) : isLoading ? (
            <div className="loading-state"><LoaderCircle className="spin" /> Carregando arquivos...</div>
          ) : hasLoaded && files.length === 0 ? (
            <EmptyState
              description="Tente outro filtro ou confira a biblioteca no Holyrics."
              icon={<ImageIcon aria-hidden="true" />}
              title="Nenhum arquivo encontrado"
            />
          ) : !hasLoaded ? (
            <EmptyState
              description="Toque em buscar para carregar a mídia disponível no computador."
              icon={<Search aria-hidden="true" />}
              title="A biblioteca está pronta"
            />
          ) : (
            <div aria-label="Resultados de arquivos" className="result-list">
              {files.map((file, index) => (
                <article className="result-row" key={`${file.name}-${index}`}>
                  <div className="result-copy">
                    <h3>{file.name}</h3>
                    <p>{formatFileSize(file.length) || "Arquivo local"}</p>
                  </div>
                  <button
                    aria-label={`Reproduzir ${file.name}`}
                    className="project-button"
                    disabled={Boolean(pendingFile)}
                    onClick={() => void playFile(file)}
                    type="button"
                  >
                    {pendingFile === file.name ? <LoaderCircle className="spin" /> : <Play aria-hidden="true" fill="currentColor" />}
                    <span>Usar</span>
                  </button>
                </article>
              ))}
            </div>
          )}
          <StageControls
            isConfigured={isConfigured}
            onClosed={() => onPresented({ title: "Apresentação encerrada", type: "Controle" })}
            request={request}
          />
        </>
      )}
    </section>
  )
}

export function QuickPanel({
  request,
  isConfigured,
  onOpenSettings,
  onPresented,
}: SharedPanelProps) {
  const [quickText, setQuickText] = useState("")
  const [alertText, setAlertText] = useState("")
  const [countdown, setCountdown] = useState("05:00")
  const [before, setBefore] = useState("")
  const [after, setAfter] = useState("")
  const [pendingAction, setPendingAction] = useState("")
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  async function runQuickText() {
    if (!quickText.trim()) {
      setFeedback({ type: "error", message: "Escreva o texto que deseja projetar." })
      return
    }
    setPendingAction("quick-text")
    setFeedback(null)
    try {
      await request("ShowQuickPresentation", { text: quickText.trim() })
      onPresented({ title: quickText.trim(), type: "Texto rápido" })
      setFeedback({ type: "success", message: "Texto enviado para a projeção." })
    } catch (error) {
      setFeedback({ type: "error", message: getHolyricsErrorMessage(error) })
    } finally {
      setPendingAction("")
    }
  }

  async function closePresentation() {
    setPendingAction("close")
    setFeedback(null)
    try {
      await request("CloseCurrentPresentation")
      onPresented({ title: "Apresentação encerrada", type: "Controle" })
      setFeedback({ type: "success", message: "Apresentação encerrada." })
    } catch (error) {
      setFeedback({ type: "error", message: getHolyricsErrorMessage(error) })
    } finally {
      setPendingAction("")
    }
  }

  async function sendAlert() {
    if (!alertText.trim()) {
      setFeedback({ type: "error", message: "Escreva uma mensagem para a equipe." })
      return
    }
    setPendingAction("alert")
    setFeedback(null)
    try {
      await request("SetAlert", { text: alertText.trim(), show: true })
      onPresented({ title: alertText.trim(), type: "Alerta de palco" })
      setFeedback({ type: "success", message: "Alerta enviado para o palco." })
    } catch {
      try {
        await request("ShowQuickPresentation", { text: alertText.trim() })
        onPresented({ title: alertText.trim(), type: "Texto rápido" })
        setFeedback({ type: "success", message: "Alerta exibido como apresentação rápida." })
      } catch (error) {
        setFeedback({ type: "error", message: getHolyricsErrorMessage(error) })
      }
    } finally {
      setPendingAction("")
    }
  }

  async function hideAlert() {
    setPendingAction("hide-alert")
    setFeedback(null)
    try {
      await request("SetAlert", { text: "", show: false })
      setFeedback({ type: "success", message: "Alerta ocultado." })
    } catch (error) {
      setFeedback({ type: "error", message: getHolyricsErrorMessage(error) })
    } finally {
      setPendingAction("")
    }
  }

  async function startCountdown() {
    setPendingAction("countdown")
    setFeedback(null)
    try {
      await request("ShowCountdown", {
        time: countdown.trim() || "05:00",
        text_before: before.trim() || undefined,
        text_after: after.trim() || undefined,
        zero_fill: true,
      })
      onPresented({ title: countdown.trim() || "05:00", type: "Contagem regressiva" })
      setFeedback({ type: "success", message: "Contagem regressiva iniciada." })
    } catch (error) {
      setFeedback({ type: "error", message: getHolyricsErrorMessage(error) })
    } finally {
      setPendingAction("")
    }
  }

  if (!isConfigured) {
    return (
      <section aria-labelledby="quick-title" className="panel-card" role="tabpanel">
      <PanelIntro
        id="quick-title"
        description="Envie mensagens e comandos rápidos para a equipe."
          eyebrow="COMANDOS"
          icon={<Zap aria-hidden="true" />}
          title="Rápido"
        />
        <EmptyState
          action="Configurar conexão"
          description="Configure o acesso ao computador com Holyrics para habilitar os comandos."
          icon={<Zap aria-hidden="true" />}
          onAction={onOpenSettings}
          title="Conecte o Holyrics"
        />
      </section>
    )
  }

  return (
    <section aria-labelledby="quick-title" className="panel-card" role="tabpanel">
      <PanelIntro
        id="quick-title"
        description="Comandos essenciais para operar sem navegar pela biblioteca."
        eyebrow="COMANDOS"
        icon={<Zap aria-hidden="true" />}
        title="Rápido"
      />
      <div className="quick-stack">
        <section className="quick-card">
          <div className="quick-card-heading">
            <div className="quick-icon"><FileText aria-hidden="true" /></div>
            <div><h3>Texto rápido</h3><p>Uma mensagem direta no telão.</p></div>
          </div>
          <label className="sr-only" htmlFor="quick-text">Texto para projetar</label>
          <textarea
            className="field-input field-textarea"
            id="quick-text"
            onChange={(event) => setQuickText(event.target.value)}
            placeholder="Escreva o texto..."
            rows={3}
            value={quickText}
          />
          <div className="button-row">
            <button
              className="button-primary"
              disabled={Boolean(pendingAction)}
              onClick={() => void runQuickText()}
              type="button"
            >
              {pendingAction === "quick-text" ? <LoaderCircle className="spin" /> : <Send />}
              Projetar
            </button>
            <button
              className="button-secondary button-danger-text"
              disabled={Boolean(pendingAction)}
              onClick={() => void closePresentation()}
              type="button"
            >
              {pendingAction === "close" ? <LoaderCircle className="spin" /> : <X />}
            </button>
          </div>
        </section>

        <section className="quick-card">
          <div className="quick-card-heading">
            <div className="quick-icon"><Send aria-hidden="true" /></div>
            <div><h3>Alerta no palco</h3><p>Mensagem para a equipe de comunicação.</p></div>
          </div>
          <label className="sr-only" htmlFor="alert-text">Mensagem para a equipe</label>
          <input
            className="field-input"
            id="alert-text"
            onChange={(event) => setAlertText(event.target.value)}
            placeholder="Ex.: próximo cântico em 2 minutos"
            value={alertText}
          />
          <div className="button-row">
            <button
              className="button-primary"
              disabled={Boolean(pendingAction)}
              onClick={() => void sendAlert()}
              type="button"
            >
              {pendingAction === "alert" ? <LoaderCircle className="spin" /> : <Send />}
              Enviar alerta
            </button>
            <button
              className="button-secondary"
              disabled={Boolean(pendingAction)}
              onClick={() => void hideAlert()}
              type="button"
            >
              {pendingAction === "hide-alert" ? <LoaderCircle className="spin" /> : <X />}
              Ocultar
            </button>
          </div>
        </section>

        <section className="quick-card">
          <div className="quick-card-heading">
            <div className="quick-icon"><Clock3 aria-hidden="true" /></div>
            <div><h3>Contagem regressiva</h3><p>Configure o tempo e os textos de apoio.</p></div>
          </div>
          <label className="field-label" htmlFor="countdown-time">
            Tempo
            <input
              className="field-input"
              id="countdown-time"
              inputMode="numeric"
              onChange={(event) => setCountdown(event.target.value)}
              placeholder="05:00"
              value={countdown}
            />
          </label>
          <div className="field-pair">
            <label className="field-label" htmlFor="countdown-before">
              Texto acima <span className="optional-label">opcional</span>
              <input
                className="field-input"
                id="countdown-before"
                onChange={(event) => setBefore(event.target.value)}
                placeholder="Começamos em"
                value={before}
              />
            </label>
            <label className="field-label" htmlFor="countdown-after">
              Texto abaixo <span className="optional-label">opcional</span>
              <input
                className="field-input"
                id="countdown-after"
                onChange={(event) => setAfter(event.target.value)}
                placeholder="Prepare-se"
                value={after}
              />
            </label>
          </div>
          <button
            className="button-primary button-full"
            disabled={Boolean(pendingAction)}
            onClick={() => void startCountdown()}
            type="button"
          >
            {pendingAction === "countdown" ? <LoaderCircle className="spin" /> : <Clock3 />}
            Iniciar contagem
          </button>
        </section>
      </div>
      {feedback ? (
        <p className={`inline-feedback is-${feedback.type}`} role="status">
          {feedback.type === "success" ? <Check /> : <X />}
          {feedback.message}
        </p>
      ) : null}
      <div className="quick-footnote">Os comandos são enviados diretamente à API local do Holyrics.</div>
    </section>
  )
}
