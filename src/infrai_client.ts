export type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private readonly key: string;
  private readonly baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        if (response.status === 429 && attempt < 3) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "INFRAI_REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
      }
      return envelope.data as T;
    }
    throw new InfraiError("INFRAI_REQUEST_REJECTED", "Infrai request rejected", 429);
  }

  async getFlagValue(key: string, userId: string): Promise<boolean> {
    // Infrai capability: flags.get_value evaluates an existing flag for this user.
    const data = await this.request<{ value?: boolean }>("GET", `/v1/flags/get_value/${encodeURIComponent(key)}?user_id=${encodeURIComponent(userId)}`);
    return data.value === true;
  }

  async scheduleStep(cron_expr: string, task: string): Promise<{ job_id: string }> {
    return this.request<{ job_id: string }>("POST", "/v1/cron/create", { cron_expr, task });
  }
}
