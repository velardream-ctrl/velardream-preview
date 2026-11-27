import worker from "./worker.mjs";
import { hasPilotAccess } from "./access.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const pilot = env.MODE === "closed-pilot";
    if (pilot ? !(await hasPilotAccess(request, env)) : !local || env.MODE !== "synthetic") {
      return new Response("Access required", { status: 403, headers: { "Cache-Control": "no-store" } });
    }

    const serverEnv = {
      MODE: "synthetic",
      DB: env.DB,
      deliver: !pilot ? (email, purpose, code) =>
        console.log("TEST MAIL", email, purpose, code) : undefined,
    };
    if (pilot && ["/api/register", "/api/recover", "/api/verify", "/api/reset"].includes(url.pathname)) {
      return Response.json({ error: "Use a provisioned pilot account" }, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (url.pathname.startsWith("/api/")) {
      return worker.fetch(request, serverEnv);
    }

    if (url.pathname === "/admin") {
      const headers = new Headers(request.headers);
      const check = await worker.fetch(
        new Request(new URL("/api/admin", url), { headers }),
        serverEnv,
      );
      if (!check.ok) return check;
      const page = await env.ASSETS.fetch(new Request(new URL("/admin.html", url), request));
      const responseHeaders = new Headers(page.headers);
      responseHeaders.set("Cache-Control", "private, no-store");
      return new Response(page.body, { status: page.status, headers: responseHeaders });
    }

    // Workers Assets can resolve encoded paths and extensionless HTML aliases.
    // Allow only known public URLs before forwarding to the binding.
    if (pilot && !pilotPaths.has(url.pathname)) return new Response(null, { status: 404 });
    if (!publicPaths.has(url.pathname)) return new Response(null, { status: 404 });
    const asset = url.pathname === "/"
      ? new Request(new URL(pilot ? "/sandbox.html" : "/index.html", url), request)
      : request;
    const response = await env.ASSETS.fetch(asset);
    if (!pilot) return response;
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store");
    return new Response(response.body, { status: response.status, headers });

  },
};

const publicPaths = new Set([
  "/", "/index.html", "/account.html", "/account.webmanifest", "/account-worker.js", "/dispatch.html", "/sandbox.html",
  "/location-select.mjs", "/finnish-cities.mjs", "/availability.mjs", "/helper-profile.js", "/sandbox.mjs", "/registration-terms.mjs", "/owner.mjs",
  "/service-categories.mjs", "/profile-languages.mjs", "/profile-tools.mjs", "/helsinki.mjs", "/manifest.webmanifest", "/sw.js",
  "/logo.svg", "/icon192.png", "/icon512.png",
]);

const pilotPaths = new Set([
  "/", "/sandbox.html", "/sandbox.mjs", "/registration-terms.mjs", "/owner.mjs",
  "/availability.mjs", "/location-select.mjs", "/profile-languages.mjs", "/profile-tools.mjs",
  "/helsinki.mjs", "/logo.svg", "/icon192.png", "/icon512.png",
]);
