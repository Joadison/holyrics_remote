export const HOLYRICS_STORAGE_KEY = "holyrics_remote_cfg"

export type HolyricsConnection = {
  host: string
  port: string
  token: string
}

export type HolyricsRequestBody = Record<string, unknown>

type ApiEnvelope = {
  status?: unknown
  error?: unknown
  data?: unknown
}

function normalizeHost(value: string) {
  const host = value.trim()
  const ipv6 = /^\[[\da-f:.]+\]$/i.test(host)
  const hostname = /^(?=.{1,253}$)[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)*\.?$/i.test(host)

  if (!host || (!ipv6 && !hostname) || /[/?#@\s]/.test(host)) {
    throw new Error("Informe somente o IP ou nome do computador, sem protocolo ou caminho.")
  }

  return host
}

export function validateHolyricsConnection(
  hostValue: string,
  portValue: string,
  tokenValue: string,
): HolyricsConnection {
  const host = normalizeHost(hostValue)
  const portNumber = Number(portValue.trim())
  const token = tokenValue.trim()

  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    throw new Error("Informe uma porta válida entre 1 e 65535.")
  }

  if (!token) {
    throw new Error("Informe o token de acesso do Holyrics.")
  }

  return { host, port: String(portNumber), token }
}

export function readSavedHolyricsConnection(): HolyricsConnection | null {
  try {
    const raw = window.localStorage.getItem(HOLYRICS_STORAGE_KEY)
    if (!raw) return null

    const saved = JSON.parse(raw) as Partial<HolyricsConnection>
    if (
      typeof saved.host !== "string" ||
      typeof saved.port !== "string" ||
      typeof saved.token !== "string"
    ) {
      return null
    }

    return validateHolyricsConnection(saved.host, saved.port, saved.token)
  } catch {
    // Configuração inválida não é removida automaticamente: o usuário decide quando atualizá-la.
    return null
  }
}

export async function requestHolyricsApi<T = unknown>(
  connection: HolyricsConnection,
  action: string,
  body: HolyricsRequestBody = {},
): Promise<T> {
  const validated = validateHolyricsConnection(
    connection.host,
    connection.port,
    connection.token,
  )

  let response: Response

  try {
    response = await fetch(
      `/api/holyrics/${encodeURIComponent(action)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connection: validated,
          body,
        }),
        cache: "no-store",
      },
    )
  } catch (error) {
    console.error("[Holyrics Remote]", error)

    throw new Error(
      "Não foi possível comunicar com o servidor local.",
    )
  }

  let payload: ApiEnvelope

  try {
    payload = await response.json()
  } catch {
    throw new Error(
      `Resposta inválida do servidor (HTTP ${response.status}).`,
    )
  }

  if (!response.ok || payload.status !== "ok") {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : `Falha na comunicação (HTTP ${response.status}).`,
    )
  }

  return payload.data as T
}

export function getHolyricsErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocorreu um erro ao falar com o Holyrics."
}
