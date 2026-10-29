"use client"

import { useState } from "react"
import { ArrowUpRight, BookMarked } from "lucide-react"
import type { FormEvent, KeyboardEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

interface ManualReferenceCardProps {
  onSubmitReference: (reference: string) => void
}

export function ManualReferenceCard({ onSubmitReference }: ManualReferenceCardProps) {
  const [reference, setReference] = useState("")

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = reference.trim()
    if (value) onSubmitReference(value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === "Enter") {
      event.preventDefault()
      const value = reference.trim()
      if (value) onSubmitReference(value)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <BookMarked aria-hidden="true" className="size-4" />
          <p className="text-xs font-semibold tracking-[0.16em]">REFERÊNCIA MANUAL</p>
        </div>
        <CardTitle className="text-lg">Digitar passagem</CardTitle>
        <CardDescription>Use se o reconhecimento de voz não estiver disponível.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="bible-reference">Livro, capítulo e versículo</FieldLabel>
              <Input
                autoComplete="off"
                id="bible-reference"
                name="bible-reference"
                onChange={(event) => setReference(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex.: João 3:16-18"
                value={reference}
              />
              <FieldDescription>Também aceita “Primeira João, capítulo três, versículo dezesseis”.</FieldDescription>
            </Field>
          </FieldGroup>
          <Button className="w-full" type="submit">
            <ArrowUpRight data-icon="inline-start" />
            Projetar referência
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
