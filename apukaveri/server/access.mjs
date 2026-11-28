const bytes = new TextEncoder();
const decoder = new TextDecoder();

function decode(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw Error("Invalid Access token");
  return Uint8Array.from(atob(segment.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
}

const keySets = new Map();
async function signingKeys(issuer) {
  const now = Date.now();
  const cached = keySets.get(issuer);
  if (cached && cached.expires > now) return cached.keys;
  const keys = (async () => {
    const response = await fetch(issuer + "/cdn-cgi/access/certs", { redirect: "error" });
    if (!response.ok) throw Error("Access keys unavailable");
    return (await response.json()).keys;
  })();
  keySets.set(issuer, { keys, expires: now + 60000 });
  try {
    return await keys;
  } catch (error) {
    keySets.delete(issuer);
    throw error;
  }
}

export async function pilotIdentity(request, env) {
  const url = new URL(request.url);
  const issuer = env.ACCESS_ISSUER;
  const audience = env.ACCESS_AUDIENCE;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (url.protocol !== "https:" || url.host !== env.PILOT_HOST ||
      !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || "") ||
      !/^[a-f0-9]{64}$/.test(audience || "") || !token || token.length > 16000) {
    return false;
  }

  try {
    const segments = token.split(".");
    if (segments.length !== 3) return false;
    const [headerPart, claimsPart, signature] = segments;
    const header = JSON.parse(decoder.decode(decode(headerPart)));
    const claims = JSON.parse(decoder.decode(decode(claimsPart)));
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "RS256" || typeof header.kid !== "string" ||
        claims.iss !== issuer || !Array.isArray(claims.aud) || !claims.aud.includes(audience) ||
        claims.type !== "app" || !claims.email || typeof claims.email !== "string" ||
        !Number.isSafeInteger(claims.exp) || claims.exp <= now ||
        (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > now))) {
      return false;
    }

    const jwk = (await signingKeys(issuer)).find(key => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return false;
    const algorithm = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" };
    const key = await crypto.subtle.importKey("jwk", jwk, algorithm, false, ["verify"]);
    const valid = await crypto.subtle.verify(algorithm, key, decode(signature), bytes.encode(headerPart + "." + claimsPart));
    return valid ? claims.email.trim().toLowerCase() : false;
  } catch {
    return false;
  }
}
