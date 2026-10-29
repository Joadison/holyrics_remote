import { History } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

export interface ActivityEntry {
  id: string
  time: string
  message: string
  tone: "success" | "error" | "info"
}

interface ActivityCardProps {
  entries: ActivityEntry[]
}

export function ActivityCard({ entries }: ActivityCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <History aria-hidden="true" className="size-4" />
          <p className="text-xs font-semibold tracking-[0.16em]">SESSÃO</p>
        </div>
        <CardTitle className="text-lg">Atividade recente</CardTitle>
        <CardDescription>As últimas ações enviadas ao Holyrics nesta aba.</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length ? (
          <ol aria-label="Registro de atividade" className="flex max-h-56 flex-col gap-3 overflow-y-auto pr-1">
            {entries.map((entry) => (
              <li className="flex items-start gap-3 text-sm" key={entry.id}>
                <time className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">{entry.time}</time>
                <span className={entry.tone === "error" ? "text-destructive" : "text-foreground"}>{entry.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <Empty className="py-3">
            <EmptyHeader>
              <EmptyTitle className="text-sm">Nenhuma ação ainda</EmptyTitle>
              <EmptyDescription>Quando uma passagem for enviada, ela aparecerá aqui.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
