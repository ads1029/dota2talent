# Dota Talent Archive

中英双语的 Dota 2 英雄天赋历史档案。v0.1.0 数据范围从天赋系统首次上线的 **7.00** 到当前官方版本 **7.41e**，包含正式版本与热修复版本。

## 数据范围

- 133 个版本（7.00–7.41e）
- 127 位当前英雄
- 4,614 条天赋变更事件，其中 4,044 条来自 Valve 官方更新日志
- 63,824 行版本化天赋树快照
- 1,016 个 7.41e 当前天赋分支，已与 Valve 当前英雄接口逐项核对 ID、顺序和双语文本
- 32 个当前/历史英雄命石专属天赋状态

## 数据来源

1. Valve Dota 2 官方更新日志及 `datafeed` 中英文接口
2. Valve 7.00 / 7.07 官方专题页与早期更新日志
3. SteamTracking GameTracking-Dota2（早期本地化和游戏数据）
4. OpenDota `dotaconstants` 历史提交（完整天赋树锚点）
5. `data/supplemental/release-baselines.json` 中有来源链接的新英雄首发树

官方日志优先；同版本完整游戏数据锚点用于修正日志无法唯一确定左右分支的事件。早期缺少官方中文文本的条目带有翻译状态，方便后续人工复核。

## 构建与校验

```bash
bun install
bun run data:compile
bun run data:validate
bun run test
bun run build
```

需要重新下载远端源数据时运行：

```bash
bun run data:import
```

主要产物：

- `data/normalized/talent-history.json`：统一版本与事件流
- `data/normalized/version-snapshots.json`：每个版本的完整天赋树
- `data/normalized/current-official-talents.json`：7.41e 官方当前树原始模板
- `data/normalized/snapshot-build-report.json`：重放、锚点修正与未决项报告

