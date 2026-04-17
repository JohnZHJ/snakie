# fix-email

一个小工具，把剪贴板里的英文邮件草稿丢给 Claude，改成语法正确、简洁、客气礼貌的版本，再写回剪贴板。适合职场日常写给同事、客户、上司。

## 工作流

1. 在邮件客户端里打好草稿，**全选并复制**。
2. 终端运行 `fix-email`。
3. 改完的版本已经在剪贴板里，直接粘回邮件框即可。终端也会打印出来方便你过一眼。

## 安装（首次）

需要 Python ≥ 3.10。

```bash
# 1. Linux 剪贴板后端（macOS / Windows 不需要）
sudo apt install xclip

# 2. 进项目目录，创建虚拟环境
cd /path/to/snakie
python -m venv .venv
source .venv/bin/activate

# 3. 装依赖并注册 fix-email 命令
pip install -e .

# 4. 设置 Anthropic API key（建议写进 ~/.bashrc 持久化）
export ANTHROPIC_API_KEY=sk-ant-...
```

## 定制（重要）

打开 `profile.md`，把你的身份、常用收件人、偏好签名、语气偏好填进去。Claude 每次改邮件会读这个文件，按你的风格调整。

示例：

```markdown
# About me
- Name: Alex Chen
- Role / title: Senior Product Manager
- Company / team: Acme / Growth team

# How I write
- Typical recipients: teammates, EM, director, sometimes vendors
- Preferred sign-off: "Thanks, Alex"
- Tone notes: friendly but direct; avoid exclamation marks; no "Hope this finds you well"

# Vocabulary
- Project / product names to preserve exactly: Project Nimbus, Acme Pro
- Acronyms I use: PRD, OKR, QBR
```

## 使用

```bash
# 复制草稿后
fix-email
```

输出：

- **stdout**：改写后的邮件正文，方便你扫一眼。
- **剪贴板**：同样内容，直接 Ctrl+V 粘进邮件客户端。
- **stderr**：一行 token 统计，跑第二次会看到 `cache_read > 0`，说明 prompt caching 在省钱。

## 常见问题

- **`ANTHROPIC_API_KEY is not set`** → `export ANTHROPIC_API_KEY=sk-ant-...`，或写进 `~/.bashrc`。
- **`Could not read clipboard`** → Linux 上装 `xclip`（或 `xsel` / `wl-clipboard`）。
- **`Clipboard is empty`** → 先在邮件客户端里复制草稿，再跑命令。
- **想改模型** → 编辑 `fix_email.py` 顶部的 `MODEL` 常量。

## 模型

默认 `claude-sonnet-4-6`——改写类任务的甜点：语气到位、速度够快、比 Opus 便宜。
