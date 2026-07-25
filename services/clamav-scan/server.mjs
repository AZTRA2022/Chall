import { createServer } from "node:http";
import { connect } from "node:net";

/**
 * Passerelle HTTP devant `clamd`.
 *
 * Convex envoie les octets bruts en POST et attend `{ "infected": bool }`.
 * Le dialogue avec clamd passe par son protocole INSTREAM, qui évite d'écrire
 * le fichier sur disque — utile ici, où le conteneur est éphémère.
 */

const PORT = Number(process.env.PORT ?? 8080);
const CLAMD_HOST = process.env.CLAMD_HOST ?? "127.0.0.1";
const CLAMD_PORT = Number(process.env.CLAMD_PORT ?? 3310);
const MAX_BYTES = Number(process.env.MAX_BYTES ?? 25 * 1024 * 1024);

/**
 * Jeton partagé avec Convex. Sans lui, n'importe qui pourrait faire analyser
 * n'importe quoi à vos frais — le service est exposé sur Internet.
 */
const AUTH_TOKEN = process.env.SCAN_AUTH_TOKEN;

/** Envoie le buffer à clamd en INSTREAM et renvoie sa réponse texte. */
function scanBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const socket = connect(CLAMD_PORT, CLAMD_HOST);
    let response = "";

    socket.setTimeout(60_000, () => {
      socket.destroy();
      reject(new Error("clamd timeout"));
    });

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");

      // INSTREAM attend des morceaux préfixés de leur taille sur 4 octets,
      // terminés par un bloc de taille zéro.
      const CHUNK = 64 * 1024;
      for (let offset = 0; offset < buffer.length; offset += CHUNK) {
        const chunk = buffer.subarray(offset, offset + CHUNK);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length, 0);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });

    socket.on("data", (data) => {
      response += data.toString("utf8");
    });
    socket.on("error", reject);
    socket.on("close", () => resolve(response.trim()));
  });
}

const server = createServer(async (req, res) => {
  const json = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  if (req.method === "GET" && req.url === "/health") {
    return json(200, { ok: true });
  }

  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  if (AUTH_TOKEN && req.headers.authorization !== `Bearer ${AUTH_TOKEN}`) {
    return json(401, { error: "unauthorized" });
  }

  const chunks = [];
  let received = 0;

  for await (const chunk of req) {
    received += chunk.length;
    // Coupure dès le dépassement : accepter puis refuser laisserait un
    // inconnu saturer la mémoire du conteneur.
    if (received > MAX_BYTES) {
      req.destroy();
      return json(413, { error: "file too large" });
    }
    chunks.push(chunk);
  }

  try {
    const result = await scanBuffer(Buffer.concat(chunks));
    // clamd répond « stream: OK » ou « stream: <signature> FOUND ».
    const infected = result.includes("FOUND");
    return json(200, { infected, raw: result });
  } catch (error) {
    console.error("[scan] clamd indisponible", error);
    // 503 et non 200 : Convex doit marquer le fichier en `error` et le
    // reprendre au prochain passage du cron, pas le considérer comme propre.
    return json(503, { error: "scanner unavailable" });
  }
});

server.listen(PORT, () => {
  console.log(`[scan] à l'écoute sur :${PORT}`);
});
