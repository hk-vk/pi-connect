import { DynamicBorder, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getEnvApiKey } from "@mariozechner/pi-ai";
import { Container, SelectList, Text, type SelectItem } from "@mariozechner/pi-tui";
import { exec as execCb } from "node:child_process";

const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
  openrouter: "OpenRouter",
  opencode: "OpenCode",
  "opencode-go": "OpenCode Go",
  groq: "Groq",
  mistral: "Mistral",
  cerebras: "Cerebras",
  xai: "xAI",
  zai: "ZAI",
  huggingface: "Hugging Face",
  "kimi-coding": "Kimi",
  minimax: "MiniMax",
  "minimax-cn": "MiniMax China",
  "azure-openai-responses": "Azure OpenAI",
  "vercel-ai-gateway": "Vercel AI Gateway",
  "openai-codex": "ChatGPT",
  "github-copilot": "Copilot",
  "google-gemini-cli": "Gemini CLI",
  "google-antigravity": "Antigravity",
  "google-vertex": "Google Vertex",
  "amazon-bedrock": "Amazon Bedrock"
};

const ENV_VAR_OVERRIDES: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  opencode: "OPENCODE_API_KEY",
  "opencode-go": "OPENCODE_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  xai: "XAI_API_KEY",
  zai: "ZAI_API_KEY",
  huggingface: "HF_TOKEN",
  "kimi-coding": "KIMI_API_KEY",
  minimax: "MINIMAX_API_KEY",
  "minimax-cn": "MINIMAX_CN_API_KEY",
  "azure-openai-responses": "AZURE_OPENAI_API_KEY",
  "vercel-ai-gateway": "AI_GATEWAY_API_KEY"
};

const OAUTH_ONLY_PROVIDERS = new Set([
  "openai-codex",
  "github-copilot",
  "google-gemini-cli",
  "google-antigravity"
]);

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
  groq: 9,
  mistral: 10
};

function prettyProviderName(providerId: string): string {
  return DISPLAY_NAME_OVERRIDES[providerId]
    ?? providerId
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
}

function openUrl(url: string): void {
  const command = process.platform === "darwin"
    ? `open ${JSON.stringify(url)}`
    : process.platform === "win32"
      ? `start "" ${JSON.stringify(url)}`
      : `xdg-open ${JSON.stringify(url)}`;
  execCb(command, () => {});
}

function sortProviderIds(providerIds: string[]): string[] {
  return [...providerIds].sort((a, b) => {
    return (PRIORITY[a] ?? 99) - (PRIORITY[b] ?? 99)
      || prettyProviderName(a).localeCompare(prettyProviderName(b));
  });
}

function getRuntimeProviderIds(ctx: any): string[] {
  const fromModels = ctx.modelRegistry.getAll().map((model: any) => model.provider);
  const fromSavedAuth = ctx.modelRegistry.authStorage.list();
  const fromOauth = ctx.modelRegistry.authStorage.getOAuthProviders().map((provider: any) => provider.id);
  return [...new Set([...fromModels, ...fromSavedAuth, ...fromOauth])];
}

function getApiCapableProviderIds(ctx: any): string[] {
  return sortProviderIds(
    getRuntimeProviderIds(ctx).filter((providerId) => !OAUTH_ONLY_PROVIDERS.has(providerId))
  );
}

async function pickItem(ctx: any, title: string, subtitle: string | undefined, items: SelectItem[]): Promise<SelectItem | null> {
  return ctx.ui.custom<SelectItem | null>((tui, theme, _kb, done) => {
    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    container.addChild(new Text(theme.fg("text", theme.bold(title)), 1, 0));
    if (subtitle) container.addChild(new Text(theme.fg("dim", subtitle), 1, 0));
    container.addChild(new Text("", 0, 0));

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

    container.addChild(new Text("", 0, 0));
    container.addChild(new Text(`${theme.fg("success", "●")} connected   ${theme.fg("warning", "◌")} env   ${theme.fg("muted", "○")} new`, 1, 0));
    container.addChild(new Text(theme.fg("dim", "↑↓ navigate  •  Enter select  •  Esc cancel"), 1, 0));
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
    const apiProviderIds = getApiCapableProviderIds(ctx);

    const statusIcon = (providerId: string) => {
      if (authStorage.has(providerId)) return ctx.ui.theme.fg("success", "●");
      if (getEnvApiKey(providerId)) return ctx.ui.theme.fg("warning", "◌");
      return ctx.ui.theme.fg("muted", "○");
    };

    const items: SelectItem[] = [];

    if (oauthProviders.length > 0) {
      items.push({
        value: "__section_oauth",
        label: ctx.ui.theme.bold("OAuth providers"),
        description: "login via browser"
      });
      for (const provider of oauthProviders) {
        items.push({
          value: `oauth:${provider.id}`,
          label: `${statusIcon(provider.id)} ${provider.name}`,
          description: "OAuth"
        });
      }
    }

    if (apiProviderIds.length > 0) {
      items.push({
        value: "__section_api",
        label: ctx.ui.theme.bold("API key providers"),
        description: "paste and save key"
      });
      for (const providerId of apiProviderIds) {
        items.push({
          value: `api:${providerId}`,
          label: `${statusIcon(providerId)} ${prettyProviderName(providerId)}`,
          description: ENV_VAR_OVERRIDES[providerId] ?? "API key"
        });
      }
    }

    const selected = await pickItem(ctx, "Connect provider", "Unified OAuth and API key login", items);
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
    const prompt = ENV_VAR_OVERRIDES[providerId]
      ? `${prettyProviderName(providerId)} API key (${ENV_VAR_OVERRIDES[providerId]})`
      : `${prettyProviderName(providerId)} API key`;
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
      onPrompt: async ({ message, placeholder }) => (await ctx.ui.input(message, placeholder)) ?? "",
      onManualCodeInput: async () => (await ctx.ui.input("Paste the callback URL or code", "code or redirect URL")) ?? "",
      onProgress: (message) => ctx.ui.notify(message, "info"),
    });
    ctx.ui.notify(`Connected ${prettyProviderName(providerId)}`, "info");
  }

  pi.registerCommand("connect", {
    description: "Connect any OAuth or API key provider from one unified UI",
    handler: async (args, ctx) => {
      const providerId = args.trim().toLowerCase();
      if (!providerId) {
        await chooseProvider(ctx);
        return;
      }

      const oauthIds = new Set(ctx.modelRegistry.authStorage.getOAuthProviders().map((provider: any) => provider.id));
      const apiIds = new Set(getApiCapableProviderIds(ctx));

      if (oauthIds.has(providerId) && apiIds.has(providerId)) {
        const method = await pickItem(ctx, prettyProviderName(providerId), "Choose how to connect", [
          { value: "oauth", label: ctx.ui.theme.bold("OAuth"), description: "browser login" },
          { value: "api", label: ctx.ui.theme.bold("API key"), description: "paste and save key" },
        ]);
        if (!method) return;
        if (method.value === "oauth") {
          await loginWithOAuth(providerId, ctx);
          return;
        }
        await promptApiKey(providerId, ctx);
        return;
      }

      if (oauthIds.has(providerId)) {
        await loginWithOAuth(providerId, ctx);
        return;
      }

      await promptApiKey(providerId, ctx);
    },
  });

  pi.registerCommand("disconnect", {
    description: "Remove a saved provider credential",
    handler: async (_args, ctx) => {
      const authStorage = ctx.modelRegistry.authStorage;
      const providers = sortProviderIds(authStorage.list());
      if (providers.length === 0) {
        ctx.ui.notify("No saved credentials", "info");
        return;
      }
      const items: SelectItem[] = providers.map((providerId) => ({
        value: providerId,
        label: `${ctx.ui.theme.fg("success", "●")} ${ctx.ui.theme.bold(prettyProviderName(providerId))}`,
        description: "Connected"
      }));
      const selected = await pickItem(ctx, "Disconnect provider", "Remove a saved credential", items);
      const selectedProviderId = selected?.value;
      if (!selectedProviderId) return;
      authStorage.remove(selectedProviderId);
      ctx.ui.notify(`Removed ${prettyProviderName(selectedProviderId)}`, "info");
    },
  });
}
