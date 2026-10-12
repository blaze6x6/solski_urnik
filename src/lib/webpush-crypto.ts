// ---------------------------------------------------------------------------
// Čista kriptografija za Web Push (brez baze): VAPID podpis + aes128gcm
// ---------------------------------------------------------------------------

import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";

export const b64u = (b: Buffer) => b.toString("base64url");
export const fromB64u = (s: string) => Buffer.from(s, "base64url");

/** VAPID glava Authorization za dano končno točko. */
export function buildVapidHeader(endpoint: string, publicKey: string, privateKey: string, subject: string): string {
  const pub = fromB64u(publicKey);
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: privateKey },
    format: "jwk",
  });
  const aud = new URL(endpoint).origin;
  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const data = `${header}.${claims}`;
  const sig = sign("sha256", Buffer.from(data), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${data}.${b64u(sig)}, k=${publicKey}`;
}


export function encryptPayload(payload: Buffer, p256dh: string, auth: string): Buffer {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const salt = randomBytes(16);
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  // en sam zapis: vsebina + ločilo 0x02
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, encrypted]);
}

