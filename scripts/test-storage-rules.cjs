const assert = require("node:assert/strict");
const { test } = require("node:test");
const { initializeApp, deleteApp } = require("firebase/app");
const {
  connectStorageEmulator,
  deleteObject,
  getMetadata,
  getStorage,
  ref,
  uploadBytes,
} = require("firebase/storage");

const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
if (!host) throw new Error("Run this test through the Storage emulator; never against a live project.");
const separator = host.lastIndexOf(":");
if (separator < 0) throw new Error("Invalid FIREBASE_STORAGE_EMULATOR_HOST.");
const hostname = host.slice(0, separator);
const port = Number(host.slice(separator + 1));
if (!["localhost", "127.0.0.1", "::1"].includes(hostname) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("The Storage rules test requires a local emulator.");
}

function client(name, uid) {
  const app = initializeApp({
    projectId: "demo-kenetic-rules",
    apiKey: "emulator-only",
    storageBucket: "demo-kenetic-rules.appspot.com",
  }, name);
  const storage = getStorage(app);
  connectStorageEmulator(storage, hostname, port, uid ? { mockUserToken: { sub: uid, user_id: uid } } : undefined);
  return { app, storage };
}

test("Storage rules allow only the owner to access their files", async () => {
  const id = `storage-${Date.now()}`;
  const alice = client(`${id}-alice`, `${id}-alice`);
  const bob = client(`${id}-bob`, `${id}-bob`);
  const guest = client(`${id}-guest`);
  const objectPath = `users/${id}-alice/profile/test.txt`;
  const denied = async (promise) => assert.rejects(promise, (error) => error.code === "storage/unauthorized");
  try {
    const ownerFile = ref(alice.storage, objectPath);
    await uploadBytes(ownerFile, new TextEncoder().encode("test"));
    assert.equal((await getMetadata(ownerFile)).size, 4);
    await denied(getMetadata(ref(bob.storage, objectPath)));
    await denied(getMetadata(ref(guest.storage, objectPath)));
    await denied(uploadBytes(ref(bob.storage, objectPath), new TextEncoder().encode("other")));
    await denied(uploadBytes(ref(alice.storage, "public/test.txt"), new TextEncoder().encode("other")));
    await deleteObject(ownerFile);
  } finally {
    await Promise.all([alice, bob, guest].map(({ app }) => deleteApp(app)));
  }
});
