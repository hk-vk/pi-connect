import { DynamicBorder, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getEnvApiKey } from "@mariozechner/pi-ai";
import { Container, SelectList, Text, type SelectItem } from "@mariozechner/pi-tui";
import { exec as execCb } from "node:child_process";

const API_KEY_PROVIDERS: Record<string, { label: string; env?: string; hint?: string }> = {
  anthropic: { label: "Anthropic", env: "ANTHROPIC_API_KEY" },
  "azure-openai-responses": { label: "Azure OpenAI Responses", env: "AZURE_OPENAI_API_KEY" },
  openai: { label: "OpenAI", env: "OPENAI_API_KEY" },
  google: { label: "Google Gemini", env: "GEMINI_API_KEY" },
  mistral: { label: "Mistral", env: "MISTRAL_API_KEY" },
  groq: { label: "Groq", env: "GROQ_API_KEY" },
  cerebras: { label: "Cerebras", env: "CEREBRAS_API_KEY" },
  xai: { label: "xAI", env: "XAI_API_KEY" },
  openrouter: { label: "OpenRouter", env: "OPENROUTER_API_KEY" },
  "vercel-ai-gateway": { label: "Vercel AI Gateway", env: "AI_GATEWAY_API_KEY" },
  zai: { label: "ZAI", env: "ZAI_API_KEY" },
  opencode: { label: "OpenCode Zen", env: "OPENCODE_API_KEY" },
  "opencode-go": { label: "OpenCode Go", env: "OPENCODE_API_KEY" },
  huggingface: { label: "Hugging Face", env: "HF_TOKEN" },
  "kimi-coding": { label: "Kimi For Coding", env: "KIMI_API_KEY" },
  minimax: { label: "MiniMax", env: "MINIMAX_API_KEY" },
  "minimax-cn": { label: "MiniMax (China)", env: "MINIMAX_CN_API_KEY" },
};

const PRIORITY: Record<string, number> = {
  anthropic: 0,
  openai: 1,
  "openai-codex": 2,
  "github-copilot": 3,
  google: 4,
  "google-gemini-cli": 5,
  openrouter: 6,
  opencode: 7,
  "opencode-go": 8,
};

const LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(API_KEY_PROVIDERS).map(([id, value]) => [id, value.label])),
  anthropic: "Anthropic",
  "openai-codex": "ChatGPT Plus/Pro (Codex)",
  "github-copilot": "GitHub Copilot",
  "google-gemini-cli": "Google Gemini CLI",
  "google-antigravity": "Google Antigravity",
};

function prettyProviderName(providerId: string): string {
  return LABELS[providerId] ?? providerId.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function openUrl(url: string): void {
  const command = process.platform === "darwin"
    ? `open ${JSON.stringify(url)}`
    : process.platform === "win32"
      ? `start "" ${JSON.stringify(url)}`
      : `xdg-open ${JSON.stringify(url)}`;
  execCb(command, () => {});
}

async function pickItem(ctx: any, title: string, subtitle: string | undefined, items: SelectItem[]): Promise<SelectItem | null> {
  return ctx.ui.custom<SelectItem | null>((tui, theme, _kb, done) => {
    const container = new Container();

    // Top border
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    // Title (bold)
    container.addChild(new Text(theme.fg("text", theme.bold(title)), 1, 0));

    // Subtitle if provided (muted, smaller hint)
    if (subtitle) {
      container.addChild(new Text(theme.fg("dim", subtitle), 1, 0));
    }

    // Spacing before list
    container.addChild(new Text("", 0, 0));

    // Calculate visible items based on terminal height
    const maxVisible = Math.max(6, Math.min(items.length, Math.floor((tui.terminal.rows - 12) / 2)));

    const list = new SelectList(items, maxVisible, {
      selectedPrefix: (t) => theme.fg("accent", t),
      selectedText: (t) => theme.fg("accent", theme.bold(t)),
      description: (t) => theme.fg("muted", t),
      scrollInfo: (t) => theme.fg("dim", t),
      noMatch: (t) => theme.fg("warning", t),
    });
    list.onSelect = (item) => done(item);
    list.onCancel = () => done(null);
    container.addChild(list);

    // Spacing before legend
    container.addChild(new Text("", 0, 0));

    // Legend for status icons - on ONE clean line
    container.addChild(new Text(
      `${theme.fg("success", "●")} connected   ${theme.fg("warning", "◌")} env   ${theme.fg("muted", "○")} new`,
      1, 0
    ));

    // Keyboard hints
    container.addChild(new Text(theme.fg("dim", "↑↓ navigate  •  Enter select  •  Esc cancel"), 1, 0));

    // Bottom border
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    return {
      render: (w) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data) => {
        list.handleInput(data);
        tui.requestRender();
      },
    };
  });
}

export default function piConnectExtension(pi: ExtensionAPI) {
  async function chooseProvider(ctx: any) {
    const authStorage = ctx.modelRegistry.authStorage;
    const oauthProviders = authStorage.getOAuthProviders();
    const modelProviderIds = new Set(ctx.modelRegistry.getAll().map((model) => model.provider));

    const apiProviders = Object.keys(API_KEY_PROVIDERS)
      .filter((providerId) => modelProviderIds.has(providerId) || authStorage.has(providerId) || !!getEnvApiKey(providerId))
      .sort((a, b) => (PRIORITY[a] ?? 99) - (PRIORITY[b] ?? 99) || prettyProviderName(a).localeCompare(prettyProviderName(b)));

    const statusIcon = (providerId: string) => {
      if (authStorage.has(providerId)) return ctx.ui.theme.fg("success", "●");
      if (getEnvApiKey(providerId)) return ctx.ui.theme.fg("warning", "◌");
      return ctx.ui.theme.fg("muted", "○");
    };

    const items: SelectItem[] = [];

    // OAuth section
    if (oauthProviders.length > 0) {
      items.push({
        value: "__section_oauth",
        label: ctx.ui.theme.bold("OAuth providers"),
        description: "login via browser subscription",
      });
      for (const provider of oauthProviders) {
        items.push({
          value: `oauth:${provider.id}`,
          label: `${statusIcon(provider.id)} ${provider.name}`,
          description: "subscription",
        });
      }
    }

    // API key section
    if (apiProviders.length > 0) {
      items.push({
        value: "__section_api",
        label: ctx.ui.theme.bold("API key providers"),
        description: "paste your key directly",
      });
      for (const providerId of apiProviders) {
        const envName = API_KEY_PROVIDERS[providerId]?.env;
        items.push({
          value: `api:${providerId}`,
          label: `${statusIcon(providerId)} ${prettyProviderName(providerId)}`,
          description: envName || "key",
        });
      }
    }

    const selected = await pickItem(ctx, "Connect provider", "OAuth first, API key providers below", items);
    if (!selected || selected.value.startsWith("__section_")) return;

    const [kind, providerId] = selected.value.split(":", 2);
    if (!providerId) return;

    if (kind === "oauth") {
      await loginWithOAuth(providerId, ctx);
      return;
    }

    await promptApiKey(providerId, ctx);
  }

  async function promptApiKey(providerId: string, ctx: any) {
    const authStorage = ctx.modelRegistry.authStorage;
    const provider = API_KEY_PROVIDERS[providerId];
    const label = prettyProviderName(providerId);
    const prompt = provider?.env
      ? `${label} API key (${provider.env})`
      : `${label} API key`;
    const value = await ctx.ui.input(prompt, "Paste API key");
    if (!value) {
      ctx.ui.notify("Cancelled", "info");
      return;
    }
    authStorage.set(providerId, { type: "api_key", key: value.trim() });
    ctx.ui.notify(`Saved ${prettyProviderName(providerId)}`, "info");
  }

  async function loginWithOAuth(providerId: string, ctx: any) {
    const authStorage = ctx.modelRegistry.authStorage;
    await authStorage.login(providerId, {
      onAuth: ({ url, instructions }) => {
        openUrl(url);
        ctx.ui.notify(instructions ? `${instructions}\n${url}` : url, "info");
      },
      onPrompt: async ({ message, placeholder }) => {
        return (await ctx.ui.input(message, placeholder)) ?? "";
      },
      onManualCodeInput: async () => {
        return (await ctx.ui.input("Paste the callback URL or code", "code or redirect URL")) ?? "";
      },
      onProgress: (message) => {
        ctx.ui.notify(message, "info");
      },
    });
    ctx.ui.notify(`Connected ${prettyProviderName(providerId)}`, "info");
  }

  pi.registerCommand("connect", {
    description: "Connect a provider with OAuth or an API key",
    handler: async (args, ctx) => {
      const providerId = args.trim();
      if (!providerId) {
        await chooseProvider(ctx);
        return;
      }

      const normalized = providerId.toLowerCase();
      const oauthIds = new Set(ctx.modelRegistry.authStorage.getOAuthProviders().map((provider) => provider.id));
      if (oauthIds.has(normalized)) {
        if (API_KEY_PROVIDERS[normalized]) {
          const method = await pickItem(ctx, prettyProviderName(normalized), "Choose how to connect", [
            { value: "oauth", label: `${ctx.ui.theme.bold("OAuth")}`, description: "Subscription login" },
            { value: "api", label: `${ctx.ui.theme.bold("API key")}`, description: "Paste a provider key" },
          ]);
          if (!method) return;
          if (method.value === "oauth") {
            await loginWithOAuth(normalized, ctx);
            return;
          }
        } else {
          await loginWithOAuth(normalized, ctx);
          return;
        }
      }

      await promptApiKey(normalized, ctx);
    },
  });

  pi.registerCommand("disconnect", {
    description: "Remove saved provider credentials",
    handler: async (_args, ctx) => {
      const authStorage = ctx.modelRegistry.authStorage;
      const providers = authStorage.list().sort((a, b) => prettyProviderName(a).localeCompare(prettyProviderName(b)));
      if (providers.length === 0) {
        ctx.ui.notify("No saved credentials", "info");
        return;
      }
      const items: SelectItem[] = providers.map((providerId) => ({
        value: providerId,
        label: `${ctx.ui.theme.fg("success", "●")} ${ctx.ui.theme.bold(prettyProviderName(providerId))}`,
        description: "Connected",
      }));
      const selected = await pickItem(ctx, "Disconnect provider", "Remove a saved credential", items);
      const providerId = selected?.value;
      if (!providerId) return;
      authStorage.remove(providerId);
      ctx.ui.notify(`Removed ${prettyProviderName(providerId)}`, "info");
    },
  });
}
