"use client"

import { useState } from "react"
import useSWR from "swr"
import {
  Check,
  ImageIcon,
  LoaderCircle,
  AlertCircle,
} from "lucide-react"
import {
  requestHolyricsApi,
  type HolyricsConnection,
} from "@/lib/holyrics-api"

import type { ApiRequest } from "@/components/holyrics/remote-panels"

const GET_BACKGROUNDS_ACTION = "GetThemes"

type Props = {
  connection: HolyricsConnection | null
  request: ApiRequest
  onThemeApplied?: (id: string) => void // nova prop opcional
}

export type Background = {
  id: string
  name: string
  type?: string
}

function normalizeBackgrounds(data: unknown): Background[] {
  const list: unknown[] = Array.isArray(data)
    ? data
    : data &&
        typeof data === "object" &&
        Array.isArray((data as { data?: unknown }).data)
      ? (data as { data: unknown[] }).data
      : []

  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return []

    const raw = item as Record<string, unknown>
    const id = raw.id ?? raw.name

    if (id == null) return []

    return [{
      id: String(id),
      name: String(raw.name ?? raw.title ?? id),
      type: typeof raw.type === "string" ? raw.type : "theme",
    }]
  })
}

export function BackgroundsBar({ connection, request, onThemeApplied }: Props) {
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [appliedId, setAppliedId] = useState<string | null>(null)

  const connectionKey = connection
  ? ([connection.host, connection.port, connection.token, "backgrounds"] as const)
  : null

  const fetchBackgrounds = async ([host, port, token]: readonly [string, string, string, string]) =>
    normalizeBackgrounds(
      await requestHolyricsApi({ host, port, token }, GET_BACKGROUNDS_ACTION, {}),
    )

  const { data, error, isLoading } = useSWR(connectionKey, fetchBackgrounds, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  async function applyBackground(background: Background) {
    if (!connection) return
    setApplyingId(background.id)

    try {
      await request("SetCurrentBackground", { id: background.id })
      setAppliedId(background.id)
      onThemeApplied?.(background.id)
    } catch (err) {
      console.error("Falha ao aplicar tema:", err)
    } finally {
      setApplyingId(null)
    }
  }

  if (!connection) return null

  return (
    <section
      aria-label="Temas da apresentação"
      className="backgrounds-bar"
    >
      <div className="backgrounds-heading">
        <ImageIcon aria-hidden="true" />
        <span>Temas da apresentação</span>

        {isLoading && (
          <LoaderCircle
            className="spin"
            aria-label="Carregando temas"
          />
        )}
      </div>

      {error && (
        <p className="activity-empty">
          Não foi possível carregar os temas.
        </p>
      )}

      {data?.length === 0 && (
        <p className="activity-empty">
          Nenhum tema encontrado.
        </p>
      )}

      <div className="backgrounds-list">
        {data?.map((background) => {
          const isActive = appliedId === background.id
          const isApplying = applyingId === background.id

          return (
            <button
              key={background.id}
              type="button"
              className={`background-chip${
                isActive ? " is-active" : ""
              }`}
              aria-pressed={isActive}
              disabled={applyingId !== null}
              onClick={() => void applyBackground(background)}
            >
              {isApplying ? (
                <LoaderCircle className="spin" aria-hidden="true" />
              ) : isActive ? (
                <Check aria-hidden="true" />
              ) : null}

              <span>{background.name}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
