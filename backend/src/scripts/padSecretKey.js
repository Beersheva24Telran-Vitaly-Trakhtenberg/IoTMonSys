function padSecretKey(baseKey, targetLength = 32) {
  const paddedKey = Buffer.alloc(targetLength);
  paddedKey.fill(baseKey, 0, targetLength);
  return paddedKey;
}