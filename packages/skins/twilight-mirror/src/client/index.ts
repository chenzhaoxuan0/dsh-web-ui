/**
 * 暮色镜湖 (Twilight Mirror) skin — a hot-pluggable client plugin for the
 * dsh web GUI: the blue-purple twilight mirror-lake backdrop with a
 * readability scrim chosen by the current theme (swapped live on
 * `data-ds-dark-theme` changes), a lavender/pink-on-deep-navy palette
 * remapped across every dsh token, and translucent frosted panes so the art
 * shows through. apply() owns the whole ambient surface and retracts it on
 * dispose (the ThemePresenter retraction discipline): the
 * `data-dsh-twilight-mirror` body attribute the stylesheet is scoped on and
 * the inline backdrop styles. The palette remap + the frosted panes (incl.
 * the [id='root'] transparency that lets the twilight art show through)
 * ride the bundle's CSS-modules auto-inject (loader-owned style tag,
 * removed on entry dispose). No services are injected: the skin needs only
 * the DOM.
 */
import type { Context } from '@deepseek-ai/cordis'
import { TWILIGHT_ART } from './art.ts'
// The palette remap + the frosted panes ride this stylesheet; the bundle
// preset inlines it as a loader-owned <style data-plugin-css> tag.
import './twilight-mirror.module.css'

/** Light scrim: a thin blue-violet dusk veil — the mirror lake keeps its
 *  lavender glow while text stays legible over the brighter sky. */
const SCRIM_LIGHT = [
  'linear-gradient(rgba(16, 27, 85, 0.16) 0%, rgba(23, 36, 94, 0.24) 55%, rgba(37, 48, 120, 0.32) 100%)',
].join(', ')

/** Dark scrim: a deep night-navy veil over the same twilight, heavy enough
 *  for reading while the violet reflections still glow through. */
const SCRIM_DARK = [
  'linear-gradient(rgba(6, 10, 32, 0.46) 0%, rgba(10, 18, 56, 0.56) 60%, rgba(16, 27, 85, 0.64) 100%)',
].join(', ')

const BACKDROP_PROPERTIES = [
  'background-image',
  'background-position',
  'background-size',
  'background-attachment',
  'background-repeat',
] as const

/**
 * Apply the twilight-mirror skin: body attribute, mirror-lake backdrop with
 * a live-swapping theme scrim. All writes are retracted by the effect
 * disposer on dispose. Backdrop writes go through the canonical hyphenated
 * CSSOM API (setProperty/getPropertyValue), so any prior value round-trips
 * verbatim on restore.
 * @param ctx - owning context (the effect lifecycle owns retraction).
 */
export function apply(ctx: Context): void {
  const body = document.body
  const previous = new Map<string, string>()
  for (const prop of BACKDROP_PROPERTIES) {
    previous.set(prop, body.style.getPropertyValue(prop))
  }
  body.dataset.dshTwilightMirror = ''

  const setBackdrop = (): void => {
    const dark = body.dataset.dsDarkTheme !== undefined
    body.style.setProperty('background-image', `${dark ? SCRIM_DARK : SCRIM_LIGHT}, url(${TWILIGHT_ART})`)
    body.style.setProperty('background-position', 'center')
    body.style.setProperty('background-size', 'cover')
    body.style.setProperty('background-attachment', 'fixed')
    body.style.setProperty('background-repeat', 'no-repeat')
  }
  setBackdrop()

  // Swap the scrim live when the base theme system flips dark/light.
  const observer = new MutationObserver(setBackdrop)
  observer.observe(body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })

  ctx.effect(() => () => {
    delete body.dataset.dshTwilightMirror
    observer.disconnect()
    for (const [prop, value] of previous) {
      body.style.setProperty(prop, value)
    }
  }, 'ui-skin-twilight-mirror: twilight backdrop')
}
