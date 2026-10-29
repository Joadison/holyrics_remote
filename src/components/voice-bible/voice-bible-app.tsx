"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import {
  BookOpen,
  CircleAlert,
  Globe,
  Radio,
  Settings2,
  ShieldCheck,
  Wifi,
} from "lucide-react"
import { ActivityCard, type ActivityEntry } from "@/components/voice-bible/activity-card"
import { ConnectionDialog, type ConnectionTestMessage } from "@/components/voice-bible/connection-dialog"
import { PresentationCard } from "@/components/voice-bible/presentation-card"
import { VoiceControlCard, type VoiceFeedback } from "@/components/voice-bible/voice-control-card"
import { VoiceSettingsCard } from "@/components/voice-bible/voice-settings-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  type BibleIndex,
  type BibleReference,
  type BibleTranslation,
} from "@/lib/bible"
import {
  callHolyrics,
  isConnectionConfigured,
  type HolyricsAction,
  type HolyricsBibleVersion,
  type HolyricsConnection,
  type HolyricsPayload,
} from "@/lib/holyrics"

interface SpeechResult {
  isFinal: boolean
  0?: { transcript: string }
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechResult>
}

interface SpeechRecognitionErrorLike {
  error?: string
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

type ConnectionHealth = "idle" | "checking" | "connected" | "error"
type NavigationCommand = "next" | "previous" | "close"

interface ScreenWakeLock {
  release: () => Promise<void>
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<ScreenWakeLock> }
}

const BIBLE_BASE_URL = "https://cdn.jsdelivr.net/gh/thiagobodruk/bible@master/json"
const INITIAL_CONNECTION: HolyricsConnection = {
  mode: "local",
  host: "",
  port: "8091",
  apiKey: "",
  token: "",
}

function getSpeechConstructor() {
  if (typeof window === "undefined") return null
  const speechWindow = window as WindowWithSpeech
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readData(value: unknown) {
  return isRecord(value) && isRecord(value.data) ? value.data : null
}

function readHolyricsVersions(value: unknown): HolyricsBibleVersion[] {
  const data = isRecord(value) && Array.isArray(value.data) ? value.data : []
  const versions = new Map<string, HolyricsBibleVersion>()

  for (const item of data) {
    if (!isRecord(item)) continue
    const language = isRecord(item.language) ? item.language.iso : undefined
    const version = typeof item.version === "string" ? item.version : typeof item.key === "string" ? item.key : ""
    const title = typeof item.title === "string" ? item.title : version
    if (!version || (language && language !== "pt") || (!language && !version.startsWith("pt_"))) continue
    versions.set(version, { version, title })
  }

  return [...versions.values()]
}

function parseNavigationCommand(value: string): NavigationCommand | null {
  const ignored = new Set(["por", "favor", "pode", "agora", "o", "a", "ai", "ok", "irmao", "irma", "vamos", "vai", "para", "versiculo", "verso"])
  const command = normalizeSpeech(value)
    .split(" ")
    .filter((word) => word && !ignored.has(word))
    .join(" ")

  if (["proximo", "proxima", "seguinte", "proximo versiculo", "proxima pagina", "avancar", "avanca", "passa", "passar", "passando"].includes(command)) {
    return "next"
  }
  if (["anterior", "voltar", "volta", "retroceder", "versiculo anterior"].includes(command)) {
    return "previous"
  }
  if (["fechar", "feche", "limpar", "limpa", "tela limpa", "fechar versiculo"].includes(command)) {
    return "close"
  }
  return null
}

function readApiError(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a solicitação ao Holyrics."
}

export function VoiceBibleApp() {
  const [connection, setConnection] = useState<HolyricsConnection>(INITIAL_CONNECTION)
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false)
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>("idle")
  const [connectionTestMessage, setConnectionTestMessage] = useState<ConnectionTestMessage | null>(null)
  const [testingConnection, setTestingConnection] = useState(false)
  const [holyricsVersions, setHolyricsVersions] = useState<HolyricsBibleVersion[]>([])
  const [projectionVersion, setProjectionVersion] = useState("")
  const [translation, setTranslation] = useState<BibleTranslation>("pt_acf")
  const [recognizeText, setRecognizeText] = useState(true)
  const [autoProject, setAutoProject] = useState(true)
  const [currentReference, setCurrentReference] = useState<BibleReference | null>(null)
  const [suggestion, setSuggestion] = useState<ReturnType<typeof findQuotedVerse>>(null)
  const [liveTranscript, setLiveTranscript] = useState("")
  const [feedback, setFeedback] = useState<VoiceFeedback | null>(null)
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [listening, setListening] = useState(false)
  const [sending, setSending] = useState(false)
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null)
  const [micBlocked, setMicBlocked] = useState(false)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldListenRef = useRef(false)
  const fatalErrorRef = useRef(false)
  const restartTimerRef = useRef<number | null>(null)
  const wakeLockRef = useRef<ScreenWakeLock | null>(null)
  const requestInFlightRef = useRef(false)
  const activitySequenceRef = useRef(0)
  const lastRequestErrorRef = useRef<string | null>(null)
  const lastQuoteKeyRef = useRef("")
  const lastQuoteAtRef = useRef(0)
  const finalWordsRef = useRef<string[]>([])
  const finalQueueRef = useRef<Promise<void>>(Promise.resolve())
  const handleFinalTranscriptRef = useRef<(transcript: string) => Promise<void>>(async () => undefined)

  const bibleUrl = `${BIBLE_BASE_URL}/${translation}.json`
  const { data: bibleBooks, error: bibleError, isLoading: bibleLoading } = useSWR<BibleBook[]>(bibleUrl, fetchBible, {
    dedupingInterval: 30 * 60 * 1000,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
  })
  const bibleIndex: BibleIndex | null = useMemo(
    () => (recognizeText && bibleBooks ? buildBibleIndex(bibleBooks) : null),
    [bibleBooks, recognizeText],
  )

  const addActivity = useCallback((message: string, tone: ActivityEntry["tone"] = "info") => {
    const now = new Date()
    const entry: ActivityEntry = {
      id: `${now.getTime()}-${activitySequenceRef.current++}`,
      time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      message,
      tone,
    }
    setActivity((entries) => [entry, ...entries].slice(0, 12))
  }, [])

  const requestHolyrics = useCallback(
    async (action: HolyricsAction, payload: HolyricsPayload = {}, quiet = false): Promise<unknown | null> => {
      if (requestInFlightRef.current) return null
      if (!isConnectionConfigured(connection)) {
        const message = "Configure a conexão do Holyrics antes de enviar uma passagem."
        if (!quiet) {
          setFeedback({ tone: "error", text: message })
          setConnectionDialogOpen(true)
          addActivity("A conexão precisa ser configurada.", "error")
        }
        return null
      }

      requestInFlightRef.current = true
      lastRequestErrorRef.current = null
      setSending(true)
      setConnectionHealth("checking")

      try {
        const result = await callHolyrics(connection, action, payload)
        setConnectionHealth("connected")
        if (!quiet) setFeedback(null)
        return result
      } catch (error) {
        const message = readApiError(error)
        lastRequestErrorRef.current = message
        setConnectionHealth("error")
        if (!quiet) {
          setFeedback({ tone: "error", text: message })
          addActivity(message, "error")
        }
        return null
      } finally {
        requestInFlightRef.current = false
        setSending(false)
      }
    },
    [addActivity, connection],
  )

  const projectReference = useCallback(
    async (reference: BibleReference, source: string) => {
      const verseEnd = reference.verseEnd ?? reference.verse
      if (verseEnd - reference.verse + 1 > 100) {
        setFeedback({ tone: "error", text: "A API do Holyrics aceita até 100 versículos por apresentação." })
        return false
      }

      const passages = getBiblePassages(bibleBooks, reference)
      if (bibleBooks && !passages) {
        setFeedback({ tone: "error", text: "Essa referência não existe na tradução selecionada." })
        return false
      }

      const ids = Array.from({ length: verseEnd - reference.verse + 1 }, (_, offset) =>
        bibleVerseId({ book: reference.book, chapter: reference.chapter, verse: reference.verse + offset }),
      )
      const payload: HolyricsPayload = ids.length > 1 ? { ids } : { id: ids[0] }
      if (projectionVersion) payload.version = projectionVersion

      const result = await requestHolyrics("ShowVerse", payload)
      if (!result) return false

      setCurrentReference(reference)
      setSuggestion(null)
      setFeedback({ tone: "success", text: `${formatBibleReference(reference)} enviado ao telão.` })
      addActivity(`Projetado ${formatBibleReference(reference)} · ${source}.`, "success")
      return true
    },
    [addActivity, bibleBooks, projectionVersion, requestHolyrics],
  )

  const navigate = useCallback(
    async (direction: "next" | "previous") => {
      if (!currentReference) {
        setFeedback({ tone: "info", text: "Projete uma passagem bíblica antes de avançar ou voltar." })
        return
      }

      const nextReference = getAdjacentBibleReference(currentReference, direction, bibleBooks)
      if (!nextReference) {
        setFeedback({ tone: "info", text: direction === "next" ? "Este é o último versículo disponível." : "Este é o primeiro versículo disponível." })
        return
      }

      const action = direction === "next" ? "ActionNext" : "ActionPrevious"
      const result = await requestHolyrics(action)
      if (!result) return

      setCurrentReference(nextReference)
      setSuggestion(null)
      setFeedback({ tone: "success", text: `${formatBibleReference(nextReference)} no telão.` })
      addActivity(`${direction === "next" ? "Próximo" : "Anterior"} · ${formatBibleReference(nextReference)}.`, "success")
    },
    [addActivity, bibleBooks, currentReference, requestHolyrics],
  )

  const closePresentation = useCallback(async () => {
    if (!currentReference) return
    const result = await requestHolyrics("CloseCurrentPresentation")
    if (!result) return

    setCurrentReference(null)
    setSuggestion(null)
    setFeedback({ tone: "success", text: "Apresentação bíblica fechada." })
    addActivity("Apresentação bíblica fechada.", "success")
  }, [addActivity, currentReference, requestHolyrics])

  const testConnection = useCallback(async () => {
    setConnectionTestMessage(null)
    if (!isConnectionConfigured(connection)) {
      setConnectionTestMessage({ tone: "error", text: "Preencha os dados da conexão e o token antes de testar." })
      return
    }

    setTestingConnection(true)
    const tokenInfo = await requestHolyrics("GetTokenInfo", {}, true)
    if (!tokenInfo || !readData(tokenInfo)) {
      setConnectionHealth("error")
      setConnectionTestMessage({
        tone: "error",
        text: lastRequestErrorRef.current ?? "Não foi possível confirmar o token e as permissões do Holyrics.",
      })
      setTestingConnection(false)
      return
    }

    const versionsResult = await requestHolyrics("GetBibleVersionsV2", {}, true)
    const versions = readHolyricsVersions(versionsResult)
    setHolyricsVersions(versions)

    const settingsResult = await requestHolyrics("GetBibleSettings", {}, true)
    const settings = readData(settingsResult)
    const activeVersion = typeof settings?.tab_version_1 === "string" ? settings.tab_version_1 : ""
    if (activeVersion) {
      setProjectionVersion(activeVersion)
      const matchingTranslation = BIBLE_TRANSLATIONS.find((item) => item.value === activeVersion)
      if (matchingTranslation) setTranslation(matchingTranslation.value)
    }

    setConnectionHealth("connected")
    const tokenData = readData(tokenInfo)
    const appVersion = typeof tokenData?.version === "string" ? ` · Holyrics ${tokenData.version}` : ""
    const versionNote = versions.length ? ` ${versions.length} versões em português carregadas.` : " Será usada a versão padrão se a lista não estiver disponível."
    setConnectionTestMessage({ tone: "success", text: `Conexão confirmada${appVersion}.${versionNote}` })
    addActivity("Conexão com o Holyrics verificada.", "success")
    setTestingConnection(false)
  }, [addActivity, connection, requestHolyrics])

  const updateConnection = useCallback((nextConnection: HolyricsConnection) => {
    setConnection(nextConnection)
    setConnectionHealth("idle")
    setConnectionTestMessage(null)
    setHolyricsVersions([])
    setProjectionVersion("")
    lastRequestErrorRef.current = null
  }, [])

  const requestWakeLock = useCallback(async () => {
    const provider = (navigator as NavigatorWithWakeLock).wakeLock
    if (!provider) return
    try {
      wakeLockRef.current = await provider.request("screen")
    } catch {
      wakeLockRef.current = null
    }
  }, [])

  const releaseWakeLock = useCallback(() => {
    const lock = wakeLockRef.current
    wakeLockRef.current = null
    if (lock) void lock.release().catch(() => undefined)
  }, [])

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const stopListening = useCallback(() => {
    shouldListenRef.current = false
    fatalErrorRef.current = false
    clearRestartTimer()
    finalWordsRef.current = []
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      try {
        recognition.abort()
      } catch {
        /* noop */
      }
    }
    setListening(false)
    setLiveTranscript("")
    releaseWakeLock()
  }, [clearRestartTimer, releaseWakeLock])

  const handleNavigationCommand = useCallback(
    async (command: NavigationCommand) => {
      if (command === "next") return navigate("next")
      if (command === "previous") return navigate("previous")
      return closePresentation()
    },
    [closePresentation, navigate],
  )

  handleFinalTranscriptRef.current = async (transcript: string) => {
    const spokenWords = normalizeSpeech(transcript).split(" ").filter(Boolean)
    if (!spokenWords.length) return

    const accumulated = [...finalWordsRef.current, ...spokenWords].slice(-36)
    finalWordsRef.current = accumulated

    const command = parseNavigationCommand(transcript)
    if (command) {
      finalWordsRef.current = []
      await handleNavigationCommand(command)
      return
    }

    const reference = parseBibleReference(accumulated.join(" "))
    if (reference) {
      finalWordsRef.current = []
      await projectReference(reference, "referência falada")
      return
    }

    if (!recognizeText || !bibleIndex) return

    const match = findQuotedVerse(bibleIndex, accumulated.join(" "))
    if (!match) {
      if (accumulated.length > 30) finalWordsRef.current = accumulated.slice(-24)
      return
    }

    const matchKey = bibleReferenceKey(match.reference)
    if (currentReference && bibleReferenceKey(currentReference) === matchKey) return
    if (lastQuoteKeyRef.current === matchKey && Date.now() - lastQuoteAtRef.current < 8_000) return

    lastQuoteKeyRef.current = matchKey
    lastQuoteAtRef.current = Date.now()
    finalWordsRef.current = accumulated.slice(-8)

    if (autoProject && match.confidence === "strong") {
      finalWordsRef.current = []
      setSuggestion(null)
      await projectReference(match.reference, "trecho reconhecido automaticamente")
      return
    }

    setSuggestion(match)
    setFeedback({ tone: "info", text: "Encontrei uma possível passagem. Confirme a sugestão antes de projetar." })
    addActivity(`Sugestão encontrada: ${formatBibleReference(match.reference)}.`, "info")
  }

  const startListening = useCallback(() => {
    const Recognition = getSpeechConstructor()
    if (!Recognition) {
      setSpeechSupported(false)
      setFeedback({ tone: "error", text: "O reconhecimento de voz não está disponível neste navegador. Digite a referência manualmente." })
      return
    }
    if (shouldListenRef.current) return

    // Garante que não exista instância zumbi (HMR, clique duplo, restart anterior)
    clearRestartTimer()
    const previous = recognitionRef.current
    recognitionRef.current = null
    if (previous) {
      try {
        previous.abort()
      } catch {
        /* noop */
      }
    }

    fatalErrorRef.current = false
    setMicBlocked(false)

    const recognition = new Recognition()
    recognition.lang = "pt-BR"
    // continuous=false é o modo mais estável no Chrome; nós reiniciamos
    // manualmente no onend quando ainda há intenção de escutar.
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let restartAttempts = 0

    recognition.onresult = (event) => {
      restartAttempts = 0
      let latestTranscript = ""
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const transcript = result?.[0]?.transcript?.trim() ?? ""
        if (!transcript) continue
        latestTranscript = transcript
        if (result.isFinal) {
          finalQueueRef.current = finalQueueRef.current
            .then(() => handleFinalTranscriptRef.current(transcript))
            .catch(() => undefined)
        }
      }
      if (latestTranscript) setLiveTranscript(latestTranscript)
    }

    recognition.onerror = (event) => {
      const errorCode = event?.error ?? "unknown"

      if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
        fatalErrorRef.current = true
        shouldListenRef.current = false
        clearRestartTimer()
        setListening(false)
        setMicBlocked(true)
        releaseWakeLock()
        setFeedback({ tone: "error", text: "Permita o acesso ao microfone nas configurações do navegador e tente novamente." })
        return
      }

      if (errorCode === "no-speech" || errorCode === "aborted") return

      setFeedback({ tone: "error", text: `Falha no reconhecimento de voz: ${errorCode}.` })
    }

    recognition.onend = () => {
      if (!shouldListenRef.current || fatalErrorRef.current) {
        setListening(false)
        return
      }

      restartAttempts = Math.min(restartAttempts + 1, 5)
      const delay = Math.min(300 * 2 ** (restartAttempts - 1), 5000)

      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null
        if (!shouldListenRef.current || fatalErrorRef.current) return
        if (recognitionRef.current !== recognition) return

        try {
          recognition.start()
        } catch {
          // Se a instância morreu, encerra e pede novo clique.
          try {
            recognition.abort()
          } catch {
            /* noop */
          }
          if (recognitionRef.current === recognition) recognitionRef.current = null
          shouldListenRef.current = false
          setListening(false)
          releaseWakeLock()
          setFeedback({ tone: "error", text: "A escuta foi interrompida. Toque em Iniciar escuta novamente." })
        }
      }, delay)
    }

    recognitionRef.current = recognition
    shouldListenRef.current = true
    setListening(true)
    setLiveTranscript("")
    setFeedback({ tone: "info", text: "Escuta ativa. Fale a referência ou leia o trecho bíblico." })
    void requestWakeLock()

    try {
      recognition.start()
    } catch {
      shouldListenRef.current = false
      recognitionRef.current = null
      setListening(false)
      setFeedback({ tone: "error", text: "Não foi possível iniciar o microfone. Verifique a permissão e tente novamente." })
      releaseWakeLock()
    }
  }, [clearRestartTimer, releaseWakeLock, requestWakeLock])

  const toggleListening = useCallback(() => {
    if (listening) stopListening()
    else startListening()
  }, [listening, startListening, stopListening])

  const submitManualReference = useCallback(
    async (value: string) => {
      const reference = parseBibleReference(value)
      if (!reference) {
        setFeedback({ tone: "error", text: "Não reconheci a referência. Tente “João 3:16” ou “Salmos 23:1-3”." })
        return
      }
      await projectReference(reference, "referência manual")
    },
    [projectReference],
  )

  const isConnected = connectionHealth === "connected"
  const connectionConfigured = isConnectionConfigured(connection)
  const statusLabel =
    connectionHealth === "checking"
      ? "Conectando"
      : connectionHealth === "error"
        ? "Verifique a conexão"
        : isConnected
          ? "Conectado"
          : connectionConfigured
            ? "Não testado"
            : "Não configurado"

  const bibleStatus = bibleError
    ? "A tradução não carregou; referências faladas continuam disponíveis."
    : bibleLoading
      ? "Carregando a Bíblia para reconhecer trechos…"
      : bibleBooks
        ? `Bíblia pronta · ${BIBLE_TRANSLATIONS.find((item) => item.value === translation)?.label ?? translation}.`
        : "Aguardando a tradução bíblica."

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechConstructor()))
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden && shouldListenRef.current) void requestWakeLock()
    }
    document.addEventListener("visibilitychange", handleVisibility)
    return () => document.removeEventListener("visibilitychange", handleVisibility)
  }, [requestWakeLock])

  useEffect(
    () => () => {
      shouldListenRef.current = false
      fatalErrorRef.current = false
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      const recognition = recognitionRef.current
      recognitionRef.current = null
      if (recognition) {
        try {
          recognition.abort()
        } catch {
          /* noop */
        }
      }
      releaseWakeLock()
    },
    [releaseWakeLock],
  )

  return (
    <main className="min-h-dvh px-4 pb-10 pt-4 sm:px-6 sm:pt-7 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
        <header className="flex items-center justify-between gap-3 border-b border-border/70 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/10">
              <BookOpen aria-hidden="true" className="size-5" />
            </div>
            <div className="leading-none">
              <p className="text-[10px] font-semibold tracking-[0.24em] text-muted-foreground">HOLYRICS</p>
              <p className="mt-1.5 text-sm font-bold tracking-[0.16em]">VOZ</p>
            </div>
            <Badge className="ml-1 hidden sm:inline-flex" variant="outline">Somente Bíblia</Badge>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge className="max-w-36 truncate" variant={connectionHealth === "error" ? "destructive" : isConnected ? "default" : "secondary"}>
              <span aria-hidden="true" className="mr-1.5 size-1.5 rounded-full bg-current opacity-80" />
              {statusLabel}
            </Badge>
            <Button
              aria-label="Abrir configurações da conexão"
              onClick={() => setConnectionDialogOpen(true)}
              size="icon"
              type="button"
              variant="outline"
            >
              <Settings2 />
            </Button>
          </div>
        </header>

        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-primary">
              <Radio aria-hidden="true" className="size-4" />
              CONTROLE BÍBLICO POR VOZ
            </div>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              A Bíblia no telão, sem sair do púlpito.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Dite livro, capítulo e versículo, leia um trecho ou diga “próximo”. O Holyrics recebe a passagem pelo celular.
            </p>
          </div>
          <Badge className="w-fit shrink-0 gap-1.5 px-3 py-1.5" variant="outline">
            <Wifi aria-hidden="true" />
            "Rede local"
          </Badge>
        </section>

        {!connectionConfigured ? (
          <Card className="border-primary/25 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ShieldCheck aria-hidden="true" className="size-5" />
                </div>
                <div>
                  <p className="font-medium">Conecte o computador que executa o Holyrics</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Configure IP e token na rede local ou use API_KEY e token no modo Internet.
                  </p>
                </div>
              </div>
              <Button className="shrink-0" onClick={() => setConnectionDialogOpen(true)} type="button" variant="outline">
                Configurar conexão
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {connectionHealth === "error" ? (
          <div className="flex items-start gap-2 text-sm text-destructive" role="status">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p>Não foi possível confirmar a conexão. Confira os dados e as permissões do token.</p>
          </div>
        ) : null}

        {micBlocked ? (
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between" role="status">
            <div className="flex items-start gap-2">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p>
                O microfone está bloqueado para esta página. Permita o acesso no ícone de cadeado do navegador e
                recarregue a página. Em seguida, toque em “Iniciar escuta”.
              </p>
            </div>
            <Button onClick={() => setMicBlocked(false)} type="button" variant="outline">
              Já permiti
            </Button>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
          <div className="flex min-w-0 flex-col gap-5">
            <VoiceControlCard
              bibleBooks={bibleBooks}
              feedback={feedback}
              isListening={listening}
              isSending={sending}
              liveTranscript={liveTranscript}
              onProjectSuggestion={() => {
                if (suggestion) void projectReference(suggestion.reference, "sugestão confirmada")
              }}
              onToggleListening={toggleListening}
              speechSupported={speechSupported}
              suggestion={suggestion}
            />
            <PresentationCard
              bibleBooks={bibleBooks}
              busy={sending || testingConnection}
              onClose={() => void closePresentation()}
              onNavigate={(direction) => void navigate(direction)}
              reference={currentReference}
            />
          </div>

          <aside aria-label="Configurações e comandos da Bíblia" className="flex min-w-0 flex-col gap-5">
            <VoiceSettingsCard
              autoProject={autoProject}
              bibleLoading={bibleLoading}
              bibleStatus={bibleStatus}
              holyricsVersions={holyricsVersions}
              onAutoProjectChange={setAutoProject}
              onProjectionVersionChange={(version) => {
                setProjectionVersion(version)
                const matchingTranslation = BIBLE_TRANSLATIONS.find((item) => item.value === version)
                if (matchingTranslation) setTranslation(matchingTranslation.value)
              }}
              onRecognizeTextChange={setRecognizeText}
              onTranslationChange={setTranslation}
              projectionVersion={projectionVersion}
              recognizeText={recognizeText}
              translation={translation}
            />
            
            <ActivityCard entries={activity} />
          </aside>
        </div>

        <footer className="flex flex-col gap-2 border-t border-border/70 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Credenciais mantidas somente na memória desta aba.
          </span>
          <span>Deixe esta página aberta durante a ministração para manter a escuta ativa.</span>
        </footer>
      </div>

      <ConnectionDialog
        connection={connection}
        onConnectionChange={updateConnection}
        onOpenChange={setConnectionDialogOpen}
        onTest={() => void testConnection()}
        open={connectionDialogOpen}
        testMessage={connectionTestMessage}
        testing={testingConnection || sending}
      />
    </main>
  )
}