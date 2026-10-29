"use client"

import { Globe, LoaderCircle, ShieldCheck, Wifi } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import type { HolyricsConnection } from "@/lib/holyrics"

export interface ConnectionTestMessage {
  tone: "success" | "error" | "info"
  text: string
}

interface ConnectionDialogProps {
  open: boolean
  connection: HolyricsConnection
  testMessage: ConnectionTestMessage | null
  testing: boolean
  onOpenChange: (open: boolean) => void
  onConnectionChange: (connection: HolyricsConnection) => void
  onTest: () => void
}

export function ConnectionDialog({
  open,
  connection,
  testMessage,
  testing,
  onOpenChange,
  onConnectionChange,
  onTest,
}: ConnectionDialogProps) {
  const connectionModeItems = [
    { label: "Rede local · IP do computador", value: "local" },
    { label: "Internet · API Holyrics", value: "internet" },
  ]

  const update = (field: keyof HolyricsConnection, value: string) => {
    if (field === "mode") {
      onConnectionChange({ ...connection, mode: value === "internet" ? "internet" : "local" })
      return
    }
    onConnectionChange({ ...connection, [field]: value })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck aria-hidden="true" className="size-5" />
            </div>
            <DialogTitle>Conectar ao Holyrics</DialogTitle>
          </div>
          <DialogDescription>
            Configure a conexão usada para enviar referências bíblicas e comandos de navegação.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="holyrics-mode">Forma de conexão</FieldLabel>
            <Select
              items={connectionModeItems}
              value={connection.mode}
              onValueChange={(value) => {
                if (value) update("mode", value)
              }}
            >
              <SelectTrigger id="holyrics-mode">
                <SelectValue placeholder="Selecione como conectar" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="local">Rede local · IP do computador</SelectItem>
                  <SelectItem value="internet">Internet · API Holyrics</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldDescription>
              Use Internet para controlar o Holyrics pelo celular fora da mesma rede.
            </FieldDescription>
          </Field>

          {connection.mode === "local" ? (
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="holyrics-host">IP local do computador</FieldLabel>
                <Input
                  autoComplete="off"
                  id="holyrics-host"
                  inputMode="decimal"
                  onChange={(event) => update("host", event.target.value)}
                  placeholder="192.168.0.10"
                  value={connection.host}
                />
                <FieldDescription>O celular e o computador precisam estar na mesma rede Wi-Fi.</FieldDescription>
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="holyrics-port">Porta da API</FieldLabel>
                <Input
                  autoComplete="off"
                  id="holyrics-port"
                  inputMode="numeric"
                  max={65535}
                  min={1}
                  onChange={(event) => update("port", event.target.value)}
                  type="number"
                  value={connection.port}
                />
                <FieldDescription>Confira a porta configurada no API Server do Holyrics.</FieldDescription>
              </Field>
            </FieldGroup>
          ) : (
            <Field>
              <FieldLabel htmlFor="holyrics-api-key">API_KEY</FieldLabel>
              <Input
                autoComplete="off"
                id="holyrics-api-key"
                onChange={(event) => update("apiKey", event.target.value)}
                placeholder="Cole a API_KEY do serviço Holyrics"
                type="password"
                value={connection.apiKey}
              />
              <FieldDescription>Usada somente nas solicitações enviadas à API pela conexão HTTPS.</FieldDescription>
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="holyrics-token">Token do Holyrics</FieldLabel>
            <Input
              autoComplete="off"
              id="holyrics-token"
              onChange={(event) => update("token", event.target.value)}
              placeholder="Cole o token de acesso"
              type="password"
              value={connection.token}
            />
            <FieldDescription>O token precisa permitir Bíblia, próximo, anterior e fechar apresentação.</FieldDescription>
          </Field>

          <Separator />
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            {connection.mode === "local" ? (
              <Wifi aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            ) : (
              <Globe aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            )}
            <p>
              API_KEY e token ficam apenas na memória desta aba. No modo local, uma página HTTPS pode ser impedida pelo
              navegador de acessar a API HTTP do computador; nesse caso, use o modo Internet.
            </p>
          </div>

          {testMessage ? (
            <p
              aria-live="polite"
              className={
                testMessage.tone === "error"
                  ? "text-sm text-destructive"
                  : testMessage.tone === "success"
                    ? "text-sm text-primary"
                    : "text-sm text-muted-foreground"
              }
              role={testMessage.tone === "error" ? "alert" : "status"}
            >
              {testMessage.text}
            </p>
          ) : null}
        </FieldGroup>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Fechar
          </Button>
          <Button disabled={testing} onClick={onTest} type="button">
            {testing ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <ShieldCheck data-icon="inline-start" />}
            {testing ? "Testando conexão" : "Testar conexão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
