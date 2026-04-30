import { Socket } from "node:net";
import { env } from "@/lib/env";

export type ScanVerdict = "CLEAN" | "INFECTED" | "ERROR";

export interface ScanResult {
  verdict: ScanVerdict;
  signature?: string;
  message?: string;
}

/**
 * Scanner antivirus.
 *
 * - Si CLAMAV_HOST est défini, communique avec un daemon clamd via TCP (commande INSTREAM).
 * - Sinon (mode dev/CI), retourne CLEAN immédiatement — sauf pour les fichiers
 *   contenant la signature de test EICAR ou la chaîne "VIRUS_TEST" (utile pour
 *   les tests).
 */
export async function scanBuffer(data: Buffer): Promise<ScanResult> {
  if (!env.CLAMAV_HOST || !env.CLAMAV_PORT) {
    return scanWithStub(data);
  }
  return scanWithClamd(data, env.CLAMAV_HOST, env.CLAMAV_PORT);
}

const EICAR_SIGNATURE = "EICAR-STANDARD-ANTIVIRUS-TEST-FILE";
const TEST_MARKER = "VIRUS_TEST";

function scanWithStub(data: Buffer): Promise<ScanResult> {
  const text = data.subarray(0, Math.min(2048, data.length)).toString("utf8");
  if (text.includes(EICAR_SIGNATURE) || text.includes(TEST_MARKER)) {
    return Promise.resolve({
      verdict: "INFECTED",
      signature: "STUB-TEST-SIGNATURE",
      message: "Marqueur de test détecté en mode stub.",
    });
  }
  return Promise.resolve({ verdict: "CLEAN" });
}

const CHUNK_SIZE = 64 * 1024;

function scanWithClamd(
  data: Buffer,
  host: string,
  port: number,
): Promise<ScanResult> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let response = "";
    let settled = false;
    const settle = (result: ScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(30_000);
    socket.on("timeout", () =>
      settle({ verdict: "ERROR", message: "ClamAV timeout" }),
    );
    socket.on("error", (err) =>
      settle({ verdict: "ERROR", message: err.message }),
    );

    socket.connect(port, host, () => {
      socket.write("zINSTREAM\0");

      let offset = 0;
      const writeNext = () => {
        if (offset >= data.length) {
          // Trailer : chunk size = 0
          const trailer = Buffer.alloc(4);
          socket.write(trailer);
          return;
        }
        const chunk = data.subarray(offset, offset + CHUNK_SIZE);
        const sizeBuffer = Buffer.alloc(4);
        sizeBuffer.writeUInt32BE(chunk.length, 0);
        socket.write(sizeBuffer);
        socket.write(chunk, () => {
          offset += chunk.length;
          writeNext();
        });
      };
      writeNext();
    });

    socket.on("data", (data) => {
      response += data.toString("utf8");
    });

    socket.on("close", () => {
      const trimmed = response.trim().replace(/\0$/, "");
      if (trimmed.endsWith("OK")) {
        settle({ verdict: "CLEAN", message: trimmed });
        return;
      }
      const match = trimmed.match(/: (.+) FOUND$/);
      if (match) {
        settle({
          verdict: "INFECTED",
          signature: match[1],
          message: trimmed,
        });
        return;
      }
      settle({
        verdict: "ERROR",
        message: trimmed || "Réponse ClamAV inattendue",
      });
    });
  });
}
