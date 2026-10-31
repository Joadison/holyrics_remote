import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

type Connection = {
  host: string
  port: string
  token: string
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Holyrics Proxy funcionando!",
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await params
    const { connection, body } = await request.json() as {
      connection: Connection
      body?: Record<string, unknown>
    }

    if (
      !connection?.host ||
      !connection?.port ||
      !connection?.token
    ) {
      return NextResponse.json(
        { status: "error", error: "Configuração inválida." },
        { status: 400 },
      )
    }

    const host = connection.host.includes(":") &&
      !connection.host.startsWith("[")
        ? `[${connection.host}]`
        : connection.host

    const url = new URL(
      `/api/${encodeURIComponent(action)}`,
      `http://${host}:${connection.port}`,
    )

    url.searchParams.set("token", connection.token)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })

    const data = await response.json()

    return NextResponse.json(data, {
      status: response.status,
    })
  } catch (error) {
    console.error("[Holyrics Proxy]", error)

    return NextResponse.json(
      {
        status: "error",
        error: "Não foi possível comunicar com o Holyrics.",
      },
      { status: 502 },
    )
  }
}