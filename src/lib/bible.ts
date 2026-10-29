export const BIBLE_TRANSLATIONS = [
  { value: "pt_acf", label: "Almeida Corrigida Fiel" },
  { value: "pt_aa", label: "Almeida Revista e Atualizada" },
  { value: "pt_nvi", label: "Nova Versão Internacional" },
] as const

export type BibleTranslation = (typeof BIBLE_TRANSLATIONS)[number]["value"]

export interface BibleBook {
  name: string
  chapters: string[][]
}

export interface BibleReference {
  book: number
  chapter: number
  verse: number
  verseEnd?: number
}

export interface BiblePassage {
  reference: BibleReference
  text: string
}

export interface BibleIndexEntry {
  reference: BibleReference
  text: string
}

export interface BibleIndex {
  verses: BibleIndexEntry[]
  trigrams: Map<string, number[]>
}

export interface BibleQuoteMatch {
  reference: BibleReference
  text: string
  score: number
  confidence: "strong" | "possible"
}

const BOOK_DEFINITIONS: Array<{ title: string; aliases: string[] }> = [
  { title: "Gênesis", aliases: ["gn", "genesis"] },
  { title: "Êxodo", aliases: ["ex", "exo", "exodo"] },
  { title: "Levítico", aliases: ["lv", "levitico"] },
  { title: "Números", aliases: ["nm", "numeros"] },
  { title: "Deuteronômio", aliases: ["dt", "deuteronomio"] },
  { title: "Josué", aliases: ["js", "josue"] },
  { title: "Juízes", aliases: ["jz", "juizes"] },
  { title: "Rute", aliases: ["rt"] },
  { title: "1 Samuel", aliases: ["1sm", "1 sam", "primeiro samuel"] },
  { title: "2 Samuel", aliases: ["2sm", "2 sam", "segundo samuel"] },
  { title: "1 Reis", aliases: ["1rs", "primeiro reis"] },
  { title: "2 Reis", aliases: ["2rs", "segundo reis"] },
  { title: "1 Crônicas", aliases: ["1cr", "primeiro cronicas"] },
  { title: "2 Crônicas", aliases: ["2cr", "segundo cronicas"] },
  { title: "Esdras", aliases: ["ed"] },
  { title: "Neemias", aliases: ["ne"] },
  { title: "Ester", aliases: ["et"] },
  { title: "Jó", aliases: ["job"] },
  { title: "Salmos", aliases: ["sl", "salmo", "salmos"] },
  { title: "Provérbios", aliases: ["pv", "proverbio", "proverbios"] },
  { title: "Eclesiastes", aliases: ["ec"] },
  {
    title: "Cantares de Salomão",
    aliases: ["ct", "cantares", "canticos", "cantico dos canticos", "cantares de salomao"],
  },
  { title: "Isaías", aliases: ["is", "isaias"] },
  { title: "Jeremias", aliases: ["jr"] },
  { title: "Lamentações", aliases: ["lm", "lamentacoes"] },
  { title: "Ezequiel", aliases: ["ez"] },
  { title: "Daniel", aliases: ["dn"] },
  { title: "Oseias", aliases: ["os", "oseias"] },
  { title: "Joel", aliases: ["jl"] },
  { title: "Amós", aliases: ["am", "amos"] },
  { title: "Obadias", aliases: ["ob"] },
  { title: "Jonas", aliases: ["jn"] },
  { title: "Miqueias", aliases: ["mq", "miqueias"] },
  { title: "Naum", aliases: ["na"] },
  { title: "Habacuque", aliases: ["hc"] },
  { title: "Sofonias", aliases: ["sf"] },
  { title: "Ageu", aliases: ["ag"] },
  { title: "Zacarias", aliases: ["zc"] },
  { title: "Malaquias", aliases: ["ml"] },
  { title: "Mateus", aliases: ["mt"] },
  { title: "Marcos", aliases: ["mc"] },
  { title: "Lucas", aliases: ["lc"] },
  { title: "João", aliases: ["joao", "evangelho de joao"] },
  { title: "Atos", aliases: ["at", "atos dos apostolos"] },
  { title: "Romanos", aliases: ["rm"] },
  { title: "1 Coríntios", aliases: ["1co", "1 cor", "1 corintios"] },
  { title: "2 Coríntios", aliases: ["2co", "2 cor", "2 corintios"] },
  { title: "Gálatas", aliases: ["gl", "galatas"] },
  { title: "Efésios", aliases: ["ef", "efesios"] },
  { title: "Filipenses", aliases: ["fp"] },
  { title: "Colossenses", aliases: ["cl"] },
  { title: "1 Tessalonicenses", aliases: ["1ts", "1 tessalonicenses"] },
  { title: "2 Tessalonicenses", aliases: ["2ts", "2 tessalonicenses"] },
  { title: "1 Timóteo", aliases: ["1tm", "1 timoteo"] },
  { title: "2 Timóteo", aliases: ["2tm", "2 timoteo"] },
  { title: "Tito", aliases: ["tt"] },
  { title: "Filemom", aliases: ["fm", "filemon"] },
  { title: "Hebreus", aliases: ["hb"] },
  { title: "Tiago", aliases: ["tg"] },
  { title: "1 Pedro", aliases: ["1pe", "1 pedro"] },
  { title: "2 Pedro", aliases: ["2pe", "2 pedro"] },
  { title: "1 João", aliases: ["1jo", "1 jo", "1 joao"] },
  { title: "2 João", aliases: ["2jo", "2 jo", "2 joao"] },
  { title: "3 João", aliases: ["3jo", "3 jo", "3 joao"] },
  { title: "Judas", aliases: ["jd"] },
  { title: "Apocalipse", aliases: ["ap", "revelacao"] },
]

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quatrocentas: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  seiscentas: 600,
  setecentos: 700,
  setecentas: 700,
  oitocentos: 800,
  oitocentas: 800,
  novecentos: 900,
  novecentas: 900,
}

const REFERENCE_LABELS = new Set([
  "cap",
  "capitulo",
  "capitulos",
  "versiculo",
  "versiculos",
  "verso",
  "versos",
  "numero",
  "no",
  "na",
  "do",
  "da",
  "dos",
  "das",
  "de",
])

const BOOK_ALIASES = BOOK_DEFINITIONS.flatMap((book, index) =>
  [book.title, ...book.aliases].map((alias) => ({
    book: index + 1,
    tokens: normalizeSpeech(alias).split(" "),
  })),
).sort((left, right) => right.tokens.length - left.tokens.length)

export function normalizeSpeech(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function normalizeReference(value: string) {
  return normalizeSpeech(value)
    .replace(/\b(primeiro|primeira)\b/g, "1")
    .replace(/\b(segundo|segunda)\b/g, "2")
    .replace(/\b(terceiro|terceira)\b/g, "3")
    .replace(/\b(um|uma)\s+(?=(?:samuel|reis|cronicas|corintios|tessalonicenses|timoteo|pedro|joao)\b)/g, "1 ")
    .replace(/\b(dois|duas)\s+(?=(?:samuel|reis|cronicas|corintios|tessalonicenses|timoteo|pedro|joao)\b)/g, "2 ")
    .replace(/\b([1-3])\s+(?:(?:livro|epistola)\s+)?(?:de|do|da|dos|das|a|ao|aos)?\s*(?=(?:samuel|reis|cronicas|corintios|tessalonicenses|timoteo|pedro|joao)\b)/g, "$1 ")
}

function locateBook(tokens: string[]) {
  for (let start = 0; start < tokens.length; start += 1) {
    for (const alias of BOOK_ALIASES) {
      if (alias.tokens.every((token, offset) => tokens[start + offset] === token)) {
        return { book: alias.book, end: start + alias.tokens.length }
      }
    }
  }

  return null
}

function parseCardinal(tokens: string[], start: number) {
  const token = tokens[start]
  if (!token) return null

  if (/^\d{1,3}$/.test(token)) {
    return { value: Number(token), next: start + 1 }
  }

  const first = NUMBER_WORDS[token]
  if (first === undefined) return null

  let value = first
  let next = start + 1
  const hasAnd = tokens[next] === "e"
  const secondIndex = next + (hasAnd ? 1 : 0)
  const second = NUMBER_WORDS[tokens[secondIndex]]

  if (first >= 100 && hasAnd && second !== undefined && second > 0 && second < 100) {
    value += second
    next = secondIndex + 1

    if (second >= 20 && second % 10 === 0) {
      const hasSecondAnd = tokens[next] === "e"
      const unitIndex = next + (hasSecondAnd ? 1 : 0)
      const unit = NUMBER_WORDS[tokens[unitIndex]]
      if (unit !== undefined && unit > 0 && unit < 10) {
        value += unit
        next = unitIndex + 1
      }
    }
  } else if (first >= 20 && first < 100 && first % 10 === 0 && second !== undefined && second > 0 && second < 10) {
    value += second
    next = secondIndex + 1
  }

  return { value, next }
}

export function parseBibleReference(value: string): BibleReference | null {
  const tokens = normalizeReference(value).split(" ").filter(Boolean)
  const located = locateBook(tokens)
  if (!located) return null

  const tail = tokens.slice(located.end).filter((token) => !REFERENCE_LABELS.has(token))
  let cursor = 0
  while (tail[cursor] === "e") cursor += 1

  const chapter = parseCardinal(tail, cursor)
  if (!chapter || chapter.value < 1 || chapter.value > 999) return null

  cursor = chapter.next
  while (tail[cursor] === "e") cursor += 1

  const verse = parseCardinal(tail, cursor)
  if (!verse || verse.value < 1 || verse.value > 999) return null

  cursor = verse.next
  const rangeWord = tail[cursor]
  let verseEnd: number | undefined

  if (rangeWord === "a" || rangeWord === "ate" || rangeWord === "ao") {
    const end = parseCardinal(tail, cursor + 1)
    if (!end || end.value < verse.value || end.value > 999 || end.value - verse.value + 1 > 100) return null
    if (end.value > verse.value) verseEnd = end.value
  }

  return { book: located.book, chapter: chapter.value, verse: verse.value, verseEnd }
}

export function formatBibleReference(reference: BibleReference) {
  const title = BOOK_DEFINITIONS[reference.book - 1]?.title ?? "Bíblia"
  const range = reference.verseEnd && reference.verseEnd > reference.verse ? `–${reference.verseEnd}` : ""
  return `${title} ${reference.chapter}:${reference.verse}${range}`
}

export function bibleReferenceKey(reference: BibleReference) {
  return `${reference.book}.${reference.chapter}.${reference.verse}`
}

export function bibleVerseId(reference: BibleReference) {
  return `${String(reference.book).padStart(2, "0")}${String(reference.chapter).padStart(3, "0")}${String(reference.verse).padStart(3, "0")}`
}

export function getBiblePassages(books: BibleBook[] | undefined, reference: BibleReference): BiblePassage[] | null {
  if (!books) return null

  const chapter = books[reference.book - 1]?.chapters[reference.chapter - 1]
  if (!chapter) return null

  const end = reference.verseEnd ?? reference.verse
  if (reference.verse < 1 || end < reference.verse || end > chapter.length || end - reference.verse + 1 > 100) {
    return null
  }

  return chapter.slice(reference.verse - 1, end).map((text, offset) => ({
    reference: {
      book: reference.book,
      chapter: reference.chapter,
      verse: reference.verse + offset,
    },
    text,
  }))
}

export function getAdjacentBibleReference(
  reference: BibleReference,
  direction: "next" | "previous",
  books?: BibleBook[],
): BibleReference | null {
  const verse = direction === "next" ? reference.verse + 1 : reference.verse - 1
  const currentBook = books?.[reference.book - 1]
  const currentChapter = currentBook?.chapters[reference.chapter - 1]

  if (!books || !currentBook || !currentChapter) {
    return verse > 0 ? { book: reference.book, chapter: reference.chapter, verse } : null
  }

  if (direction === "next") {
    if (reference.verse < currentChapter.length) {
      return { book: reference.book, chapter: reference.chapter, verse }
    }
    if (reference.chapter < currentBook.chapters.length) {
      return { book: reference.book, chapter: reference.chapter + 1, verse: 1 }
    }
    const nextBook = books[reference.book]
    if (nextBook?.chapters[0]?.length) {
      return { book: reference.book + 1, chapter: 1, verse: 1 }
    }
    return null
  }

  if (reference.verse > 1) {
    return { book: reference.book, chapter: reference.chapter, verse }
  }
  if (reference.chapter > 1) {
    const previousChapter = currentBook.chapters[reference.chapter - 2]
    return previousChapter?.length
      ? { book: reference.book, chapter: reference.chapter - 1, verse: previousChapter.length }
      : null
  }
  const previousBook = books[reference.book - 2]
  const lastChapter = previousBook?.chapters.at(-1)
  return lastChapter?.length
    ? { book: reference.book - 1, chapter: previousBook.chapters.length, verse: lastChapter.length }
    : null
}

export function buildBibleIndex(books: BibleBook[]): BibleIndex {
  const verses: BibleIndexEntry[] = []
  const trigrams = new Map<string, number[]>()
  const frequentTrigrams = new Set<string>()

  books.forEach((book, bookIndex) => {
    book.chapters.forEach((chapter, chapterIndex) => {
      chapter.forEach((text, verseIndex) => {
        const entryIndex = verses.length
        verses.push({
          reference: { book: bookIndex + 1, chapter: chapterIndex + 1, verse: verseIndex + 1 },
          text,
        })

        const words = normalizeSpeech(text).split(" ").filter(Boolean)
        const verseTrigrams = new Set<string>()

        for (let index = 0; index < words.length - 2; index += 1) {
          const trigram = `${words[index]} ${words[index + 1]} ${words[index + 2]}`
          if (verseTrigrams.has(trigram) || frequentTrigrams.has(trigram)) continue
          verseTrigrams.add(trigram)

          const occurrences = trigrams.get(trigram)
          if (!occurrences) {
            trigrams.set(trigram, [entryIndex])
          } else if (occurrences.length < 64) {
            occurrences.push(entryIndex)
          } else {
            trigrams.delete(trigram)
            frequentTrigrams.add(trigram)
          }
        }
      })
    })
  })

  return { verses, trigrams }
}

export function findQuotedVerse(index: BibleIndex | null, phrase: string): BibleQuoteMatch | null {
  if (!index) return null

  const words = normalizeSpeech(phrase).split(" ").filter(Boolean).slice(-22)
  if (words.length < 8) return null

  const candidates = new Map<number, { score: number; hits: number }>()
  const queryTrigrams = new Set<string>()

  for (let position = 0; position < words.length - 2; position += 1) {
    const trigram = `${words[position]} ${words[position + 1]} ${words[position + 2]}`
    if (queryTrigrams.has(trigram)) continue
    queryTrigrams.add(trigram)

    const occurrences = index.trigrams.get(trigram)
    if (!occurrences) continue
    const weight = 2 / (1 + Math.log2(occurrences.length + 1))

    for (const entryIndex of occurrences) {
      const candidate = candidates.get(entryIndex) ?? { score: 0, hits: 0 }
      candidate.score += weight
      candidate.hits += 1
      candidates.set(entryIndex, candidate)
    }
  }

  const ranked = [...candidates.entries()].sort((left, right) => right[1].score - left[1].score)
  const best = ranked[0]
  if (!best) return null

  const secondScore = ranked[1]?.[1].score ?? 0
  const separation = secondScore > 0 ? best[1].score / secondScore : Number.POSITIVE_INFINITY
  const strong = best[1].hits >= 4 && best[1].score >= 3.2 && separation >= 1.3
  const possible = best[1].hits >= 3 && best[1].score >= 2.1 && separation >= 1.12
  if (!strong && !possible) return null

  const verse = index.verses[best[0]]
  return {
    reference: verse.reference,
    text: verse.text,
    score: best[1].score,
    confidence: strong ? "strong" : "possible",
  }
}
