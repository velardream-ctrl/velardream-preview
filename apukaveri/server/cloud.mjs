import worker from "./worker.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (!local || env.MODE !== "synthetic") {
      return new Response("Local test only", { status: 403 });
    }

    const serverEnv = {
      MODE: env.MODE,
      DB: env.DB,
      deliver: (email, purpose, code) =>
        console.log("TEST MAIL", email, purpose, code),
    };
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
    if (!publicPaths.has(url.pathname)) return new Response(null, { status: 404 });
    const asset = url.pathname === "/"
      ? new Request(new URL("/index.html", url), request)
      : request;
    return env.ASSETS.fetch(asset);
  },
};

const publicPaths = new Set([
  "/", "/index.html", "/account.html", "/dispatch.html", "/sandbox.html",
  "/location-select.mjs", "/finnish-cities.mjs", "/availability.mjs", "/helper-profile.js", "/sandbox.mjs", "/owner.mjs",
  "/profile-tools.mjs", "/helsinki.mjs", "/manifest.webmanifest", "/sw.js",
  "/logo.svg", "/icon192.png", "/icon512.png",
]);
