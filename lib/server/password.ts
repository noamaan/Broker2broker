import "server-only";
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
const KEY_LENGTH = 64;
const OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function derive(password:string,salt:Buffer):Promise<Buffer>{
  return new Promise((resolve,reject)=>nodeScrypt(password,salt,KEY_LENGTH,OPTIONS,(error,key)=>error?reject(error):resolve(key)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await derive(password,salt);
  return { passwordSalt: salt.toString("hex"), passwordHash: derived.toString("hex") };
}

export async function verifyPassword(password: string, saltHex: string, hashHex: string) {
  if (!/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await derive(password,Buffer.from(saltHex, "hex"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function randomResetToken() { return randomBytes(32).toString("base64url"); }
