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

## 英雄属性成长排名

在顶部导航选择「属性成长排名」。每行英雄名，四列为力量、敏捷、智力每级成长和三项之和；默认按总成长降序，每列都有独立升序 / 降序按钮。支持中英切换，窄屏可横向滑动表格，英雄列固定。此数据独立于天赋历史版本，不含基础属性、天赋或技能加成。

`src/generated/hero-attribute-growth.json` 保存 Valve 官方 `herodata` 的 `str_gain`、`agi_gain`、`int_gain` 快照，按 `heroCatalog.numericId` 对应。数据更新命令：

```bash
bun run data:sync-growth
```

此步骤也已加入 `data:import`。同步时核对官方 `herolist` 与目录英雄 ID 完全一致，并要求所有成长字段是有效数值；任一步骤失败均保留原快照，不写入部分结果。缺失数据在页面显示为 `—` 并始终排在最后，三项不全时不计算总和。

页面展示抓取时间（UTC）、官方来源和抓取时最新补丁公告。`herodata` 不提供版本号，所以最新公告只作参考，不将快照冒称为某版本逐项核验的数据。现有天赋档案仍为 7.00–7.41e。

本地预览（仅当前电脑）：

```bash
bun run dev --host 127.0.0.1
```

