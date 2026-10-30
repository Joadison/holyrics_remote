"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import useSWR from "swr"
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Mic,
  MicOff,
  X,
  Zap,
} from "lucide-react"
import {
  BIBLE_TRANSLATIONS,
  bibleReferenceKey,
  bibleVerseId,
  buildBibleIndex,
  findQuotedVerse,
  formatBibleReference,
  getAdjacentBibleReference,
  getBiblePassages,
  normalizeSpeech,
  parseBibleReference,
  type BibleBook,
  type BibleQuoteMatch,
  type BibleReference,
  type BibleTranslation,
} from "@/lib/bible"
import { getHolyricsErrorMessage } from "@/lib/holyrics-api"
import { EmptyState, PanelIntro, type ApiRequest, type Presentation } from "@/components/holyrics/remote-panels"
import { useVoiceListener } from "./use-voice-listener"
import "./voice-bible-panel.css"

const BIBLE_BASE_URL = "https://cdn.jsdelivr.net/gh/thiagobodruk/bible@master/json"

type NavigationCommand = "next" | "previous" | "close"
type Feedback = { type: "success" | "error" | "info"; message: string }
type HolyricsVersion = { key: string; title: string; language?: { name?: string } }

type Props = {
  request: ApiRequest
  isConfigured: boolean
  onOpenSettings: () => void
  onPresented: (presentation: Presentation) => void
}

async function fetchBible(url: string): Promise<BibleBook[]> {
  const response = await fetch(url, { cache: "force-cache" })
  if (!response.ok) throw new Error("Não foi possível carregar a tradução bíblica.")
  const text = (await response.text()).replace(/^\uFEFF/, "")
  const result: unknown = JSON.parse(text)
  if (!Array.isArray(result) || !result.every((book) => book && Array.isArray(book.chapters))) {
    throw new Error("O arquivo da tradução bíblica possui um formato inesperado.")
  }
  return result as BibleBook[]
}

function parseNavigationCommand(value: string): NavigationCommand | null {
  const ignored = new Set(["por", "favor", "pode", "agora", "o", "a", "ai", "ok", "irmao", "irma", "vamos", "vai", "para", "versiculo", "verso"])
  const command = normalizeSpeech(value)
    .split(" ")
    .filter((word) => word && !ignored.has(word))
    .join(" ")

  if (["proximo", "proxima", "seguinte", "proximo versiculo", "proxima pagina", "avancar", "avanca", "passa", "passar", "passando"].includes(command)) return "next"
  if (["anterior", "voltar", "volta", "retroceder", "versiculo anterior"].includes(command)) return "previous"
  if (["fechar", "feche", "limpar", "limpa", "tela limpa", "fechar versiculo"].includes(command)) return "close"
  return null
}

export function BibleVoicePanel({ request, isConfigured, onOpenSettings, onPresented }: Props) {
  const [manualReference, setManualReference] = useState("")
  const [versions, setVersions] = useState<HolyricsVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionsError, setVersionsError] = useState("")
  const [version, setVersion] = useState("")
  const [recognizeText, setRecognizeText] = useState(true)
  const [autoProject, setAutoProject] = useState(true)
  const [currentReference, setCurrentReference] = useState<BibleReference | null>(null)
  const [suggestion, setSuggestion] = useState<BibleQuoteMatch | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [pendingAction, setPendingAction] = useState("")

  const busyRef = useRef(false)
  const finalWordsRef = useRef<string[]>([])
  const lastQuoteKeyRef = useRef("")
  const lastQuoteAtRef = useRef(0)

  // Tradução usada apenas para EXIBIR o texto no celular.
  const translation: BibleTranslation =
    BIBLE_TRANSLATIONS.find((item) => item.value === version)?.value ?? "pt_acf"

  const { data: bibleBooks, error: bibleError, isLoading: bibleLoading } = useSWR<BibleBook[]>(
    isConfigured ? `${BIBLE_BASE_URL}/${translation}.json` : null,
    fetchBible,
    { dedupingInterval: 30 * 60 * 1000, revalidateOnFocus: false, revalidateOnReconnect: true },
  )
  const bibleIndex = useMemo(
    () => (recognizeText && bibleBooks ? buildBibleIndex(bibleBooks) : null),
    [bibleBooks, recognizeText],
  )
  const passages = useMemo(
    () => (currentReference ? getBiblePassages(bibleBooks, currentReference) : null),
    [bibleBooks, currentReference],
  )

  useEffect(() => {
    if (!isConfigured) return
    let cancelled = false
    async function loadVersions() {
      setVersionsLoading(true)
      setVersionsError("")
      try {
        const data = await request("GetBibleVersions", {})
        const all = Array.isArray(data) ? (data as HolyricsVersion[]) : []
        const ptOnly = all.filter((v) => {
          const lang = (v as { language?: { id?: string; iso?: string } })?.language
          return lang?.id === "pt" || lang?.iso === "pt"
        })
        if (!cancelled) setVersions(ptOnly)
      } catch (error) {
        if (!cancelled) {
          setVersions([])
          setVersionsError(getHolyricsErrorMessage(error))
        }
      } finally {
        if (!cancelled) setVersionsLoading(false)
      }
    }
    void loadVersions()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured])

  /** Envia uma passagem ao telão. */
  const project = useCallback(
    async (reference: BibleReference, source: string, quick = false) => {
      if (busyRef.current) return false

      const verseEnd = reference.verseEnd ?? reference.verse
      if (verseEnd - reference.verse + 1 > 100) {
        setFeedback({ type: "error", message: "O Holyrics aceita até 100 versículos por apresentação." })
        return false
      }
      if (bibleBooks && !getBiblePassages(bibleBooks, reference)) {
        setFeedback({ type: "error", message: "Essa referência não existe na tradução selecionada." })
        return false
      }

      const ids = Array.from({ length: verseEnd - reference.verse + 1 }, (_, offset) =>
        bibleVerseId({ book: reference.book, chapter: reference.chapter, verse: reference.verse + offset }),
      )
      const body: Record<string, unknown> = ids.length > 1 ? { ids } : { id: ids[0] }
      if (version) body.version = version
      if (quick) body.quick_presentation = true

      busyRef.current = true
      setPendingAction(quick ? "quick" : "project")
      try {
        await request("ShowVerse", body)
        const label = formatBibleReference(reference)
        setCurrentReference(reference)
        setSuggestion(null)
        onPresented({ title: label, type: quick ? "Bíblia rápida" : `Bíblia · ${source}` })
        setFeedback({
          type: "success",
          message: quick ? `${label} aberto na janela rápida.` : `${label} enviado ao telão.`,
        })
        return true
      } catch (error) {
        setFeedback({ type: "error", message: getHolyricsErrorMessage(error) })
        return false
      } finally {
        busyRef.current = false
        setPendingAction("")
      }
    },
    [bibleBooks, onPresented, request, version],
  )

  const navigate = useCallback(
    async (direction: "next" | "previous") => {
      if (busyRef.current) return
      if (!currentReference) {
        setFeedback({ type: "info", message: "Projete uma passagem antes de avançar ou voltar." })
        return
      }
      const next = getAdjacentBibleReference(currentReference, direction, bibleBooks)
      if (!next) {
        setFeedback({
          type: "info",
          message: direction === "next" ? "Este é o último versículo." : "Este é o primeiro versículo.",
        })
        return
      }
      busyRef.current = true
      setPendingAction(direction)
      try {
        await request(direction === "next" ? "ActionNext" : "ActionPrevious", {})
        setCurrentReference(next)
        setSuggestion(null)
        onPresented({ title: formatBibleReference(next), type: "Bíblia" })
        setFeedback({ type: "success", message: `${formatBibleReference(next)} no telão.` })
      } catch (error) {
        setFeedback({ type: "error", message: getHolyricsErrorMessage(error) })
      } finally {
        busyRef.current = false
        setPendingAction("")
      }
    },
    [bibleBooks, currentReference, onPresented, request],
  )

  const closePresentation = useCallback(async () => {
    if (busyRef.current || !currentReference) return
    busyRef.current = true
    setPendingAction("close")
    try {
      await request("CloseCurrentPresentation", {})
      setCurrentReference(null)
      setSuggestion(null)
      onPresented({ title: "Apresentação encerrada", type: "Controle" })
      setFeedback({ type: "success", message: "Apresentação bíblica fechada." })
    } catch (error) {
      setFeedback({ type: "error", message: getHolyricsErrorMessage(error) })
    } finally {
      busyRef.current = false
      setPendingAction("")
    }
  }, [currentReference, onPresented, request])

  /** Processa cada trecho final reconhecido pelo microfone. */
  const handleFinalTranscript = async (transcript: string) => {
    const spoken = normalizeSpeech(transcript).split(" ").filter(Boolean)
    if (!spoken.length) return

    const accumulated = [...finalWordsRef.current, ...spoken].slice(-36)
    finalWordsRef.current = accumulated

    const command = parseNavigationCommand(transcript)
    if (command) {
      finalWordsRef.current = []
      if (command === "close") await closePresentation()
      else await navigate(command)
      return
    }

    const reference = parseBibleReference(accumulated.join(" "))
    if (reference) {
      finalWordsRef.current = []
      await project(reference, "voz")
      return
    }

    if (!recognizeText || !bibleIndex) return

    const match = findQuotedVerse(bibleIndex, accumulated.join(" "))
    if (!match) {
      if (accumulated.length > 30) finalWordsRef.current = accumulated.slice(-24)
      return
    }

    const key = bibleReferenceKey(match.reference)
    if (currentReference && bibleReferenceKey(currentReference) === key) return
    if (lastQuoteKeyRef.current === key && Date.now() - lastQuoteAtRef.current < 8_000) return
    lastQuoteKeyRef.current = key
    lastQuoteAtRef.current = Date.now()
    finalWordsRef.current = accumulated.slice(-8)

    if (autoProject && match.confidence === "strong") {
      finalWordsRef.current = []
      setSuggestion(null)
      await project(match.reference, "trecho reconhecido")
      return
    }

    setSuggestion(match)
    setFeedback({ type: "info", message: "Encontrei uma possível passagem. Confirme antes de projetar." })
  }

  const voice = useVoiceListener(handleFinalTranscript)

  function submitManual(event: FormEvent<HTMLFormElement>, quick: boolean) {
    event.preventDefault()
    const value = manualReference.trim()
    if (!value) {
      setFeedback({ type: "error", message: "Digite uma referência bíblica." })
      return
    }
    const reference = parseBibleReference(value)
    if (!reference) {
      setFeedback({ type: "error", message: "Não reconheci a referência. Tente “João 3:16” ou “Salmos 23:1-3”." })
      return
    }
    void project(reference, "manual", quick)
  }

  const busy = Boolean(pendingAction)
  const bibleStatus = bibleError
    ? "A tradução não carregou; referências faladas continuam funcionando."
    : bibleLoading
      ? "Carregando a Bíblia…"
      : bibleBooks
        ? `Bíblia pronta · ${BIBLE_TRANSLATIONS.find((i) => i.value === translation)?.label}`
        : ""

  return (
    <section aria-labelledby="bible-title" className="panel-card" role="tabpanel">
      <PanelIntro
        id="bible-title"
        description="Fale a referência ou leia o trecho. A passagem aparece aqui e no telão."
        eyebrow="LEITURA POR VOZ"
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
          {/* ---------- Escuta ---------- */}
          <div className="vb-listen">
            <button
              aria-pressed={voice.listening}
              className={`vb-mic${voice.listening ? " is-live" : ""}`}
              disabled={voice.supported === false}
              onClick={() => (voice.listening ? voice.stop() : voice.start())}
              type="button"
            >
              {voice.listening ? <MicOff /> : <Mic />}
              {voice.listening ? "Parar escuta" : "Iniciar escuta"}
            </button>
            <p className="vb-transcript" aria-live="polite">
              {voice.listening
                ? voice.liveTranscript || "Ouvindo… diga “João 3:16” ou leia o versículo."
                : voice.supported === false
                  ? "Reconhecimento de voz indisponível neste navegador."
                  : "Toque para começar. Comandos: “próximo”, “anterior”, “fechar”."}
            </p>
            {voice.error ? <div className="inline-error" role="alert">{voice.error}</div> : null}
          </div>

          <div className="vb-toggles">
            <label className="vb-toggle">
              <input checked={recognizeText} onChange={(e) => setRecognizeText(e.target.checked)} type="checkbox" />
              Reconhecer trecho lido
            </label>
            <label className="vb-toggle">
              <input
                checked={autoProject}
                disabled={!recognizeText}
                onChange={(e) => setAutoProject(e.target.checked)}
                type="checkbox"
              />
              Projetar automático (alta confiança)
            </label>
          </div>

          {suggestion ? (
            <div className="vb-suggestion" role="status">
              <div>
                <strong>{formatBibleReference(suggestion.reference)}</strong>
                <p>{suggestion.text}</p>
              </div>
              <div className="button-row">
                <button
                  className="button-primary"
                  disabled={busy}
                  onClick={() => void project(suggestion.reference, "sugestão confirmada")}
                  type="button"
                >
                  <Check /> Projetar
                </button>
                <button className="button-secondary" onClick={() => setSuggestion(null)} type="button">
                  <X /> Descartar
                </button>
              </div>
            </div>
          ) : null}

          {/* ---------- Passagem atual (mostra a Bíblia) ---------- */}
          {currentReference ? (
            <article className="vb-passage" aria-label="Passagem no telão">
              <header>
                <h3>{formatBibleReference(currentReference)}</h3>
                <button
                  aria-label="Fechar apresentação"
                  className="icon-button small-icon-button"
                  disabled={busy}
                  onClick={() => void closePresentation()}
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </header>
              <div className="vb-verses">
                {passages ? (
                  passages.map((p) => (
                    <p key={p.reference.verse}>
                      <sup>{p.reference.verse}</sup> {p.text}
                    </p>
                  ))
                ) : (
                  <p className="vb-muted">{bibleLoading ? "Carregando texto…" : "Texto indisponível; a projeção continua normal."}</p>
                )}
              </div>
              <div className="button-row">
                <button className="button-secondary" disabled={busy} onClick={() => void navigate("previous")} type="button">
                  {pendingAction === "previous" ? <LoaderCircle className="spin" /> : <ChevronLeft />} Anterior
                </button>
                <button className="button-secondary" disabled={busy} onClick={() => void navigate("next")} type="button">
                  Próximo {pendingAction === "next" ? <LoaderCircle className="spin" /> : <ChevronRight />}
                </button>
              </div>
            </article>
          ) : null}

          {/* ---------- Manual ---------- */}
          <form className="form-stack" onSubmit={(e) => submitManual(e, false)}>
            <label className="field-label" htmlFor="bible-reference">
              Referência manual
              <input
                autoComplete="off"
                className="field-input"
                id="bible-reference"
                onChange={(e) => setManualReference(e.target.value)}
                placeholder="Ex.: João 3:16 ou Rm 12:2-4"
                value={manualReference}
              />
            </label>
            <label className="field-label" htmlFor="bible-version">
              Versão <span className="optional-label">opcional</span>
              <select
                className="field-input"
                disabled={versionsLoading}
                id="bible-version"
                onChange={(e) => setVersion(e.target.value)}
                value={version}
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
            {versionsError ? <div className="inline-error" role="alert">{versionsError}</div> : null}
            <div className="button-row">
              <button className="button-primary" disabled={busy} type="submit">
                {pendingAction === "project" ? <LoaderCircle className="spin" /> : <BookOpen />}
                Projetar versículo
              </button>
              <button
                className="button-secondary"
                disabled={busy}
                onClick={(e) => submitManual(e as unknown as FormEvent<HTMLFormElement>, true)}
                type="button"
              >
                {pendingAction === "quick" ? <LoaderCircle className="spin" /> : <Zap />}
                Janela rápida
              </button>
            </div>
          </form>

          {bibleStatus ? <p className="vb-muted">{bibleStatus}</p> : null}
          {feedback ? (
            <p className={`inline-feedback is-${feedback.type}`} role="status">
              {feedback.type === "success" ? <Check /> : feedback.type === "error" ? <X /> : null}
              {feedback.message}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}