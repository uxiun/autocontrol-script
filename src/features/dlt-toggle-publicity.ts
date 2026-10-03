import { isInput, sleep } from "@/pure/utils"
import { dltkeys } from "./keys"
import { applyAll, defineTerminalTarget, HintMap, linkHint } from "./link-hint"
import {
  nextVisValue,
  Visibility,
  VISIBILITY_JP,
  VISIBILITY_MAP,
} from "./dlt-storage"
import { showToast } from "@/pure/component"
import {
  closestUpubSeldButton,
  getListItems,
  toggleVisibility,
} from "./dlt-dom"

export default async function togglePublicityDrw(
  action: "toggleCurrentActiveOrDrw" | "setAllPublic" | "setAllPrivate",
) {
  // document.activeElement?.closest("article.mg.oln") ??

  const cursorOnInput = isInput()

  if (action === "toggleCurrentActiveOrDrw") {
    if (cursorOnInput && document.activeElement?.closest("#drw")) {
      console.log("from #drw input")
      const el = document.querySelector("#drw .mg")
      const res = toggleVisibility(el, "toggle")
      console.log(res)
    } else if (
      cursorOnInput &&
      document.activeElement?.closest(".mg.oln")?.querySelector(".dln.ed")
    ) {
      console.log("from editing input")
      const active = document.activeElement as
        | HTMLInputElement
        | HTMLTextAreaElement
      await selectVisibilityClick(active.closest(".mg"), "toggle")
      active.focus()
    } else {
      const drw = document.querySelector("#drw .mg")
      if (!drw) return
      toggleVisibility(drw, "toggle")
    }
  } else {
    const items = document.querySelectorAll(".mg")
    const vis =
      action === "setAllPrivate" ? Visibility.OnlyMe : Visibility.Everyone
    for (const el of items) {
      await selectVisibilityClick(el, vis)
    }
  }

  // const btns = Array.from(
  //   document.querySelectorAll<HTMLButtonElement>("#drw .upub button"),
  // )
  // const i = btns.findIndex(btn => btn.classList.contains("seld"))
  // btns[i].classList.remove("seld")
  // btns[(i + 1) % btns.length].classList.add("seld")

  // upub.click()
  // await sleep(200)

  // const mini = document.querySelector("#drw .upub.mini")
  // selectPubButton(nextVisValue(upub.value), mini)
  // document.querySelector<HTMLInputElement>("#drw input.knm")?.focus()
}

export function togglePublicity() {
  const hm: HintMap<null> = {
    targetElements: [
      defineTerminalTarget({
        type: "terminal",
        keys: dltkeys.easy,
        elements: () => document.querySelectorAll<HTMLElement>(".mg"),
        action: async (el, state) => {
          // closestUpubSeldButton(el)?.click()
          // await sleep(200)
          // selectPubButton(
          //   nextVisValue(el.value),
          //   document.querySelector(".upub.mini"),
          // )

          await selectVisibilityClick(el, "toggle")
        },
      }),
    ],
  }

  linkHint(hm, null)
}

export function setVisibilityAll(visibility: Visibility) {
  const value = VISIBILITY_MAP[visibility]
  const n = applyAll(
    {
      elements: () => [
        ...Array.from(document.querySelectorAll<HTMLDivElement>(".bln.hng")),
        ...Array.from(document.querySelectorAll<HTMLDivElement>(".pg > .bln")),
      ],
      action(el, count) {
        const btn = el.querySelector<HTMLButtonElement>(".upub button")
        if (!btn || btn.value === value) return
        btn.click()
        selectPubButton(value, el.querySelector(".upub.mini"))
        return count + 1
      },
    },
    0,
  )

  showToast(`${n}個の輪郭を${VISIBILITY_JP[visibility]}状態にしました`)
}

const selectVisibilityClick = async (
  baseArticle: Element | null | undefined,
  action: "toggle" | Visibility,
  clickSleepMs = 100,
) => {
  if (!baseArticle) return
  const seld = closestUpubSeldButton(baseArticle)
  if (!seld) return
  seld.click()
  await sleep(clickSleepMs)
  const mini = baseArticle.querySelector(".upub.mini")
  if (!mini) return
  const buttons = [
    ...mini.querySelectorAll(":scope > button"),
  ] as HTMLButtonElement[]
  const currentValue = seld.getAttribute("value")
  const value =
    action === "toggle"
      ? currentValue
        ? nextVisValue(currentValue)
        : VISIBILITY_MAP[Visibility.OnlyMe]
      : VISIBILITY_MAP[action]
  const i = buttons.findIndex(b => b.value === value)

  buttons[i].click()
}

const selectPubButton = (value: string, mini: Element | null) => {
  if (!mini) return
  const buttons: HTMLButtonElement[] = Array.from(
    mini.querySelectorAll(":scope > button"),
  )
  const i = buttons.findIndex(b => b.value === value)

  buttons[i].click()
}
