# 文档卡片助手 (`doc-card`) — Antigravity Plugin

为 **Google Antigravity** 提供类似 Codex 的文档交付卡片与本地打开体验。

## ✨ 核心功能

1. **对话内高对比度文档卡片（`<agent-embed>`）**
   - 每次 Agent 生成或修改 `.docx`、`.pdf`、`.xlsx`、`.pptx` 等文档时，自动在对话中渲染带**实体纯白/深色底色、边框与柔和阴影**的紧凑卡片（避免与聊天渐变背景混为一体）。
   - 清晰显示文件类型彩色图标（Word 蓝 / PDF 红 / Excel 绿 / PPT 橙）、加粗文件名、文件大小、备注及完整本地路径，并标记 `✓ 已收入右侧面板`。
2. **右侧辅助面板一键本地操作（Sidecar UI Extension）**
   - 紧贴卡片下方提供一键打开右侧边栏的 `[文档卡片助手](sidecar://doc-card/doc_opener/)` 胶囊入口。
   - 在右侧边栏面板中支持：
     - **📄 默认软件打开 (Default app)**：直接调用本机 WPS / Microsoft Office / PDF 阅读器打开文件；
     - **📁 在文件资源管理器中显示**：直接弹出文件资源管理器并高亮选中该文件；
     - **🖥️ 复制一份到桌面** / **📋 复制完整路径**；
     - **整张卡片直接点击**：点击卡片任意区域即可直接用默认软件打开。

## 📦 目录结构

```text
doc-card/
├── plugin.json                      # 插件清单
├── README.md                        # 使用说明
├── .gitignore                       # 忽略本地 data/ 历史记录以保护隐私
├── assets/
│   └── logo.svg                     # 插件图标
├── rules/
│   └── AGENTS.md                    # 永久交付规则（自动登记文件 + 渲染卡片 + 提供侧边栏入口）
└── sidecars/
    └── doc_opener/
        ├── sidecar.json             # Sidecar Web UI 配置（挂载至 AUX_PANE）
        └── server.mjs               # 基于官方 sidecar_sdk 的本地服务与前端面板
```

## 🚀 安装方式

将本仓库克隆到 Antigravity 的全局插件目录即可自动加载：

```bash
git clone https://github.com/PetterHong/doc-card.git ~/.gemini/config/plugins/doc-card
```

Windows PowerShell:

```powershell
git clone https://github.com/PetterHong/doc-card.git "$env:USERPROFILE\.gemini\config\plugins\doc-card"
```
