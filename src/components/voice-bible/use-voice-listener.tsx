"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface SpeechResultLike {
  isFinal: boolean
  0?: { transcript: string }
}
interface SpeechEventLike {
  resultIndex: number
  results: ArrayLike<SpeechResultLike>
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => SpeechRecognitionLike
type WindowWithSpeech = Window & {
  SpeechRecognition?: RecognitionCtor
  webkitSpeechRecognition?: RecognitionCtor
}
type WakeLockSentinelLike = { release: () => Promise<void> }
type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> }
}

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as WindowWithSpeech
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/**
 * Escuta contínua em pt-BR. Chama `onFinal` (em fila, um por vez)
 * para cada trecho final reconhecido.
 */
export function useVoiceListener(onFinal: (transcript: string) => Promise<void> | void) {
  const [listening, setListening] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState("")
  const [supported, setSupported] = useState<boolean | null>(null)
  const [micBlocked, setMicBlocked] = useState(false)
  const [error, setError] = useState("")

  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const shouldListenRef = useRef(false)
  const fatalRef = useRef(false)
  const restartTimerRef = useRef<number | null>(null)
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())

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

  const clearTimer = useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    shouldListenRef.current = false
    fatalRef.current = false
    clearTimer()
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
  }, [clearTimer, releaseWakeLock])

  const startRecognition = useCallback(() => {
    const Recognition = getRecognitionCtor()
    if (!Recognition) {
      setSupported(false)
      setError("O reconhecimento de voz não está disponível neste navegador (use Chrome/Edge/Safari em HTTPS).")
      return
    }
    if (shouldListenRef.current) return

    clearTimer()
    const previous = recognitionRef.current
    recognitionRef.current = null
    if (previous) {
      try {
        previous.abort()
      } catch {
        /* noop */
      }
    }

    fatalRef.current = false
    setMicBlocked(false)
    setError("")

    const recognition = new Recognition()
    recognition.lang = "pt-BR"
    recognition.continuous = false // mais estável no Chrome; reiniciamos no onend
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let restartAttempts = 0

    recognition.onresult = (event) => {
      restartAttempts = 0
      let latest = ""
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = result?.[0]?.transcript?.trim() ?? ""
        if (!transcript) continue
        latest = transcript
        if (result.isFinal) {
          queueRef.current = queueRef.current
            .then(() => onFinalRef.current(transcript))
            .catch(() => undefined)
        }
      }
      if (latest) setLiveTranscript(latest)
    }

    recognition.onerror = (event) => {
      const code = event?.error ?? "unknown"
      if (code === "not-allowed" || code === "service-not-allowed") {
        fatalRef.current = true
        shouldListenRef.current = false
        clearTimer()
        setListening(false)
        setMicBlocked(true)
        releaseWakeLock()
        setError(
          code === "service-not-allowed"
            ? "O serviço de voz do navegador foi recusado (service-not-allowed). Use Chrome ou Edge, em HTTPS ou localhost, e confira se a página não está dentro de um iframe/preview."
            : "O navegador recusou o reconhecimento de voz (not-allowed), mesmo com o microfone liberado. Veja se a página está em HTTPS/localhost e se não há Permissions-Policy bloqueando o microfone.",
        )
        return
      }

      if (code === "no-speech" || code === "aborted") return
      setError(`Falha no reconhecimento de voz: ${code}.`)
    }

    recognition.onend = () => {
      if (!shouldListenRef.current || fatalRef.current) {
        setListening(false)
        return
      }
      restartAttempts = Math.min(restartAttempts + 1, 5)
      const delay = Math.min(300 * 2 ** (restartAttempts - 1), 5000)
      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null
        if (!shouldListenRef.current || fatalRef.current) return
        if (recognitionRef.current !== recognition) return
        try {
          recognition.start()
        } catch {
          try {
            recognition.abort()
          } catch {
            /* noop */
          }
          if (recognitionRef.current === recognition) recognitionRef.current = null
          shouldListenRef.current = false
          setListening(false)
          releaseWakeLock()
          setError("A escuta foi interrompida. Toque em Iniciar escuta novamente.")
        }
      }, delay)
    }

    recognitionRef.current = recognition
    shouldListenRef.current = true
    setListening(true)
    setLiveTranscript("")
    void requestWakeLock()

    try {
      recognition.start()
    } catch {
      shouldListenRef.current = false
      recognitionRef.current = null
      setListening(false)
      releaseWakeLock()
      setError("Não foi possível iniciar o microfone. Verifique a permissão e tente novamente.")
    }
  }, [clearTimer, releaseWakeLock, requestWakeLock])


  const startingRef = useRef(false)

  /** Diagnostica o motivo real antes de iniciar o reconhecimento. */
  const start = useCallback(async () => {
    if (startingRef.current || shouldListenRef.current) return
    setError("")

    if (!window.isSecureContext) {
      setMicBlocked(true)
      setError(
        `Esta página não é segura (${location.origin}). O microfone só funciona em HTTPS ou em http://localhost. Abra por localhost ou rode o app com HTTPS.`,
      )
      return
    }

    if (window.self !== window.top) {
      setError("A página está dentro de um iframe/preview, que bloqueia o microfone. Abra o app direto em uma aba do navegador.")
      return
    }

    if (navigator.mediaDevices?.getUserMedia) {
      startingRef.current = true
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "Error"
        setMicBlocked(name === "NotAllowedError" || name === "SecurityError")
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? `Microfone negado para este site (${name}). Clique no cadeado ao lado do endereço > Microfone > Permitir, e recarregue. Se o site for um IP, o navegador pode estar bloqueando por não ser HTTPS.`
            : name === "NotFoundError"
              ? "Nenhum microfone encontrado neste aparelho."
              : name === "NotReadableError"
                ? "O microfone está em uso por outro programa ou aba."
                : `Não foi possível acessar o microfone (${name}).`,
        )
        return
      } finally {
        startingRef.current = false
      }
    }

    startRecognition()
  }, [startRecognition])

  useEffect(() => {
    setSupported(Boolean(getRecognitionCtor()))
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden && shouldListenRef.current) void requestWakeLock()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [requestWakeLock])

  useEffect(() => stop, [stop])

  return { listening, liveTranscript, supported, micBlocked, error, start, stop, clearError: () => setError("") }
}