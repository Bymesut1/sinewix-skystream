// ============================================================
//  Sinewix — SkyStream eklentisi (katalog + arama + detay + akış)   v1.0.0
//  Katalog/arama/detay: TMDB (Türkçe)   |   Akış: Sinewix API (imzalı + AES-GCM)
//  İç URL şeması:  movie:{tmdbId}   tv:{tmdbId}   episode:{tmdbId}:{sezon}:{bölüm}
// ============================================================
(function () {

var AYAR = {
  SITE: (typeof manifest !== 'undefined' && manifest && manifest.baseUrl) ? String(manifest.baseUrl).replace(/\/+$/, '') : 'https://ydfvfdizipanel.ru',
  EKLENTI_ADI: 'Sinewix',
  DEBUG_MODU: true,
  MAKS_AKIS: 6,
  ISTEK_SURESI: 12000,
  GENEL_SURE: 40000
};

var TMDB_KEY = '000316508321ce461cf81e7c6815eec7';
var PROVIDER_ID = 'sinewix';
var API_KEY = '9iQNC5HQwPlaFuJDkhncJ5XTJ8feGXOJatAA';
var PKG = 'com.wxsmash.game';
var APP_ID = 'sinewix-mobile';
var APP_VER = '2.5.3';
var HASH256 = 'f4d4bc98a3fc4600e7f2c2bab7533f1f03d8a70ff03c256bb11dc57050536bd0';
var CERT_HEX = '308202c3308201aca003020102021430030f5763077759b8be9be1c54b2d35c249457a300a06082a8648ce3d0403023053310b3009060355040613025452310f300d060355040813065475726b657931';
var SIGN_KEY = '4962QZiZZqWbQlC0k0pdIvojy-STtR8NTq7oQCxMGBF2kwsVX2DBxgK72BovMy4U';
var RESP_KEY = 'H1KKG-JCt1RqHQawNxw7xujy2-vevYuyBqX3Aei1EAdi9VwDnmRL-3Oz2xxvy1VU';
var API_UA = 'EasyPlex (Android 14; SM-A546B; Samsung Galaxy A54 5G; tr)';
var WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

var dbg = [];
var AUTH = { jwt: '', session: '', exp: 0, device: '' };

function note(m) { dbg.push(String(m).slice(0, 110)); }

// ---------------- Bayt / metin yardımcıları ----------------
function utf8Bytes(str) {
  var out = [], i, c, d;
  str = String(str);
  for (i = 0; i < str.length; i++) {
    c = str.charCodeAt(i);
    if (c >= 0xD800 && c < 0xDC00 && i + 1 < str.length) { d = str.charCodeAt(i + 1); if (d >= 0xDC00 && d < 0xE000) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; } }
    if (c < 128) out.push(c);
    else if (c < 2048) out.push(192 | (c >> 6), 128 | (c & 63));
    else if (c < 65536) out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    else out.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63));
  }
  return out;
}
function utf8Decode(b) {
  var s = '', i = 0, c, c2, c3, c4, cp;
  while (i < b.length) {
    c = b[i++];
    if (c < 128) s += String.fromCharCode(c);
    else if (c < 224) { c2 = b[i++]; s += String.fromCharCode(((c & 31) << 6) | (c2 & 63)); }
    else if (c < 240) { c2 = b[i++]; c3 = b[i++]; s += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63)); }
    else { c2 = b[i++]; c3 = b[i++]; c4 = b[i++]; cp = (((c & 7) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63)) - 0x10000; s += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 1023)); }
  }
  return s;
}
var B64C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64decode(s) {
  s = String(s || '').replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+\/]/g, '');
  var out = [], i, n, a, b, c, d;
  for (i = 0; i < s.length; i += 4) {
    a = B64C.indexOf(s.charAt(i)); b = B64C.indexOf(s.charAt(i + 1));
    c = i + 2 < s.length ? B64C.indexOf(s.charAt(i + 2)) : -1; d = i + 3 < s.length ? B64C.indexOf(s.charAt(i + 3)) : -1;
    n = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    out.push((n >> 16) & 255);
    if (c >= 0) out.push((n >> 8) & 255);
    if (d >= 0) out.push(n & 255);
  }
  return out;
}
function b64urlNoPad(bytes) {
  var o = '', i, n;
  for (i = 0; i < bytes.length; i += 3) {
    n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    o += B64C.charAt((n >> 18) & 63) + B64C.charAt((n >> 12) & 63) + (i + 1 < bytes.length ? B64C.charAt((n >> 6) & 63) : '') + (i + 2 < bytes.length ? B64C.charAt(n & 63) : '');
  }
  return o.replace(/\+/g, '-').replace(/\//g, '_');
}
function toHex(bytes) {
  var h = '', i, x;
  for (i = 0; i < bytes.length; i++) { x = bytes[i].toString(16); h += x.length < 2 ? '0' + x : x; }
  return h;
}
function randBytes(n) {
  var a = [], i;
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) { var u = new Uint8Array(n); crypto.getRandomValues(u); for (i = 0; i < n; i++) a.push(u[i]); return a; }
  } catch (e) {}
  for (i = 0; i < n; i++) a.push(Math.floor(Math.random() * 256));
  return a;
}
function newUuid() {
  var b = randBytes(16), h;
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  h = toHex(b);
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

// ---------------- SHA-256 / HMAC ----------------
var K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];
function sha256(msg) {
  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var l = msg.length, bits = l * 8, m = msg.slice(), i, j, w = new Array(64);
  m.push(0x80);
  while (m.length % 64 !== 56) m.push(0);
  var hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
  m.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  for (i = 0; i < m.length; i += 64) {
    for (j = 0; j < 16; j++) w[j] = ((m[i + j * 4] << 24) | (m[i + j * 4 + 1] << 16) | (m[i + j * 4 + 2] << 8) | m[i + j * 4 + 3]) | 0;
    for (j = 16; j < 64; j++) {
      var s0 = ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^ ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^ (w[j - 15] >>> 3);
      var s1 = ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^ ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (j = 0; j < 64; j++) {
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ (~e & g);
      var t1 = (h + S1 + ch + K256[j] + w[j]) | 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var mj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + mj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  var out = [];
  for (i = 0; i < 8; i++) out.push((H[i] >>> 24) & 255, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
  return out;
}
function hmac256(key, msg) {
  var i, ik = [], ok = [];
  if (key.length > 64) key = sha256(key);
  for (i = 0; i < 64; i++) { var kb = i < key.length ? key[i] : 0; ik.push(kb ^ 0x36); ok.push(kb ^ 0x5c); }
  return sha256(ok.concat(sha256(ik.concat(msg))));
}

// ---------------- AES-256 (yalnızca şifreleme yönü) + GCM çözme ----------------
var SBOX = null;
function aesInit() {
  if (SBOX) return;
  SBOX = new Array(256);
  var p = 1, q = 1, x;
  function rotl8(v, s) { return ((v << s) | (v >> (8 - s))) & 255; }
  do {
    p = (p ^ ((p << 1) & 255) ^ ((p & 0x80) ? 0x1b : 0)) & 255;
    q ^= (q << 1) & 255; q ^= (q << 2) & 255; q ^= (q << 4) & 255;
    if (q & 0x80) q ^= 0x09;
    x = q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4);
    SBOX[p] = (x ^ 0x63) & 255;
  } while (p !== 1);
  SBOX[0] = 0x63;
}
function xtime(a) { return ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 255; }
function aesExpand(key) {
  aesInit();
  var nk = key.length / 4, nr = nk + 6, w = [], i, t, rcon = 1, j;
  for (i = 0; i < nk; i++) w.push([key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]);
  for (i = nk; i < 4 * (nr + 1); i++) {
    t = w[i - 1].slice();
    if (i % nk === 0) {
      t = [SBOX[t[1]] ^ rcon, SBOX[t[2]], SBOX[t[3]], SBOX[t[0]]];
      rcon = xtime(rcon);
    } else if (nk > 6 && i % nk === 4) t = [SBOX[t[0]], SBOX[t[1]], SBOX[t[2]], SBOX[t[3]]];
    w.push([w[i - nk][0] ^ t[0], w[i - nk][1] ^ t[1], w[i - nk][2] ^ t[2], w[i - nk][3] ^ t[3]]);
  }
  var rk = [];
  for (i = 0; i <= nr; i++) { var r = []; for (j = 0; j < 4; j++) r = r.concat(w[4 * i + j]); rk.push(r); }
  return rk;
}
function aesBlock(rk, blk) {
  var nr = rk.length - 1, s = blk.slice(), r, i, t, a, b, c, d;
  for (i = 0; i < 16; i++) s[i] ^= rk[0][i];
  for (r = 1; r <= nr; r++) {
    for (i = 0; i < 16; i++) s[i] = SBOX[s[i]];
    t = s.slice();
    s[1] = t[5]; s[5] = t[9]; s[9] = t[13]; s[13] = t[1];
    s[2] = t[10]; s[6] = t[14]; s[10] = t[2]; s[14] = t[6];
    s[3] = t[15]; s[7] = t[3]; s[11] = t[7]; s[15] = t[11];
    if (r < nr) {
      for (i = 0; i < 16; i += 4) {
        a = s[i]; b = s[i + 1]; c = s[i + 2]; d = s[i + 3];
        s[i] = xtime(a) ^ (xtime(b) ^ b) ^ c ^ d;
        s[i + 1] = a ^ xtime(b) ^ (xtime(c) ^ c) ^ d;
        s[i + 2] = a ^ b ^ xtime(c) ^ (xtime(d) ^ d);
        s[i + 3] = (xtime(a) ^ a) ^ b ^ c ^ xtime(d);
      }
    }
    for (i = 0; i < 16; i++) s[i] ^= rk[r][i];
  }
  return s;
}
function ghashMul(X, H) {
  var Z0 = 0, Z1 = 0, Z2 = 0, Z3 = 0, V0 = H[0], V1 = H[1], V2 = H[2], V3 = H[3], i, bit, lsb;
  for (i = 0; i < 128; i++) {
    bit = (X[i >> 5] >>> (31 - (i & 31))) & 1;
    if (bit) { Z0 ^= V0; Z1 ^= V1; Z2 ^= V2; Z3 ^= V3; }
    lsb = V3 & 1;
    V3 = (V3 >>> 1) | (V2 << 31); V2 = (V2 >>> 1) | (V1 << 31); V1 = (V1 >>> 1) | (V0 << 31); V0 = V0 >>> 1;
    if (lsb) V0 ^= 0xe1000000;
  }
  return [Z0 | 0, Z1 | 0, Z2 | 0, Z3 | 0];
}
function words(b, o) { return [((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) | 0, ((b[o + 4] << 24) | (b[o + 5] << 16) | (b[o + 6] << 8) | b[o + 7]) | 0, ((b[o + 8] << 24) | (b[o + 9] << 16) | (b[o + 10] << 8) | b[o + 11]) | 0, ((b[o + 12] << 24) | (b[o + 13] << 16) | (b[o + 14] << 8) | b[o + 15]) | 0]; }
function ghash(H, data) {
  var Y = [0, 0, 0, 0], i, blk, k, X;
  for (i = 0; i < data.length; i += 16) {
    blk = data.slice(i, i + 16); while (blk.length < 16) blk.push(0);
    X = words(blk, 0);
    for (k = 0; k < 4; k++) Y[k] ^= X[k];
    Y = ghashMul(Y, H);
  }
  return Y;
}
function padTo16(a) { var r = a.slice(); while (r.length % 16) r.push(0); return r; }
function lenBlock(abits, cbits) {
  function be(n) { var hi = Math.floor(n / 4294967296), lo = n >>> 0; return [(hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255]; }
  return be(abits).concat(be(cbits));
}
function wordsToBytes(w) { var o = [], i; for (i = 0; i < 4; i++) o.push((w[i] >>> 24) & 255, (w[i] >>> 16) & 255, (w[i] >>> 8) & 255, w[i] & 255); return o; }
function inc32(cb) { var c = cb.slice(), i = 15; while (i >= 12) { c[i] = (c[i] + 1) & 255; if (c[i] !== 0) break; i--; } return c; }
// Başarılıysa düz metin baytlarını, etiket uyuşmazsa null döndürür
function gcmDecrypt(key, iv, aad, ct, tag) {
  var rk = aesExpand(key), H = words(aesBlock(rk, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), 0), j0, i, k, ctr, ks, out = [];
  if (iv.length === 12) j0 = iv.concat([0, 0, 0, 1]);
  else j0 = wordsToBytes(ghash(H, padTo16(iv).concat(lenBlock(0, iv.length * 8))));
  var gh = ghash(H, padTo16(aad).concat(padTo16(ct)).concat(lenBlock(aad.length * 8, ct.length * 8)));
  var ek = aesBlock(rk, j0), gb = wordsToBytes(gh), t = [];
  for (i = 0; i < 16; i++) t.push(gb[i] ^ ek[i]);
  var ok = tag.length > 0 && tag.length <= 16;
  for (i = 0; i < tag.length && i < 16; i++) if (t[i] !== tag[i]) ok = false;
  if (!ok) return null;
  ctr = inc32(j0);
  for (i = 0; i < ct.length; i += 16) {
    ks = aesBlock(rk, ctr);
    for (k = 0; k < 16 && i + k < ct.length; k++) out.push(ct[i + k] ^ ks[k]);
    ctr = inc32(ctr);
  }
  return out;
}

// ---------------- Genel yardımcılar ----------------
function withTimeout(promise, ms) {
  if (typeof setTimeout !== 'function') return promise;
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
    promise.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
  });
}
function rawReq(method, url, headers, body, label, tmo) {
  tmo = tmo || AYAR.ISTEK_SURESI;
  var opt = { method: method, headers: headers || {} };
  if (body != null) opt.body = body;
  return withTimeout(fetch(url, opt), tmo).then(function (res) {
    return withTimeout(res.text(), tmo).then(
      function (t) { return { status: res.status, text: t || '', url: res.url || url }; },
      function () { return { status: res.status, text: '', url: res.url || url }; }
    );
  }).catch(function (e) {
    return { status: 0, text: '', err: (e && e.message) || 'hata', url: url };
  }).then(function (r) {
    if (label) note(label + ' ' + (r.status || r.err || '?') + '/' + r.text.length);
    return r;
  });
}
function getJson(url) { return withTimeout(fetch(url), 10000).then(function (res) { return res.json(); }); }
function uniq(list) { var out = []; list.forEach(function (x) { if (x !== undefined && x !== null && x !== '' && out.indexOf(x) === -1) out.push(x); }); return out; }
var TR_MAP = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u' };
function norm(s) {
  return String(s || '').replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase().replace(/[çğıöşüâîû]/g, function (c) { return TR_MAP[c]; }).replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}
function formEnc(pairs) {
  return pairs.map(function (p) { return encodeURIComponent(p[0]) + '=' + encodeURIComponent(p[1]); }).join('&');
}
function debugStream(msg) {
  if (!AYAR.DEBUG_MODU) return [];
  return [msg].concat(dbg.slice(0, 40)).map(function (r) {
    return { name: 'DEBUG ' + r, title: 'DEBUG ' + r, url: 'https://debug.invalid/', quality: 'Auto', provider: PROVIDER_ID };
  });
}

// ---------------- İmzalı API istekleri ----------------
function baseHeaders(ts, nonce, sig) {
  var h = {
    'Accept': 'application/json',
    'packagename': PKG,
    'User-Agent': API_UA,
    'X-App-Id': APP_ID,
    'X-Platform': 'android',
    'X-Device-Id': AUTH.device,
    'signature': CERT_HEX,
    'hash256': HASH256,
    'X-Encrypt-Response': '1',
    'X-Timestamp': ts,
    'X-Nonce': nonce,
    'X-Signature': 'sha256=' + sig
  };
  return h;
}
function signFor(method, apiPath, ts, nonce, body) {
  var canon = method + '\n' + apiPath + '\n' + ts + '\n' + nonce + '\n' + toHex(sha256(utf8Bytes(body)));
  return toHex(hmac256(utf8Bytes(SIGN_KEY), utf8Bytes(canon)));
}
function apiPathOf(url) {
  var p = String(url).split('?')[0], i = p.indexOf('/api/');
  return i >= 0 ? p.slice(i) : p.replace(/^https?:\/\/[^\/]+/, '');
}

// Şifreli yanıtı çöz. Anahtar iletisinin alanları (kimlik|nonce|zaman) için birkaç
// olası sıra denenir; GCM etiketi doğru sırayı kendiliğinden doğrular.
function decryptEnvelope(env, ctx) {
  var iv = b64decode(env.iv), tag = b64decode(env.tag), aad = b64decode(env.aad || ''), ct = b64decode(env.ciphertext);
  var extra = [];
  Object.keys(env).forEach(function (k) { if (typeof env[k] === 'string' && ['iv', 'tag', 'aad', 'ciphertext'].indexOf(k) < 0) extra.push(env[k]); });
  var ids = uniq([ctx.session, ctx.device, ''].concat(extra));
  ids.push('');
  var pairs = [[ctx.nonce, ctx.ts], [ctx.ts, ctx.nonce]];
  extra.forEach(function (e) { pairs.push([e, ctx.ts]); pairs.push([ctx.nonce, e]); pairs.push([ctx.ts, e]); });
  var tried = {}, i, j, msg, key, plain;
  for (i = 0; i < ids.length; i++) {
    for (j = 0; j < pairs.length; j++) {
      msg = 'easyplex-response-v1|' + ids[i] + '|' + pairs[j][0] + '|' + pairs[j][1];
      if (tried[msg]) continue; tried[msg] = 1;
      key = hmac256(utf8Bytes(RESP_KEY), utf8Bytes(msg));
      plain = gcmDecrypt(key, iv, aad, ct, tag);
      if (plain) return utf8Decode(plain);
    }
  }
  return null;
}
function openBody(text, ctx) {
  var t = String(text || '');
  if (!t) return null;
  var obj;
  try { obj = JSON.parse(t); } catch (e) { note('json hata'); return null; }
  if (obj && obj.encrypted === true && obj.ciphertext) {
    var dec = decryptEnvelope(obj, ctx);
    if (dec === null) { note('sifre cozulemedi'); return null; }
    try { return JSON.parse(dec); } catch (e2) { note('cozulen json hata'); return null; }
  }
  return obj;
}

function login() {
  if (!AUTH.device) AUTH.device = 'uuid_' + newUuid();
  if (AUTH.jwt && Date.now() < AUTH.exp) return Promise.resolve(true);
  var ts = String(Math.floor(Date.now() / 1000)), nonce = b64urlNoPad(randBytes(24)), bodyNonce = b64urlNoPad(randBytes(24));
  var body = formEnc([['signature', HASH256], ['package_name', PKG], ['device_id', AUTH.device], ['nonce', bodyNonce], ['timestamp', ts], ['app_version', APP_VER], ['app_id', APP_ID], ['platform', 'android']]);
  var sig = signFor('POST', '/api/tokens/mobile/generate', ts, nonce, body);
  var h = baseHeaders(ts, nonce, sig);
  h['Content-Type'] = 'application/x-www-form-urlencoded';
  return rawReq('POST', AYAR.SITE + '/public/api/tokens/mobile/generate', h, body, 'L').then(function (r) {
    var o = openBody(r.text, { session: '', device: AUTH.device, nonce: nonce, ts: ts });
    if (o && o.access_token) {
      AUTH.jwt = o.access_token; AUTH.session = o.session_id || '';
      AUTH.exp = Date.now() + Math.max(60, (parseInt(o.expires_in, 10) || 600) - 30) * 1000;
      note('giris tamam');
      return true;
    }
    note('giris basarisiz');
    return false;
  });
}

// path: "/search/xx/KEY" ya da "/public/api/..." ya da tam adres
function apiGet(path) {
  return login().then(function (ok) {
    if (!ok) return null;
    var url;
    if (/^https?:/i.test(path)) url = path;
    else if (path.indexOf('/public/api/') === 0) url = AYAR.SITE + path;
    else if (path.indexOf('/api/') === 0) url = AYAR.SITE + '/public' + path;
    else url = AYAR.SITE + '/public/api/' + path.replace(/^\//, '');
    var ts = String(Math.floor(Date.now() / 1000)), nonce = b64urlNoPad(randBytes(24));
    var sig = signFor('GET', apiPathOf(url), ts, nonce, '');
    var h = baseHeaders(ts, nonce, sig);
    if (AUTH.session) h['X-Session-Id'] = AUTH.session;
    if (AUTH.jwt) h['Authorization'] = 'Bearer ' + AUTH.jwt;
    return rawReq('GET', url, h, null, 'A').then(function (r) {
      if (r.status === 401 || r.status === 403) { AUTH.jwt = ''; note('yetki ' + r.status); return null; }
      return openBody(r.text, { session: AUTH.session, device: AUTH.device, nonce: nonce, ts: ts });
    });
  });
}

// ---------------- Arama ve eşleştirme ----------------
function itemsOf(o) {
  var out = [];
  function take(a) { if (Array.isArray(a)) a.forEach(function (x) { if (x && typeof x === 'object' && x.id !== undefined) out.push(x); }); }
  if (Array.isArray(o)) take(o);
  else if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { take(o[k]); });
  return out;
}
function yearOf(it) { return parseInt(String(it.release_date || it.first_air_date || '').slice(0, 4), 10) || 0; }
function isSerie(it) { return /^(serie|series|anime|tv)$/i.test(String(it.type || '')) || /serie|anime/i.test(String(it.media_type || '')); }

function pickItem(items, titles, year, isTv) {
  var want = titles.map(norm).filter(Boolean), best = null, bestScore = 0;
  items.forEach(function (it) {
    var names = [it.name, it.title, it.original_name, it.original_title].map(norm).filter(Boolean), s = 0;
    var exact = names.some(function (n) { return want.indexOf(n) >= 0; });
    var part = !exact && names.some(function (n) { return want.some(function (w) { return w.length > 3 && (n.indexOf(w) >= 0 || w.indexOf(n) >= 0); }); });
    if (exact) s += 10; else if (part) s += 3;
    var y = yearOf(it);
    if (year && y) { if (y === year) s += 4; else if (Math.abs(y - year) <= 1) s += 2; else if (!isTv) s -= 3; }
    var ser = isSerie(it);
    if (isTv === ser) s += 2; else if (it.type) s -= 6;
    if (s > bestScore) { bestScore = s; best = it; }
  });
  return bestScore >= 6 ? best : null;
}

function findItem(titles, year, isTv) {
  var qs = uniq(titles.map(function (t) { return String(t || '').trim(); })).slice(0, 3);
  function one(i) {
    if (i >= qs.length) return Promise.resolve(null);
    var q = encodeURIComponent(qs[i]).replace(/\+/g, '%20');
    return apiGet('/public/api/search/' + q + '/' + API_KEY).then(function (o) {
      var items = itemsOf(o);
      note('ara "' + qs[i].slice(0, 18) + '" ' + items.length);
      var it = pickItem(items, titles, year, isTv);
      return it || one(i + 1);
    });
  }
  return one(0);
}

// ---------------- Detay ve bağlantılar ----------------
function loadDetail(it, isTv) {
  var id = it.id;
  var first = (isTv || isSerie(it)) ? '/public/api/series/show/' : '/public/api/media/detail/';
  var second = first.indexOf('series') > 0 ? '/public/api/media/detail/' : '/public/api/series/show/';
  return apiGet(first + id + '/' + API_KEY).then(function (o) {
    if (o && (o.videos || o.seasons || o.name || o.title)) return o;
    return apiGet(second + id + '/' + API_KEY);
  });
}
function linksOf(videos) {
  var out = [];
  (videos || []).forEach(function (v) {
    if (!v) return;
    String((typeof v === 'string') ? v : (v.link || '')).split('|||').forEach(function (u) { u = u.trim(); if (u) out.push({ url: u, server: (v && v.server) || '' }); });
  });
  return out;
}
function collectLinks(detail, isTv, season, episode) {
  var out = [];
  if (!detail) return out;
  if (isTv) {
    (detail.seasons || []).forEach(function (s) {
      if (parseInt(s.season_number, 10) !== season) return;
      (s.episodes || []).forEach(function (e) {
        if (parseInt(e.episode_number, 10) === episode) out = out.concat(linksOf(e.videos));
      });
    });
  } else {
    out = linksOf(detail.videos);
    if (detail.direct_link) out.push({ url: String(detail.direct_link), server: '' });
  }
  var seen = {};
  return out.filter(function (l) { if (seen[l.url]) return false; seen[l.url] = 1; return true; });
}

// ---------------- Bağlantıyı oynatılabilir adrese çevir ----------------
function qualityOf(s) { var m = String(s).match(/(2160|1440|1080|720|480|360)/); return m ? m[1] + 'p' : 'Auto'; }

function resolveLink(l) {
  var u = l.url;
  if (/mediafire\.com/i.test(u)) {
    return rawReq('GET', u, { 'User-Agent': WEB_UA }, null, 'MF', 10000).then(function (r) {
      var m = r.text.match(/href=["'](https:\/\/download[^"']+)["']/i);
      if (!m) { var sc = r.text.match(/data-scrambled-url=["']([^"']+)["']/i); if (sc) m = [0, utf8Decode(b64decode(sc[1]))]; }
      if (!m) { note('mediafire link yok'); return null; }
      return { url: m[1].replace(/&amp;/g, '&'), type: 'mp4', headers: { 'User-Agent': WEB_UA } };
    });
  }
  var g = u.match(/drive\.google\.com\/file\/d\/([^\/?#]+)/i) || u.match(/drive\.google\.com\/open\?id=([^&#]+)/i);
  if (g) return Promise.resolve({ url: 'https://drive.usercontent.google.com/download?id=' + g[1] + '&export=download&confirm=t', type: 'mp4', headers: { 'User-Agent': WEB_UA } });
  if (/\.m3u8(\?|$)/i.test(u)) return Promise.resolve({ url: u, type: 'hls', headers: { 'User-Agent': WEB_UA } });
  if (/\.(mp4|mkv|webm)(\?|$)/i.test(u)) return Promise.resolve({ url: u, type: 'mp4', headers: { 'User-Agent': WEB_UA } });
  note('desteklenmeyen ' + u.replace(/^https?:\/\//, '').slice(0, 30));
  return Promise.resolve(null);
}

// ---------------- Ana akış ----------------
function getStreamsInner(tmdbId, mediaType, season, episode, holder) {
  var isTv = (mediaType === 'tv' || mediaType === 'series');
  dbg = ['v1.0.0'];
  season = parseInt(season, 10) || 1; episode = parseInt(episode, 10) || 1;
  var base = 'https://api.themoviedb.org/3/' + (isTv ? 'tv' : 'movie') + '/' + tmdbId + '?api_key=' + TMDB_KEY;
  return Promise.all([getJson(base + '&language=tr-TR'), getJson(base + '&language=en-US').catch(function () { return {}; })]).then(function (both) {
    var tr = both[0] || {}, en = both[1] || {};
    var titles = uniq([tr.title || tr.name, en.title || en.name, tr.original_title || tr.original_name]);
    var year = parseInt((tr.release_date || tr.first_air_date || '').slice(0, 4), 10) || 0;
    if (!titles.length) return debugStream('TMDB bilgisi eksik');
    note((isTv ? 'dizi ' : 'film ') + titles[0] + ' ' + year);
    return findItem(titles, year, isTv).then(function (it) {
      if (!it) return debugStream('sitede bulunamadi');
      note('bulundu #' + it.id + ' ' + String(it.name || it.title || '').slice(0, 30));
      return loadDetail(it, isTv).then(function (detail) {
        var links = collectLinks(detail, isTv, season, episode);
        note('baglanti ' + links.length);
        if (!links.length) return debugStream(isTv ? 'bolum baglantisi yok' : 'film baglantisi yok');
        return Promise.all(links.slice(0, 8).map(function (l) { return resolveLink(l).catch(function () { return null; }).then(function (r) { return r ? { l: l, r: r } : null; }); })).then(function (rs) {
          var n = 0;
          rs.forEach(function (x) {
            if (!x || n >= AYAR.MAKS_AKIS) return;
            var q = qualityOf(x.l.url + ' ' + x.l.server);
            holder.streams.push({
              name: AYAR.EKLENTI_ADI + (x.l.server ? ' - ' + x.l.server : '') + (n > 0 ? ' #' + (n + 1) : ''),
              title: AYAR.EKLENTI_ADI + ' | TR' + (q !== 'Auto' ? ' | ' + q : ''),
              url: x.r.url, quality: q, headers: x.r.headers, type: x.r.type, provider: PROVIDER_ID
            });
            n++;
          });
          return holder.streams.length ? holder.streams : debugStream('kaynak cikmadi');
        });
      });
    });
  }).catch(function (e) { return holder.streams.length ? holder.streams : debugStream('hata ' + (e && e.message)); });
}

// ================= SkyStream katmanı =================
var TMDB = 'https://api.themoviedb.org/3';
var IMG = 'https://image.tmdb.org/t/p/';

function done(cb, data) { try { cb({ success: true, data: data }); } catch (e) {} }
function fail(cb, msg) { try { cb({ success: false, errorCode: 'PLUGIN_ERROR', message: String(msg || 'hata') }); } catch (e) {} }

function tmdbUrl(path, extra) {
  return TMDB + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'api_key=' + TMDB_KEY + '&language=tr-TR' + (extra || '');
}
function mk(cls, obj) {
  try { if (typeof cls === 'function') return new cls(obj); } catch (e) {}
  return obj;
}
function itemOf(r, forcedType) {
  var type = forcedType || (r.media_type === 'tv' || (!r.media_type && r.first_air_date) ? 'tv' : 'movie');
  var isTv = type === 'tv';
  var date = r.release_date || r.first_air_date || '';
  return mk(typeof MultimediaItem !== 'undefined' ? MultimediaItem : null, {
    title: r.title || r.name || r.original_title || r.original_name || '?',
    url: (isTv ? 'tv:' : 'movie:') + r.id,
    posterUrl: r.poster_path ? IMG + 'w500' + r.poster_path : '',
    bannerUrl: r.backdrop_path ? IMG + 'w1280' + r.backdrop_path : '',
    type: isTv ? 'series' : 'movie',
    year: parseInt(date.slice(0, 4), 10) || undefined,
    score: r.vote_average ? Math.round(r.vote_average * 10) / 10 : undefined,
    description: r.overview || ''
  });
}
function listOf(o, forcedType) {
  return ((o && o.results) || []).filter(function (r) { return r && r.id && r.media_type !== 'person' && (r.poster_path || r.backdrop_path); })
    .map(function (r) { return itemOf(r, forcedType); });
}

var HOME_ROWS = [
  ['Haftanın Trend Filmleri', '/trending/movie/week', 'movie', ''],
  ['Haftanın Trend Dizileri', '/trending/tv/week', 'tv', ''],
  ['Popüler Filmler', '/movie/popular', 'movie', ''],
  ['Popüler Diziler', '/tv/popular', 'tv', ''],
  ['Türk Dizileri', '/discover/tv', 'tv', '&with_original_language=tr&sort_by=popularity.desc'],
  ['Türk Filmleri', '/discover/movie', 'movie', '&with_original_language=tr&sort_by=popularity.desc'],
  ['En Çok Oy Alan Filmler', '/movie/top_rated', 'movie', ''],
  ['En Çok Oy Alan Diziler', '/tv/top_rated', 'tv', '']
];

function getHome(cb) {
  Promise.all(HOME_ROWS.map(function (r) {
    return getJson(tmdbUrl(r[1], r[3])).then(function (o) { return listOf(o, r[2]); }).catch(function () { return []; });
  })).then(function (rows) {
    var out = {};
    HOME_ROWS.forEach(function (r, i) { if (rows[i].length) out[r[0]] = rows[i]; });
    if (!Object.keys(out).length) return fail(cb, 'TMDB katalogu alinamadi');
    done(cb, out);
  }).catch(function (e) { fail(cb, e && e.message); });
}

function search(query, page, cb) {
  if (typeof page === 'function') { cb = page; page = 1; }
  var q = encodeURIComponent(String(query || '').trim());
  if (!q) return done(cb, []);
  getJson(tmdbUrl('/search/multi', '&include_adult=false&page=' + (page || 1) + '&query=' + q))
    .then(function (o) { done(cb, listOf(o)); })
    .catch(function (e) { fail(cb, e && e.message); });
}

function load(url, cb) {
  var m = String(url || '').match(/^(movie|tv):(\d+)/);
  if (!m) return fail(cb, 'gecersiz url');
  var isTv = m[1] === 'tv', id = m[2];
  getJson(tmdbUrl('/' + m[1] + '/' + id, '&append_to_response=credits,external_ids')).then(function (d) {
    var item = itemOf(d, m[1]);
    item.url = m[1] + ':' + id;
    var cast = ((d.credits && d.credits.cast) || []).slice(0, 12).map(function (c) {
      return mk(typeof Actor !== 'undefined' ? Actor : null, { name: c.name, role: c.character || '', image: c.profile_path ? IMG + 'w185' + c.profile_path : '' });
    });
    item.actors = cast;
    item.genres = (d.genres || []).map(function (g) { return g.name; });
    if (d.runtime) item.duration = d.runtime;
    if (!isTv) { item.episodes = [mk(typeof Episode !== 'undefined' ? Episode : null, { name: item.title, url: 'movie:' + id, season: 1, episode: 1, posterUrl: item.posterUrl })]; return done(cb, item); }
    var seasons = (d.seasons || []).filter(function (s) { return s.season_number > 0; }).slice(0, 30);
    return Promise.all(seasons.map(function (s) {
      return getJson(tmdbUrl('/tv/' + id + '/season/' + s.season_number)).catch(function () { return { episodes: [] }; });
    })).then(function (ss) {
      var eps = [];
      ss.forEach(function (sd, i) {
        (sd.episodes || []).forEach(function (e) {
          eps.push(mk(typeof Episode !== 'undefined' ? Episode : null, {
            name: 'S' + (seasons[i].season_number < 10 ? '0' : '') + seasons[i].season_number + 'E' + (e.episode_number < 10 ? '0' : '') + e.episode_number + (e.name ? ' - ' + e.name : ''),
            url: 'episode:' + id + ':' + seasons[i].season_number + ':' + e.episode_number,
            season: seasons[i].season_number, episode: e.episode_number,
            posterUrl: e.still_path ? IMG + 'w300' + e.still_path : '', description: e.overview || ''
          }));
        });
      });
      item.episodes = eps;
      done(cb, item);
    });
  }).catch(function (e) { fail(cb, e && e.message); });
}

function loadStreams(url, cb) {
  var u = String(url || ''), mt, id, s = 1, e = 1, m;
  if ((m = u.match(/^episode:(\d+):(\d+):(\d+)/))) { mt = 'tv'; id = m[1]; s = +m[2]; e = +m[3]; }
  else if ((m = u.match(/^(movie|tv):(\d+)/))) { mt = m[1]; id = m[2]; }
  else return fail(cb, 'gecersiz url');
  var holder = { streams: [] }, finished = false;
  function finish(list) {
    if (finished) return; finished = true;
    done(cb, (list || []).map(function (x) {
      var label = x.name + (x.title && x.title !== x.name ? ' | ' + x.title.replace(AYAR.EKLENTI_ADI + ' | ', '') : '');
      return mk(typeof StreamResult !== 'undefined' ? StreamResult : null, { url: x.url, source: label, headers: x.headers || {} });
    }));
  }
  if (typeof setTimeout === 'function') setTimeout(function () { finish(holder.streams); }, AYAR.GENEL_SURE);
  getStreamsInner(id, mt, s, e, holder).then(finish, function () { finish(holder.streams); });
}

globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;

})();
