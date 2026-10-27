const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { create, blobSha, validate } = require("../catalog-publisher.js");

const sha = "a".repeat(40);
const nextSha = "b".repeat(40);
const original = [{ id: "krem", name: "Żółty krem", price: "15,99", stock: 0, image: "", description: "Do skóry" }];
const updated = [{ ...original[0], name: "Nowy krem", stock: 5, image: "data:image/jpeg;base64," + "A".repeat(100000) }];
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const file = (products, version = sha) => ({
  sha: version, encoding: "base64", content: Buffer.from(JSON.stringify(products)).toString("base64")
});

test("sends Polish text, photos, order and zero stock using a compare-and-swap update", async () => {
  const calls = [];
  const publisher = create({ fetch: async (url, options) => {
    calls.push({ url, options });
    if (options.method === "PUT") return response({ content: { sha: nextSha }, commit: { html_url: "https://github.com/test/commit/1" } });
    return response(file(original));
  } });
  const result = await publisher.publish(updated, sha, "test-token");
  const write = calls.find(({ options }) => options.method === "PUT");
  const body = JSON.parse(write.options.body);
  assert.deepEqual(JSON.parse(Buffer.from(body.content, "base64").toString("utf8")), updated);
  assert.equal(body.sha, sha);
  assert.equal(body.branch, "main");
  assert.equal(write.options.headers.Authorization, "Bearer test-token");
  assert.equal(write.options.credentials, "omit");
  assert.equal(write.options.redirect, "error");
  assert.equal(result.sha, nextSha);
  assert.match(write.url, /^https:\/\/api\.github\.com\/repos\/DD-Systems\/sklep-app\/contents\/products\.json$/);
});

test("rejects stale data from another device without writing", async () => {
  let writes = 0;
  const publisher = create({ fetch: async (_url, options) => {
    if (options.method === "PUT") writes++;
    return response(file([{ ...original[0], stock: 1 }], nextSha));
  } });
  await assert.rejects(publisher.publish(updated, sha, "test-token"), /innym urządzeniu/);
  assert.equal(writes, 0);
});

test("does not retry an atomic update conflict", async () => {
  let writes = 0;
  const publisher = create({ fetch: async (_url, options) => {
    if (options.method === "PUT") { writes++; return response({}, 409); }
    return response(file(original));
  } });
  await assert.rejects(publisher.publish(updated, sha, "test-token"), /innym urządzeniu/);
  assert.equal(writes, 1);
});

test("requires authentication and a loaded revision", async () => {
  const publisher = create({ fetch: async () => { throw new Error("must not call"); } });
  await assert.rejects(publisher.publish(updated, sha, ""), /Połącz GitHub/);
  await assert.rejects(publisher.publish(updated, "", "test-token"), /wczytaj katalog/);
});

test("expired tokens report a useful error without leaking credentials", async () => {
  const publisher = create({ fetch: async () => response({}, 401) });
  await assert.rejects(publisher.connect("private-test-token"), (error) =>
    /wygasł/.test(error.message) && !error.message.includes("private-test-token"));
});

test("connection rejects read-only accounts", async () => {
  const publisher = create({ fetch: async () => response({ permissions: { push: false } }) });
  await assert.rejects(publisher.connect("test-token"), /nie ma prawa/);
});

test("large catalogs use the blob endpoint when the contents API omits inline data", async () => {
  const calls = [];
  const publisher = create({ fetch: async (url) => {
    calls.push(url);
    return response(url.includes("/git/blobs/") ? file(updated) : { sha, encoding: "none", content: "" });
  } });
  assert.deepEqual((await publisher.readCatalog()).products, updated);
  assert.match(calls[1], new RegExp("/git/blobs/" + sha + "$"));
});

test("recognizes a successful write when the response was lost", async () => {
  let committed = false;
  let writes = 0;
  const publisher = create({ fetch: async (_url, options) => {
    if (options.method === "PUT") { writes++; committed = true; throw new Error("connection lost"); }
    return response(file(committed ? updated : original, committed ? nextSha : sha));
  } });
  assert.equal((await publisher.publish(updated, sha, "test-token")).sha, nextSha);
  assert.equal(writes, 1);
});

test("network errors preserve the caller's catalog for retry", async () => {
  const before = structuredClone(updated);
  const publisher = create({ fetch: async (_url, options) => {
    if (options.method === "PUT") throw new Error("offline");
    return response(file(original));
  } });
  await assert.rejects(publisher.publish(updated, sha, "test-token"), /Zachowano zmiany/);
  assert.deepEqual(updated, before);
});

test("an already-published draft does not create another commit", async () => {
  let writes = 0;
  const publisher = create({ fetch: async (_url, options) => {
    if (options.method === "PUT") writes++;
    return response(file(updated, nextSha));
  } });
  assert.equal((await publisher.publish(updated, sha, "test-token")).unchanged, true);
  assert.equal(writes, 0);
});

test("validates catalog limits, duplicate IDs and inventory", () => {
  assert.doesNotThrow(() => validate(original));
  assert.throws(() => validate([...original, ...original]), /unikalny/);
  assert.throws(() => validate(Array(31).fill(original[0])), /30/);
  assert.throws(() => validate([{ ...original[0], stock: -1 }]), /sztuk/);
  assert.throws(() => validate([{ ...original[0], price: "15zł" }]), /cenę/);
});

test("fallback hashes the exact Git blob bytes, including UTF-8 BOM", async () => {
  const bytes = Buffer.from("\uFEFF" + JSON.stringify(original));
  const expected = createHash("sha1").update(Buffer.from("blob " + bytes.length + "\0")).update(bytes).digest("hex");
  assert.equal(await blobSha(bytes), expected);
});
