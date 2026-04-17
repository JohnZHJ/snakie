# 邮件改写器（网页版）

一个跑在自己电脑上的小网页，把英文邮件草稿改成语法正确、简洁、客气礼貌的版本。适合职场日常写给同事、客户、上司。

![workflow](https://placehold.co/600x40/e3e6ea/1f2328?text=%E7%B2%98%E8%8D%89%E7%A8%BF+%E2%86%92+%E4%B8%80%E9%94%AE%E6%94%B9%E5%86%99+%E2%86%92+%E5%A4%8D%E5%88%B6)

## 怎么用（日常）

1. 双击启动（或终端里跑 `python app.py`），浏览器会自动打开。
2. 左边文本框粘贴你的英文草稿。
3. 点「一键改写」，几秒后右边出来改好的版本。
4. 点「复制」，直接粘回邮件客户端。

第一次使用前，记得点顶栏的「我的档案」，填一下你的个人信息（身份、常用收件人、签名、语气偏好），Claude 会照着你的风格改。

## 安装（只需做一次）

需要 Python 3.10 或更新。不确定的话在终端敲 `python3 --version` 查一下。

```bash
# 1. 进入项目目录
cd /path/to/snakie

# 2. 创建虚拟环境并激活
python3 -m venv .venv
source .venv/bin/activate          # Windows 上用：  .venv\Scripts\activate

# 3. 装依赖
pip install -e .

# 4. 设置 Anthropic API key（写进 ~/.bashrc 或 ~/.zshrc 最省事）
export ANTHROPIC_API_KEY=sk-ant-...
```

没有 API key？到 <https://console.anthropic.com/> 注册账号，「API Keys」页面新建一个就行。

## 启动

```bash
source .venv/bin/activate          # 每次开新终端都要先激活
python app.py
```

看到 `fix-email running at http://127.0.0.1:5000` 就说明起来了，浏览器会自动开一个标签页。

要关掉服务：回到终端按 `Ctrl+C`。

## 第一次：填个人档案

打开网页后点顶栏右上角「我的档案」，把你的信息填进去，点「保存」。示例：

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

填得越具体，改写效果越贴近你平时的风格。

## 常见问题

- **浏览器没自动打开** → 手动访问 <http://127.0.0.1:5000>。
- **页面显示但点改写报 "ANTHROPIC_API_KEY is not set"** → 在**同一个终端**先 `export ANTHROPIC_API_KEY=sk-ant-...`，再 `python app.py`。写进 `~/.bashrc` 可以一劳永逸。
- **端口被占用（5000 被其他程序用了）** → 换一个：`PORT=5050 python app.py`。
- **想让别的设备访问（例如手机）** → `HOST=0.0.0.0 python app.py`，然后用电脑局域网 IP 访问。注意这会把服务暴露到局域网里。
- **想换模型** → 改 `app.py` 顶部的 `MODEL` 常量。

## 模型

默认 `claude-sonnet-4-6`——改写类任务的甜点：语气到位、速度够快、比 Opus 便宜。开启了 prompt caching，多次改写能省一部分输入 token 的钱。

## 项目结构

```
snakie/
├── app.py               # Flask 后端，3 个 API 路由
├── templates/
│   └── index.html       # 前端页面，所有 JS/CSS 内联
├── profile.md           # 你的个人档案（网页里可编辑）
├── pyproject.toml       # 依赖清单
└── README.md
```
