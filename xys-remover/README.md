# X游社 广告移除工具 (xys-remover)

自动检测并移除 RPG Maker MZ 游戏中被注入的「X游社」广告/作弊系统。

## 运行要求

- Node.js 14+
- 无任何第三方依赖

## 用法

```bash
node xys-remover.js <游戏目录> [--dry-run]
```

示例:

```bash
# 在游戏目录内运行 (处理当前目录)
node tool\xys-remover.js .

# 指定其他游戏目录
node xys-remover.js D:\games\some-game

# 仅预览, 不写入任何文件
node xys-remover.js . --dry-run
```

## 检测与处理内容

| 组件 | 检测特征 | 处理方式 |
|---|---|---|
| 数据解密插件 (UTA_Commone 类) | 插件代码中包含 `_0x`/`CryptoJS`/`CommonEvents` 且运行时替换 `DataManager.loadDataFile` | 沙盒运行插件自动解密 CommonEvents.json, 移除广告事件后写回明文; 删除插件文件并在 plugins.js 中禁用 |
| 广告核心插件 (ActorCommand 类) | 代码包含 `XYOU` / `zijietiaodong` / `api/v1/config` | 若插件参数头与 `tool/ActorCommand.clean.js` 模板一致则整体替换为干净版 |
| 公共事件 (CE#999 等) | 事件名或脚本含 `XYOU` / `游社` | 置为 null |
| 地图防篡改脚本 | 脚本含 `_0x` + `customVariables` / `SceneManager.exit` | 替换为空脚本 `0;` |

## 安全说明

- 所有被修改的文件会先备份到游戏目录下的 `_backup_xyou_<时间戳>/`
- `--dry-run` 只报告不写入
- 未匹配到干净模板的广告插件不会被自动删除 (仅警告), 需手动处理
- 工具自身及备份目录不会出现在残留扫描结果中

## 文件结构

```
tool/
├── xys-remover.js        # 主工具
├── ActorCommand.clean.js # 干净的 ActorCommand 插件模板 (去除广告后的版本)
└── README.md
```

## 验证方法

移除后可用任意文本工具搜索以下关键词确认无残留:

```
XYOU  xyou  zijietiaodong  KEYSWITCH  INSERTA  游社
```
