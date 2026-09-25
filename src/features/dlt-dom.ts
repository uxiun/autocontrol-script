import {
  DLT_DOCK_KEY,
  DLT_MY_ID,
  getAt,
  nextVisValue,
  PostLink,
  removeDuplicateOrEmpty,
  useCount,
  Visibility,
  VISIBILITY_MAP,
  visibilityFromValue,
} from "./dlt-storage"
import { entriesMap } from "@/pure/utils"
import { showToast } from "@/pure/component"
import { HintMap } from "./link-hint"
import { dltkeys } from "./keys"
import { showStatusTooltip } from "@/pure/tooltip"
import { getVisibleElements } from "@/pure/dom"

type GetLinkOption = {
  limitOwn: boolean
}

type GetLinkElement = {
  type: "article" | "fg/bg"
  el: Element | undefined | null
}

export const getLinkAuto = (
  el: Element | undefined | null,
): {
  id: string
  title: string
}[] => {
  if (!el) return []

  if (el.nodeName === "ARTICLE" && el.classList.contains("oln")) {
    const id = el?.getAttribute("data-kno")?.slice(2)
    const te = el?.querySelector(":scope > .ikon > .knm")

    if (!te || !id) return []

    // 「あれ」にも一応対応
    if (te.classList.contains("unk")) return [{ id, title: "" }]

    const title = te.getAttribute("data-src")
    return title ? [{ id, title }] : []
  } else if (el.classList.contains("bln")) {
    return getLinkAuto(el.querySelector("article.mg.oln"))
  } else if (el.nodeName === "A") {
    const id = el?.getAttribute("href")?.split("KNo.")[1]
    const title = el?.getAttribute("data-src")
    return id && title ? [{ id, title }] : []
  } else if (el.classList.contains("oln") && el.classList.contains("ikon")) {
    return getLinkAuto(el.querySelector(":scope > a.knm"))
  } else {
    return getLinkAuto(el.closest("article.oln"))
  }
}

const getLink = ({ type, el }: GetLinkElement): PostLink[] => {
  if (type === "article") {
    const id = el?.getAttribute("data-kno")?.slice(2)
    const title = el
      ?.querySelector(":scope > .ikon > .knm")
      ?.getAttribute("data-src")

    return id && title ? [{ id, title }] : []
  } else {
    const id = el?.getAttribute("href")?.split("KNo.")[1]
    const title = el?.getAttribute("data-src")
    return id && title ? [{ id, title }] : []
  }
}

type GetLinkTargetMainPage = "list" | "listsFg" | "listsBg"

type GetLinkTarget = GetLinkTargetMainPage | "opening" | "openingOtherSide"

export type DltPageType = "home" | "fg" | "bg"
export const getPageType = (): DltPageType | undefined => {
  if (window.location.hostname !== "dlt.kitetu.com") return
  const url = new URL(window.location.href)
  const params = new URLSearchParams(window.location.search)
  if (params.has("fg")) return "fg"
  if (params.has("bg")) return "bg"
  if (url.pathname.startsWith("/KNo.")) return "fg"
  return "home"
}

export const getAllMyLinkFromPage = () => {
  const params = new URLSearchParams(window.location.search)
  const links =
    params.has("fg") || params.has("bg")
      ? getLinkOnFgBgPage()([
          "opening",
          "openingOtherSide",
          "list",
          "listsFg",
          "listsBg",
        ])
      : getLinkMainPage()(["list", "listsFg", "listsBg"])

  return links
}

export const getLinkMainPage =
  (option = { limitOwn: true } as GetLinkOption) =>
  (targets = ["list", "listsFg"] as GetLinkTarget[]) => {
    if (targets.includes("list")) {
      const links: PostLink[] = Array.from(
        document.querySelectorAll(
          `.pg > .bln${option.limitOwn ? ".I" : ""} > article`,
        ),
      ).flatMap(el => {
        let fgbg: PostLink[] = []
        if (targets.includes("listsFg")) {
          fgbg = [
            ...fgbg,
            ...Array.from(
              el
                .closest(".bln")
                ?.querySelectorAll(
                  `:scope > .oln.ikon${option.limitOwn ? ".I" : ""} > a.knm`,
                ) || [],
            ).flatMap(el => getLink({ type: "fg/bg", el })),
          ]
        }
        if (targets.includes("listsBg")) {
          fgbg = [
            ...fgbg,
            ...Array.from(
              el.querySelectorAll(
                `:scope > .bg > .oln${option.limitOwn ? ".I" : ""} > a.knm`,
              ),
            ).flatMap(el => getLink({ type: "fg/bg", el })),
          ]
        }

        return [...getLink({ type: "article", el }), ...fgbg]
      })

      return removeDuplicateOrEmpty(links)
    }

    return []
  }

// Element to data
export const getLinkOnFgBgPage =
  (option = { limitOwn: true } as GetLinkOption) =>
  (targets = ["opening", "list", "listsFg", "listsBg"] as GetLinkTarget[]) => {
    let links: PostLink[] = []

    if (targets.includes("opening")) {
      const el = document.querySelector(
        `.bln.hng${option.limitOwn ? ".I" : ""} > article`,
      )
      links = [...links, ...getLink({ type: "article", el })]
    }
    if (targets.includes("openingOtherSide")) {
      const ls = Array.from(
        document.querySelectorAll(
          `.bln.hng${option.limitOwn ? ".I" : ""} > .oln${option.limitOwn ? ".I" : ""} > .knm`,
        ),
      ).flatMap(el => getLink({ type: "fg/bg", el }))

      links = [...links, ...ls]
    }

    links = [...links, ...getLinkMainPage(option)(targets)]

    return removeDuplicateOrEmpty(links)
  }

export const getLinkFromFgBg = (limitOwn = true) => {
  const links: PostLink[] = Array.from(
    document.querySelectorAll("a.knm[href][data-src]"),
  ).flatMap(el =>
    getLink({
      type: "fg/bg",
      el,
    }),
  )

  return limitOwn ? links.filter(({ id }) => id.startsWith(DLT_MY_ID)) : links
}

export const getLinkFromArticle = (limitOwn = true): PostLink[] =>
  Array.from(
    document.querySelectorAll(
      `.pg > .bln${limitOwn ? ".I" : ""} > article.mg.oln`,
    ),
  ).flatMap(el => getLink({ el, type: "article" }))

export interface ScrapeResult {
  main?: PostLink
  list: PostLink[] // 前景後景どちらも最新10件まで見える
  fg: PostLink[] // listの輪郭の前景
  bg: PostLink[] // listの輪郭の後景
}

export const scrapeWithFgBg = (limitOwn = true) => {
  console.log(`scrapeWithFgBg(limitOwn: ${limitOwn})`)
  showToast("🔄", 500)

  const r: ScrapeResult = {
    list: [],
    fg: [],
    bg: [],
  }

  const items = getListItems(limitOwn)

  for (const bln of items) {
    const [current] = getLinkAuto(bln)
    if (!current) continue

    const fg = Array.from(
      bln.querySelectorAll(`:scope > .oln.ikon${limitOwn ? ".I" : ""}`),
    )
      .flatMap(getLinkAuto)
      .map(l => ({ ...l, bg: [current.id] }))

    const bg = Array.from(
      bln.querySelectorAll(`.bg > .oln.ikon${limitOwn ? ".I" : ""}`),
    )
      .flatMap(getLinkAuto)
      .map(l => ({ ...l, fg: [current.id] }))

    const cnt = fgBgCount(bln)

    r.list.push({
      ...current,
      fg: fg.map(l => l.id),
      bg: bg.map(l => l.id),
      fgc: cnt.fg,
      bgc: cnt.bg,
    })

    r.fg = [...r.fg, ...fg]
    r.bg = [...r.bg, ...bg]
  }

  const mainBln = document.querySelector(`.bln.hng${limitOwn ? ".I" : ""}`)
  if (!mainBln) return r

  const [main] = getLinkAuto(mainBln)
  if (!main) return r

  r.main = main

  // 1. main の fgc / bgc をDOMから正しく取得してセット
  const mainCnt = fgBgCount(mainBln)
  r.main.fgc = mainCnt.fg
  r.main.bgc = mainCnt.bg

  const listIds = r.list.map(l => l.id)

  // 2. URLパラメータとクラス名の両方でページ種別を判定
  const pageType = getPageType()
  const isFgPage = pageType === "fg" || mainBln.classList.contains("top")
  const isBgPage = pageType === "bg" || mainBln.classList.contains("btm")

  // ハンガー内の fg / bg アイコンを抽出
  const hangerFg = Array.from(
    mainBln.querySelectorAll(`:scope > .oln.ikon${limitOwn ? ".I" : ""}`),
  )
    .flatMap(getLinkAuto)
    .map(l => ({ ...l, bg: [main.id] }))

  const hangerBg = Array.from(
    mainBln.querySelectorAll(`.bg > .oln.ikon${limitOwn ? ".I" : ""}`),
  )
    .flatMap(getLinkAuto)
    .map(l => ({ ...l, fg: [main.id] }))

  if (isFgPage) {
    // fg一覧ページ: メインリストは main の bg（後景）
    // ハンガー内の .bg（他人の輪郭など）も結合
    const combinedBgIds = Array.from(
      new Set([/*...listIds,*/ ...hangerBg.map(l => l.id)]),
    )

    r.main.fg = hangerFg.map(l => l.id)
    r.main.bg = combinedBgIds

    r.fg = [...r.fg, ...hangerFg]
    r.bg = [...r.bg, ...hangerBg]

    // // 3. リスト側要素の fg に main.id を双方向補填
    // r.list.forEach(item => {
    //   if (!item.fg) item.fg = []
    //   if (!item.fg.includes(main.id)) {
    //     item.fg.unshift(main.id)
    //   }
    // })
  } else if (isBgPage) {
    // bg一覧ページ: メインリストは main の fg（前景）
    const combinedFgIds = Array.from(
      new Set([/*...listIds,*/ ...hangerFg.map(l => l.id)]),
    )

    r.main.fg = combinedFgIds
    r.main.bg = hangerBg.map(l => l.id)

    r.fg = [...r.fg, ...hangerFg]
    r.bg = [...r.bg, ...hangerBg]

    // // リスト側要素の bg に main.id を双方向補填
    // r.list.forEach(item => {
    //   if (!item.bg) item.bg = []
    //   if (!item.bg.includes(main.id)) {
    //     item.bg.unshift(main.id)
    //   }
    // })
  }

  console.log("scrapeWithFgBg:", r)
  return r
}

const fgBgCount = (bln: Element) => {
  const fgCount = bln.querySelector(":scope > .cnt")?.textContent?.slice(1, -1)
  const bgCount = bln.querySelector(".bg > .cnt")?.textContent?.slice(1, -1)

  const getNum = (cnt: string | undefined) => {
    if (cnt === undefined) return undefined
    if (Number.isInteger(Number(cnt))) return Number(cnt)
    for (const ope of ["+", "-"]) {
      if (cnt.includes(ope)) {
        const [base, add] = cnt.split(ope)
        return parseInt(base) + (ope === "+" ? 1 : -1) * parseInt(add)
      }
    }
    return undefined
  }

  return {
    fg: getNum(fgCount),
    bg: getNum(bgCount),
  }
}

export const getListItems = (limitOwn = true) => {
  return document.querySelectorAll(`.pg > .bln${limitOwn ? ".I" : ""}`)
}

// export const dltFgBgHint: HintMap<{ param: "fg" | "bg" }> = {
//   changeState: new Map([
//     [" ", state => (state.param === "bg" ? { param: "fg" } : { param: "bg" })],
//   ]),
//   showState: state => showToast(`param: ${state.param}`),
//   targetElements: [
//     {
//       type: "terminal",
//       keys: dltkeys.easy,
//       elements: () => [
//         ...Array.from(document.querySelectorAll("h2.ikon")),
//         ...Array.from(document.querySelectorAll(".oln.ikon.bln")),
//       ],
//       action(el, state) {
//         const link = getLinkAuto(el)
//         if (!link) {
//           showToast("遷移先が見つかりませんでした")
//           return
//         }
//       },
//     },
//   ],
// }

export type DltHintMapState = {
  mode: "open" | "pick"
  openInNewTab: boolean
  fgOrBg: "fg" | "bg"
}

type State = DltHintMapState

const actionWith =
  (
    getUrl: (el: Element, s: State) => string | null | undefined,
    getLinkElement: (el: Element) => Element | null | undefined,
  ) =>
  (el: Element, s: State) => {
    if (s.mode === "open") {
      const url = getUrl(el, s)
      if (!url) return

      if (s?.openInNewTab) {
        window.open(url, "_blank", "noopener,noreferrer")
      } else {
        window.location.href = url
      }
    } else {
      const dock: PostLink[] = JSON.parse(
        localStorage.getItem(DLT_DOCK_KEY) || "[]",
      )
      const newDock = [
        ...getLinkAuto(getLinkElement(el)).map(l =>
          useCount({ ...l, at: getAt() }),
        ),
        ...dock,
      ]

      localStorage.setItem(DLT_DOCK_KEY, JSON.stringify(newDock))

      // 💡【新設】同じタブ内の全スクリプトに向けて「台が変わったぞ」と叫ぶ
      window.dispatchEvent(
        new CustomEvent("dlt-dock-updated", { detail: newDock }),
      )
    }
  }

const dataKnoToUrl =
  (s: { fgOrBg: string }) => (oln: Element | null | undefined) => {
    if (oln) {
      const kno = oln.getAttribute("data-kno")
      if (kno) {
        return `https://dlt.kitetu.com/?${s.fgOrBg}=${kno.replace("#", "No.")}`
      }
    }
  }

export const dltHintMap: HintMap<State> = {
  changeState: entriesMap({
    backspace: s => ({
      ...s,
      mode: s.mode === "open" ? "pick" : "open",
    }),
    " ": s => ({
      ...s,
      openInNewTab: !s.openInNewTab,
    }),
    enter: s => ({
      ...s,
      fgOrBg: s.fgOrBg === "bg" ? "fg" : "bg",
    }),
  }),

  showState: s => {
    console.log("現在の状態:", s)
    const message =
      s.mode === "open"
        ? `${s.fgOrBg === "fg" ? "後景" : "前景"}を${s.openInNewTab ? "新しい" : "現在の"}タブで開く`
        : "リンク収集"

    showStatusTooltip(message)
  },

  // nonTerminal: null,

  targetElements: [
    {
      type: "terminal",
      keys: dltkeys.easyL,
      elements: () => getVisibleElements(".pg > .bln article.mg.oln .kno a"),
      action: actionWith(
        (el, s) => dataKnoToUrl(s)(el.closest("article.oln")),
        e => e.closest("article.oln"),
      ),
      hintOffsetPx: [50, 0],
    },
    {
      type: "non-terminal",
      keys: dltkeys.easyR,
      elements: () => getVisibleElements(".pg > .bln"),

      hintMap: el => {
        const queryFg = ":scope > .oln > .knob.l"
        const queryBg = ":scope > article > .bg > .oln > .knob.l"

        const action = actionWith(
          (el, s) => dataKnoToUrl(s)(el.parentElement),
          e => e.closest(".oln"),
        )

        return {
          changeState: entriesMap({
            " ": s => ({
              ...s,
              mode: s.mode === "open" ? "pick" : "open",
            }),
            backspace: s => ({
              ...s,
              openInNewTab: !s.openInNewTab,
            }),
            enter: s => ({
              ...s,
              fgOrBg: s.fgOrBg === "bg" ? "fg" : "bg",
            }),
          }),

          showState: s => {
            console.log("現在の状態:", s)
            const message =
              s.mode === "open"
                ? `${s.fgOrBg === "fg" ? "後景" : "前景"}を${s.openInNewTab ? "新しい" : "現在の"}タブで開く`
                : "リンク収集"
            showStatusTooltip(message)
          },

          targetElements: [
            {
              type: "terminal",
              keys: dltkeys.easyL,
              elements: () => getVisibleElements(queryFg, el),
              action,
              hintOffsetPx: [-10, 0],
            },
            {
              type: "terminal",
              keys: dltkeys.easyR,
              elements: () => getVisibleElements(queryBg, el),
              action,
              hintOffsetPx: [-10, 0],
            },
          ],
        }
      },
    },
  ],
}

export const closestUpubSeldButton = (el: Element) =>
  [...(el.closest("article.mg")?.querySelectorAll(".upub button") ?? [])].find(
    btn => btn.classList.contains("seld"),
  ) as HTMLButtonElement | undefined

export const toggleVisibility = (
  closestBaseElement: Element | null | undefined,
  action: "toggle" | Visibility,
): undefined | { last: Visibility; current: Visibility } => {
  if (!closestBaseElement) return
  const article = closestBaseElement.closest("article.mg.oln")
  if (!article) return
  const btns = [...article.querySelectorAll(".upub button")]
  if (!btns) return

  const i = btns.findIndex(btn => btn.classList.contains("seld"))

  const seld = btns[i]
  const value = seld.getAttribute("value")!
  const last = visibilityFromValue(value)!

  if (action === last) return { last, current: last }

  let next =
    action === "toggle"
      ? btns[(i + 1) % btns.length]
      : btns.find(btn => btn.getAttribute("value")! === VISIBILITY_MAP[last])

  if (!next) return

  seld.classList.remove("seld")
  next.classList.add("seld")

  const current =
    action === "toggle"
      ? visibilityFromValue(next.getAttribute("value")!)!
      : action

  return { last, current }
}

// export const toggleVisibilityClick = (
//   closestBaseElement: Element,
//   action: "toggle" | Visibility,
// ): undefined | { last: Visibility; current: Visibility } => {
//   const article = closestBaseElement.closest("article.mg.oln")
//   if (!article) return
//   const btns = [...article.querySelectorAll(".upub button")]
//   if (!btns) return

//   const i = btns.findIndex(btn => btn.classList.contains("seld"))

//   const seld = btns[i] as HTMLButtonElement
//   const value = seld.getAttribute("value")!
//   const last = visibilityFromValue(value)!

//   if (action === last) return { last, current: last }

//   let n = 1
//   if (action !== "toggle") {
//     const j = btns.findIndex(
//       btn => btn.getAttribute("value")! === VISIBILITY_MAP[last],
//     )
//     if (i < j) n = j - i
//     else n = j + btns.length - i
//   }

//   // seld.classList.remove("seld")
//   // next.classList.add("seld")

//   seld.click()

//   const current = action === "toggle" ? nextVisValue(last) : action

//   return { last, current }
// }
