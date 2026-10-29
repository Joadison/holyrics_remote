import { BookOpen, ChevronLeft, ChevronRight, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  formatBibleReference,
  getAdjacentBibleReference,
  getBiblePassages,
  type BibleBook,
  type BibleReference,
} from "@/lib/bible"

interface PresentationCardProps {
  reference: BibleReference | null
  bibleBooks?: BibleBook[]
  busy: boolean
  onNavigate: (direction: "next" | "previous") => void
  onClose: () => void
}

export function PresentationCard({ reference, bibleBooks, busy, onNavigate, onClose }: PresentationCardProps) {
  const passages = reference ? getBiblePassages(bibleBooks, reference) : null
  const canGoPrevious = reference ? Boolean(getAdjacentBibleReference(reference, "previous", bibleBooks)) : false
  const canGoNext = reference ? Boolean(getAdjacentBibleReference(reference, "next", bibleBooks)) : false

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-primary">PROJEÇÃO</p>
            <CardTitle className="mt-2 text-xl">No telão</CardTitle>
          </div>
          <Badge variant={reference ? "default" : "secondary"}>{reference ? "Bíblia" : "Aguardando"}</Badge>
        </div>
        <CardDescription>
          A passagem e o texto abaixo representam a última solicitação enviada ao Holyrics.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {reference ? (
          <div className="flex flex-col gap-4">
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              {formatBibleReference(reference)}
            </h2>
            {passages?.length ? (
              <div className="flex flex-col gap-3">
                {passages.map((passage) => (
                  <p className="font-serif text-lg leading-relaxed text-foreground" key={`${passage.reference.book}-${passage.reference.chapter}-${passage.reference.verse}`}>
                    {passages.length > 1 ? (
                      <span className="mr-2 align-top text-xs font-sans font-semibold text-primary">
                        {passage.reference.verse}
                      </span>
                    ) : null}
                    {passage.text}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                A referência foi enviada. O texto desta tradução ainda não está disponível neste aparelho.
              </p>
            )}
          </div>
        ) : (
          <Empty className="rounded-xl border border-dashed border-border/70 px-4 py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Nenhuma passagem projetada</EmptyTitle>
              <EmptyDescription>
                Dite uma referência, como João 3:16, ou digite a passagem no campo manual.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>

      <CardFooter className="grid grid-cols-3 gap-2 border-t border-border/60 bg-transparent">
        <Button
          aria-label="Versículo anterior"
          disabled={!canGoPrevious || busy}
          onClick={() => onNavigate("previous")}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft data-icon="inline-start" />
          Anterior
        </Button>
        <Button
          disabled={!canGoNext || busy}
          onClick={() => onNavigate("next")}
          size="sm"
          type="button"
          variant="outline"
        >
          Próximo
          <ChevronRight data-icon="inline-end" />
        </Button>
        <Button
          aria-label="Fechar apresentação bíblica"
          disabled={!reference || busy}
          onClick={onClose}
          size="sm"
          type="button"
          variant="ghost"
        >
          <X data-icon="inline-start" />
          Fechar
        </Button>
      </CardFooter>
    </Card>
  )
}
