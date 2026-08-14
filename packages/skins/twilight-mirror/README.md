# @linxin666/dsh-client-ui-skin-twilight-mirror

暮色镜湖（Twilight Mirror）皮肤 — 在蓝紫暮光与静水倒影之间保持专注：蓝紫暮光镜湖背景画垫在半透明面板之下，深海军蓝表面搭配薰衣草粉紫强调色，遮罩随亮/暗主题实时切换。

Hot-pluggable as a client plugin in the official standalone bundle shape:
`apply()` sets the `data-dsh-twilight-mirror` body attribute (the scope of the
whole stylesheet) and paints the mirror-lake backdrop (base64 data URL with a
readability scrim swapped live on theme flips); its effect disposer retracts
every write. The stylesheet rides the bundle's CSS-modules auto-inject, so the
loader removes it with the entry.

The skin is presentation-only: no services are injected, no cordis events are
emitted, and nothing reaches a model request.

## Installing (official bundle)

1. Local path: `dsh plugin --profile <name> add /path/to/dsh-web-ui/packages/skins/twilight-mirror`
2. Git: `dsh plugin --profile <name> add github:<org>/dsh-web-ui#<sha>` —
   pnpm ≥10 asks once for `allowBuilds` authorization (the `prepare` script
   self-containedly builds `lib/`; no monorepo reference needed).
3. Switch with `scripts/dsh-skin` (`dsh-skin use twilight-mirror`); only one skin is
   ever active at a time.

## Building and testing

```sh
pnpm build   # tsdown: lib/index.js + lib/client.js (self-contained preset)
pnpm test    # vitest: apply/dispose contract spec
```

## Publishing to the skin center

```sh
node scripts/skin-center-bundles    # re-embed this skin into skin-center's registry
pnpm --filter @linxin666/dsh-client-ui-skin-center build
node scripts/gallery-build          # refresh the gallery manifest/bundles
node scripts/capture-previews       # re-shoot preview/light.png + preview/dark.png
```

Then commit everything (lib/, preview/, regenerated registry/gallery) and open a PR.
