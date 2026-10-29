import { Check, LoaderCircle, SlidersHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { BIBLE_TRANSLATIONS, type BibleTranslation } from "@/lib/bible"
import type { HolyricsBibleVersion } from "@/lib/holyrics"

interface VoiceSettingsCardProps {
  recognizeText: boolean
  autoProject: boolean
  translation: BibleTranslation
  projectionVersion: string
  holyricsVersions: HolyricsBibleVersion[]
  bibleStatus: string
  bibleLoading: boolean
  onRecognizeTextChange: (enabled: boolean) => void
  onAutoProjectChange: (enabled: boolean) => void
  onTranslationChange: (translation: BibleTranslation) => void
  onProjectionVersionChange: (version: string) => void
}

export function VoiceSettingsCard({
  recognizeText,
  autoProject,
  translation,
  projectionVersion,
  holyricsVersions,
  bibleStatus,
  bibleLoading,
  onRecognizeTextChange,
  onAutoProjectChange,
  onTranslationChange,
  onProjectionVersionChange,
}: VoiceSettingsCardProps) {
  const hasCurrentVersion = holyricsVersions.some((version) => version.version === projectionVersion)
  const recognitionItems = BIBLE_TRANSLATIONS.map((item) => ({ label: item.label, value: item.value }))
  const projectionItems = [
    { label: "Padrão do Holyrics", value: "holyrics-default" },
    ...(projectionVersion && !hasCurrentVersion
      ? [{ label: `Versão ativa · ${projectionVersion}`, value: projectionVersion }]
      : []),
    ...holyricsVersions.map((version) => ({ label: version.title, value: version.version })),
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          <p className="text-xs font-semibold tracking-[0.16em]">RECONHECIMENTO</p>
        </div>
        <CardTitle className="text-lg">Ajustes de leitura</CardTitle>
        <CardDescription>Escolha como a fala será interpretada antes de chegar ao telão.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <FieldGroup className="gap-5">
          <Field className="items-center justify-between" orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="recognize-bible-text">Reconhecer trecho bíblico</FieldLabel>
              <FieldDescription>Compara a fala com a tradução selecionada.</FieldDescription>
            </FieldContent>
            <Switch checked={recognizeText} id="recognize-bible-text" onCheckedChange={onRecognizeTextChange} />
          </Field>

          <Field className="items-center justify-between" orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="auto-project-match">Projetar automaticamente</FieldLabel>
              <FieldDescription>Somente quando a correspondência for forte.</FieldDescription>
            </FieldContent>
            <Switch checked={autoProject} id="auto-project-match" onCheckedChange={onAutoProjectChange} />
          </Field>

          <Field>
            <FieldLabel htmlFor="recognition-translation">Versão para reconhecer o texto</FieldLabel>
            <Select
              items={recognitionItems}
              value={translation}
              onValueChange={(value) => {
                const selected = BIBLE_TRANSLATIONS.find((item) => item.value === value)
                if (selected) onTranslationChange(selected.value)
              }}
            >
              <SelectTrigger id="recognition-translation">
                <SelectValue placeholder="Escolha uma tradução" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {recognitionItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="projection-translation">Versão usada no Holyrics</FieldLabel>
            <Select
              items={projectionItems}
              value={projectionVersion || "holyrics-default"}
              onValueChange={(value) => onProjectionVersionChange(value === "holyrics-default" ? "" : value ?? "")}
            >
              <SelectTrigger id="projection-translation">
                <SelectValue placeholder="Padrão do Holyrics" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {projectionItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              Ao testar a conexão, a versão principal do Holyrics é selecionada automaticamente quando disponível.
            </FieldDescription>
          </Field>
        </FieldGroup>

        <Separator />
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          {bibleLoading ? <LoaderCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 animate-spin" /> : <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />}
          <p>{recognizeText ? bibleStatus : "A detecção por trecho está desativada; referências faladas continuam funcionando."}</p>
        </div>
        <Badge className="w-fit" variant="outline">
          {recognizeText ? "Leia pelo menos 8 palavras" : "Modo referência"}
        </Badge>
      </CardContent>
    </Card>
  )
}
