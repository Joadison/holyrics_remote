import type { HolyricsAction, HolyricsPayload } from "@/lib/holyrics"

const ALLOWED_ACTIONS = new Set<HolyricsAction>([
  "ShowVerse",
  "ActionNext",
  "ActionPrevious",
  "CloseCurrentPresentation",
  "GetTokenInfo",
  "GetBibleVersionsV2",
  "GetBibleSettings",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function jsonResponse(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  })
}

function validPayload(action: HolyricsAction, payload: HolyricsPayload) {
  if (action !== "ShowVerse") return Object.keys(payload).length === 0

  const allowedFields = new Set(["id", "ids", "version"])
  if (Object.keys(payload).some((key) => !allowedFields.has(key))) return false

  if (payload.version !== undefined && (typeof payload.version !== "string" || payload.version.length > 128)) {
    return false
  }

  const validId = (value: unknown) => typeof value === "string" && /^\d{8}$/.test(value)
  const singleId = validId(payload.id)
  const multipleIds =
    Array.isArray(payload.ids) &&
    payload.ids.length > 0 &&
    payload.ids.length <= 100 &&
    payload.ids.every(validId)

  return singleId !== multipleIds
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > 20_000) return jsonResponse({ error: "Solicitação muito grande." }, 413)

  let input: unknown
  try {
    input = await request.json()
  } catch {
    return jsonResponse({ error: "Corpo JSON inválido." }, 400)
  }

  if (!isRecord(input)) return jsonResponse({ error: "Solicitação inválida." }, 400)

  const action = input.action
  const apiKey = input.apiKey
  const token = input.token
  const payload = isRecord(input.payload) ? input.payload : {}

  if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action as HolyricsAction)) {
    return jsonResponse({ error: "Ação Holyrics não permitida." }, 400)
  }
  if (typeof apiKey !== "string" || apiKey.length < 1 || apiKey.length > 512) {
    return jsonResponse({ error: "API_KEY inválida." }, 400)
  }
  if (typeof token !== "string" || token.length < 1 || token.length > 512) {
    return jsonResponse({ error: "Token inválido." }, 400)
  }
  if (!validPayload(action as HolyricsAction, payload)) {
    return jsonResponse({ error: "Parâmetros inválidos para a ação solicitada." }, 400)
  }

  try {
    const upstream = await fetch(`https://api.holyrics.com.br/send/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: apiKey,
        token,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    })
    const responseText = await upstream.text()
    let result: unknown = null

    if (responseText) {
      try {
        result = JSON.parse(responseText)
      } catch {
        result = null
      }
    }

    if (!upstream.ok) {
      return jsonResponse(
        { error: `A API Holyrics respondeu com HTTP ${upstream.status}. Confira API_KEY, token e permissões.` },
        502,
      )
    }

    if (isRecord(result) && result.status === "error") {
      return jsonResponse({ error: "A API Holyrics recusou a ação. Confira as permissões do token." }, 502)
    }

    return jsonResponse(result ?? { status: "ok" })
  } catch {
    return jsonResponse({ error: "Não foi possível alcançar a API Holyrics." }, 502)
  }
}
