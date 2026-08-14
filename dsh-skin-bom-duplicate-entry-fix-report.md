# dsh Web 启动失败修复报告

## 1. 问题概述

2026 年 8 月 14 日，执行以下命令启动 dsh Web 时失败：

```powershell
pnpm dsh web --host 127.0.0.1 --port 3080
```

启动日志显示：

```text
duplicate loader entry id: ui-skin-twilight-mirror
```

此前还出现过以下 JSON 解析错误：

```text
SyntaxError: Unexpected token '﻿'
```

## 2. 根因分析

本次启动失败是两个问题叠加造成的：

1. `C:\Users\chenziyu\.dsh\profiles\web\package.json` 文件带有 UTF-8 BOM。
2. `@linxin666/dsh-client-ui-skin-twilight-mirror` 已作为 profile bundle 安装，其自身的 `cordis.patch.yml` 已经插入了 `ui-skin-twilight-mirror`。
3. `C:\Users\chenziyu\.dsh\cordis.patch.yml` 的 dsh-skin 管理区又插入了同一个 id。
4. `dsh-skin` 脚本读取 profile manifest 时没有处理 BOM，解析失败后进入了兜底逻辑，误以为该 skin 不是 bundle-wired，于是重新生成了重复的 insert entry。
5. Loader 在应用两个相同 id 的 entry 时直接拒绝启动。

## 3. 修改内容

### 3.1 DeepSeek Harness profile manifest 读取

在以下文件增加了统一的 BOM 兼容处理：

```text
C:\Users\chenziyu\project\Agent\deepseek-harness\packages\boot\app-boot\src\profile.ts
```

处理方式是 JSON 解析前移除开头的 UTF-8 BOM：

```ts
raw.replace(/^\uFEFF/, '')
```

覆盖的 manifest 读取路径包括：

- profile `package.json`
- bundle `package.json`
- 安装依赖闭包中的 package manifest

同时新增了 BOM 回归测试：

```text
C:\Users\chenziyu\project\Agent\deepseek-harness\packages\boot\app-boot\tests\profile.spec.ts
```

### 3.2 dsh-skin 管理脚本

修改文件：

```text
C:\Users\chenziyu\project\Agent\dsh\dsh-web-ui\scripts\dsh-skin
```

`bundleWiredFromProfile()` 现在读取 profile manifest 时也会先移除 BOM，确保已由 bundle 提供的 skin 不会再次生成 insert entry。

### 3.3 修复当前用户配置

重新执行了：

```powershell
node scripts/dsh-skin use twilight-mirror
```

生成后的：

```text
C:\Users\chenziyu\.dsh\cordis.patch.yml
```

仍会禁用其他 skin，但不再重复插入 `ui-skin-twilight-mirror`。该 entry 由 twilight-mirror bundle 自身提供。

## 4. 验证结果

已执行以下验证：

```text
pnpm exec vitest run packages/boot/app-boot/tests/profile.spec.ts
```

结果：15 个测试全部通过。

```text
pnpm run typecheck
```

结果：通过。

```powershell
pnpm dsh web --host 127.0.0.1 --port 3080
```

结果：进程正常启动，端口 `3080` 处于监听状态。

```text
GET http://127.0.0.1:3080
```

结果：HTTP `200`。

## 5. 后续使用建议

切换 twilight-mirror 时使用官方脚本：

```powershell
cd C:\Users\chenziyu\project\Agent\dsh\dsh-web-ui
node scripts/dsh-skin use twilight-mirror
```

不要手动在 `C:\Users\chenziyu\.dsh\cordis.patch.yml` 中再次添加：

```yaml
- insert:
    - id: ui-skin-twilight-mirror
```

因为该 entry 已由 twilight-mirror bundle 的 `cordis.patch.yml` 提供。

如果再次出现 `duplicate loader entry id`，优先检查：

1. profile 的 `dsh.profile.bundles` 是否包含该插件。
2. bundle 自身是否已经提供相同 id。
3. `$DSH_HOME/cordis.patch.yml` 是否又手动插入了相同 id。
4. 相关 JSON 文件是否带 UTF-8 BOM。

## 6. 备注

本次修复涉及两个层面：Harness 的 manifest BOM 兼容，以及 dsh-web-ui 的 skin 管理脚本 BOM 兼容。前者解决启动器直接解析失败，后者避免 skin 管理脚本在 BOM 文件上误判并重新生成重复配置。

## 7. 后续复核与加固（2026-08-14，防复发）

复核发现一个**遗留复发路径**：GUI 皮肤中心的 `/api/skin-center/apply` 走的是进程内移植版
`packages/skins/skin-center/src/skin-switch.ts`，其 wiring 判定只读 `skin.json` 的
`bundleWired` 标志（当时全为 false），**不读 profile manifest**——用户在皮肤中心点「应用」
twilight-mirror 仍会写入重复 insert，下次启动再次 `duplicate loader entry id`。已加固：

1. **GUI 端口补齐 profile-bundle 检测**：`skin-switch.ts` 新增 `profileBundleWired()`（BOM 容忍地
   读取 `profiles/<profile>/package.json` 的 `dsh.profile.bundles`），并入 `wiredNames()`，
   `renderManaged` / `currentActive` / `useSkin` / `currentSkin` 全部走真实路径——GUI 应用不再
   为 bundle 皮肤生成第二行 insert。
2. **双端防重复护栏（失败即报）**：CLI（`scripts/dsh-skin`）与端口（`skin-switch.ts`）在写补丁前
   直接检查 profile 下该 bundle 自带的 `cordis.patch.yml` 是否已含 insert id；若已含且检测判定为
   “非 wired”，**拒绝写入并给出明确报错**（而不是写一份下一次启动必炸的补丁）。该检查与 manifest
   解析无关，即使 BOM/解析再出问题也会拦住。
3. **BOM 容忍补全 + 源头清理**：端口读取 `skin.json`（`readSkinMeta` / `isSkinPackageDir`）同样去 BOM；
   真实 `~/.dsh/profiles/web/package.json` 的 UTF-8 BOM 已移除（根源消除，容忍层仍保留）。
4. **重建产物**：`pnpm --filter @linxin666/dsh-client-ui-skin-center build` 后 lib 34.8KB；profile 中
   的 skin-center 为指向仓库的 junction，重启即生效。

验证：CLI 测试 9/9（新增 BOM manifest 不重复插入、护栏失败即报两例）；端口测试 29/29（新增
BOM manifest 视为 wired、护栏拒绝写入、BOM skin.json 解析三例）；真实环境 `dsh-skin use
twilight-mirror` 成功且补丁无重复 insert；`~/.dsh/profiles/web/package.json` 已无 BOM。

### 防复发清单（下次遇到类似问题按此排查）

1. 切换皮肤一律走 `node scripts/dsh-skin use <name>` 或皮肤中心，不手改 `cordis.patch.yml` 管理区。
2. 若启动报 `duplicate loader entry id`：查 profile `dsh.profile.bundles` 是否含该包 → 查该包自带
   `cordis.patch.yml` 是否含同 id → 查 `cordis.patch.yml` 管理区是否又被插入同 id → 查相关 JSON
   是否带 BOM（现在各读取层均已容忍，但源头清理更稳）。
3. 现在即使出现误判，`dsh-skin use` / 皮肤中心会**当场报错拒绝写入**，不会再留到下次启动才炸——
   报错文案会指出是 bundle 已提供该 id。
4. 可选加固（未做，属 Harness 侧）：loader 对指向同一包的重复 id 做幂等去重，作为最后兜底。

另外注意：harness 工作区有一个与本事件无关的未提交改动
（`packages/host/apiproxy/src/api-proxy.ts`：web-settings 白名单新增 dsh-ssh/live-stats/pet/
remote-web-ui/task-board），属其他任务的 WIP，请勿与本修复混淆。
