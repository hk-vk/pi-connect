# pi-connect

**Unified OAuth & API key login for pi** — OpenCode-inspired UI to connect 15+ providers from one `/connect` command.

Paste & save API keys, or login with OAuth, for providers supported by pi like Anthropic, OpenAI, OpenCode, OpenRouter, Gemini, Groq, and more.

Official pi providers list:
- https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/providers.md

## Install

```bash
pi install git:github.com/hk-vk/pi-connect
```

## Usage

### `/connect` — connect any provider

**OAuth** (browser login) or **API key** (paste your key) — one unified UI for all providers supported by pi.

```bash
/connect
```

Opens a picker like this:

```text
╭───────────────────────────────────╮
│ Connect provider                  │
│                                   │
│ ○ Anthropic     OAuth             │
│ ○ ChatGPT       OAuth             │
│ ○ Copilot       OAuth             │
│ ○ OpenAI        API key           │
│ ○ OpenRouter    API key           │
│ ○ OpenCode      API key           │
│ ○ Gemini        API key           │
│ ○ Groq          API key           │
│                                   │
│ ● connected  ◌ env  ○ new        │
╰───────────────────────────────────╯
```

Status:
- `● connected` = saved in `auth.json`
- `◌ env` = available from environment variable
- `○ new` = not configured yet

### Direct connect

```bash
/connect openai
/connect anthropic
/connect openrouter
```

### `/disconnect` — remove a saved credential

```bash
/disconnect
```

## Supported — 15+ providers

**OAuth:**
- Anthropic (Claude Pro/Max)
- ChatGPT Plus/Pro (Codex)
- GitHub Copilot
- Google Gemini CLI
- Google Antigravity

**API key:**
- Anthropic
- OpenAI
- OpenCode
- OpenRouter
- Google Gemini
- Groq
- Mistral
- Cerebras
- xAI
- ZAI
- Azure OpenAI
- Vercel AI Gateway
- Hugging Face
- Kimi
- MiniMax

See the official pi provider documentation for the full list and auth details:
- https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/providers.md

## License

MIT
