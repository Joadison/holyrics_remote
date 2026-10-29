import { LoaderCircle, Mic, MicOff, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getBiblePassages, formatBibleReference, type BibleBook, type BibleQuoteMatch } from "@/lib/bible"

export interface VoiceFeedback {
  tone: "success" | "error" | "info"
  text: string
}

interface VoiceControlCardProps {
  isListening: boolean
  isSending: boolean
  speechSupported: boolean | null
  liveTranscript: string
  bibleBooks?: BibleBook[]
  feedback: VoiceFeedback | null
  suggestion: BibleQuoteMatch | null
  onToggleListening: () => void
  onProjectSuggestion: () => void
}

export function VoiceControlCard({
  isListening,
  isSending,
  speechSupported,
  liveTranscript,
  bibleBooks,
  feedback,
  suggestion,
  onToggleListening,
  onProjectSuggestion,
}: VoiceControlCardProps) {
  const suggestionText = suggestion
    ? getBiblePassages(bibleBooks, suggestion.reference)?.map((passage) => passage.text).join(" ") ?? suggestion.text
    : ""

  return (
    <>
      <Card className="overflow-hidden border-primary/15 bg-card shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-primary">CONTROLE POR VOZ</p>
              <CardTitle className="mt-2 text-xl">Fale com o telão</CardTitle>
            </div>
            <Badge variant={isListening ? "default" : "secondary"}>
              <span
                aria-hidden="true"
                className={`mr-1.5 size-1.5 rounded-full ${isListening ? "bg-primary-foreground" : "bg-muted-foreground"}`}
              />
              {isListening ? "Ouvindo" : "Em espera"}
            </Badge>
          </div>
          <CardDescription>
            Diga uma referência bíblica ou leia um trecho para localizar o versículo.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <Button
            aria-pressed={isListening}
            className="min-h-24 w-full flex-col gap-2 rounded-2xl py-5 text-base whitespace-normal"
            disabled={isSending}
            onClick={onToggleListening}
            size="lg"
            type="button"
            variant={isListening ? "secondary" : "default"}
          >
            {isSending ? (
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
            ) : isListening ? (
              <MicOff data-icon="inline-start" />
            ) : (
              <Mic data-icon="inline-start" />
            )}
            <span className="font-semibold">{isSending ? "Enviando ao Holyrics" : isListening ? "Parar escuta" : "Iniciar escuta"}</span>
            <span className="text-xs font-normal opacity-80">
              {isListening ? "Toque para pausar o microfone" : "Toque e permita o acesso ao microfone"}
            </span>
          </Button>

          <div className="rounded-xl border border-border/70 bg-background/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Mic aria-hidden="true" className="size-3.5" />
              Você disse
            </div>
            <p aria-live="polite" className="min-h-6 text-sm leading-relaxed text-foreground">
              {liveTranscript || "Aguardando sua voz…"}
            </p>
          </div>

          {speechSupported === false ? (
            <p className="text-sm text-muted-foreground">
              Este navegador não oferece reconhecimento de voz. Use a referência manual abaixo ou abra no navegador do celular que suporte ditado.
            </p>
          ) : null}

          {feedback ? (
            <p
              aria-live={feedback.tone === "error" ? "assertive" : "polite"}
              className={
                feedback.tone === "error"
                  ? "text-sm text-destructive"
                  : feedback.tone === "success"
                    ? "text-sm text-primary"
                    : "text-sm text-muted-foreground"
              }
              role={feedback.tone === "error" ? "alert" : "status"}
            >
              {feedback.text}
            </p>
          ) : null}

          <p className="text-xs leading-relaxed text-muted-foreground">
            Exemplos: “João 3:16”, “próximo”, “anterior” ou leia um trecho com pelo menos oito palavras.
          </p>
        </CardContent>
      </Card>

      {suggestion ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles aria-hidden="true" className="size-4" />
              <p className="text-xs font-semibold tracking-[0.14em]">SUGESTÃO DE TRECHO</p>
            </div>
            <CardTitle className="text-lg">{formatBibleReference(suggestion.reference)}</CardTitle>
            <CardDescription>
              {suggestion.confidence === "strong"
                ? "Encontrei uma correspondência forte. Confirme para projetar."
                : "Encontrei uma possível correspondência. Confira antes de projetar."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="font-serif text-base leading-relaxed text-foreground">{suggestionText}</p>
            <Button onClick={onProjectSuggestion} type="button">
              Projetar este versículo
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
