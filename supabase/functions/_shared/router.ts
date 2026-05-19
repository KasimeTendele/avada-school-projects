import { corsHeaders } from "./cors.ts";
import { errors } from "./response.ts";

type Handler = (req: Request, params: Record<string, string>) => Promise<Response> | Response;

interface RouteEntry {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}

export class Router {
  private routes: RouteEntry[] = [];
  private prefix: string;

  constructor(prefix: string) {
    // prefix like "/auth" — function name in Supabase
    this.prefix = prefix.replace(/\/$/, "");
  }

  add(method: string, path: string, handler: Handler) {
    const paramNames: string[] = [];
    const regex =
      "^" +
      path.replace(/:[a-zA-Z0-9_]+/g, (m) => {
        paramNames.push(m.slice(1));
        return "([^/]+)";
      }) +
      "/?$";
    this.routes.push({
      method: method.toUpperCase(),
      pattern: new RegExp(regex),
      paramNames,
      handler,
    });
    return this;
  }

  get(path: string, h: Handler) { return this.add("GET", path, h); }
  post(path: string, h: Handler) { return this.add("POST", path, h); }
  put(path: string, h: Handler) { return this.add("PUT", path, h); }
  patch(path: string, h: Handler) { return this.add("PATCH", path, h); }
  delete(path: string, h: Handler) { return this.add("DELETE", path, h); }

  async handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    const url = new URL(req.url);
    let path = url.pathname;
    // strip "/functions/v1/<prefix>" or "/<prefix>"
    const idx = path.indexOf(this.prefix);
    if (idx >= 0) path = path.slice(idx + this.prefix.length);
    if (!path.startsWith("/")) path = "/" + path;

    for (const route of this.routes) {
      if (route.method !== req.method) continue;
      const m = path.match(route.pattern);
      if (m) {
        const params: Record<string, string> = {};
        route.paramNames.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
        try {
          return await route.handler(req, params);
        } catch (e) {
          console.error(`[${this.prefix}] handler error:`, e);
          return errors.internal((e as Error)?.message ?? "Unhandled error");
        }
      }
    }
    return errors.notFound(`No route for ${req.method} ${path}`);
  }
}
