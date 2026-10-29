export type HolyricsMode = "local" | "internet"

export interface HolyricsConnection {
  mode: HolyricsMode
  host: string
  port: string
  apiKey: string
  token: string
}

export interface HolyricsBibleVersion {
  version: string
  title: string
}

export type HolyricsAction =
  | "ShowVerse"
  | "ActionNext"
  | "ActionPrevious"
  | "CloseCurrentPresentation"
  | "GetTokenInfo"
  | "GetBibleVersionsV2"
  | "GetBibleSettings"

export type HolyricsPayload = Record<string, unknown>

export function isAllowedLocalHost(host: string) {
  const value = host.trim().toLowerCase()
  if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.local$/.test(value)) return true

  const octets = value.split(".").map(Number)
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false
  }

  const [first, second] = octets
  return first === 10 || (first === 192 && second === 168) || (first === 172 && second >= 16 && second <= 31) || first === 127
}

export function isConnectionConfigured(connection: HolyricsConnection) {
  if (!connection.token.trim()) return false

  if (connection.mode === "internet") {
    return connection.apiKey.trim().length > 0
  }

  const port = Number(connection.port)
  return isAllowedLocalHost(connection.host) && Number.isInteger(port) && port >= 1 && port <= 65535
}

function readErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return "O Holyrics não aceitou a solicitação."
  const record = value as Record<string, unknown>
  if (typeof record.error === "string" && record.error.length > 0) return record.error.slice(0, 240)
  if (typeof record.message === "string" && record.message.length > 0) return record.message.slice(0, 240)
  return "O Holyrics não aceitou a solicitação. Confira o token e as permissões da API."
}

export async function callHolyrics(
  connection: HolyricsConnection,
  action: HolyricsAction,
  payload: HolyricsPayload = {},
): Promise<unknown> {
  if (!isConnectionConfigured(connection)) {
    throw new Error("Configure o token e os dados de conexão do Holyrics primeiro.")
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  const requestUrl =
    connection.mode === "internet"
      ? "/api/holyrics"
      : `http://${connection.host.trim()}:${Number(connection.port)}/api/${action}?token=${encodeURIComponent(connection.token.trim())}`
  const requestBody =
    connection.mode === "internet"
      ? JSON.stringify({ action, apiKey: connection.apiKey.trim(), token: connection.token.trim(), payload })
      : JSON.stringify(payload)

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    })
    const responseText = await response.text()
    let result: unknown = {}

    if (responseText) {
      try {
        result = JSON.parse(responseText)
      } catch {
        result = {}
      }
    }

    const status = result && typeof result === "object" ? (result as Record<string, unknown>).status : undefined
    if (!response.ok || status === "error") {
      throw new Error(readErrorMessage(result))
    }

    return result
  } catch (error) {
    if (error instanceof Error && error.name !== "AbortError" && error.message !== "Failed to fetch") {
      throw error
    }

    if (connection.mode === "local") {
      const httpsWarning = window.location.protocol === "https:" ? " Como esta página usa HTTPS, o navegador pode bloquear a API local em HTTP; tente o modo Internet." : ""
      throw new Error(`Não foi possível alcançar o Holyrics na rede local. Confira IP, porta, token e acesso à rede.${httpsWarning}`)
    }

    throw new Error("Não foi possível alcançar a API Holyrics. Confira a conexão e as credenciais.")
  } finally {
    window.clearTimeout(timeout)
  }
}
