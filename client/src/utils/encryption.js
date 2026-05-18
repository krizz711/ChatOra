import nacl from 'tweetnacl';
import { encodeUTF8, decodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

export const generateKeyPair = () => {
  const kp = nacl.box.keyPair();
  return { publicKey: encodeBase64(kp.publicKey), secretKey: encodeBase64(kp.secretKey) };
};

export const deriveSharedKey = (mySecretKeyB64, theirPublicKeyB64) => {
  const shared = nacl.box.before(decodeBase64(theirPublicKeyB64), decodeBase64(mySecretKeyB64));
  return encodeBase64(shared);
};

export const encryptMessage = (text, sharedKeyB64) => {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const message = decodeUTF8(text);
  const box = nacl.box.after(message, nonce, decodeBase64(sharedKeyB64));
  return { ciphertext: encodeBase64(box), nonce: encodeBase64(nonce) };
};

export const decryptMessage = (ciphertextB64, nonceB64, sharedKeyB64) => {
  try {
    const decrypted = nacl.box.open.after(decodeBase64(ciphertextB64), decodeBase64(nonceB64), decodeBase64(sharedKeyB64));
    if (!decrypted) return null;
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    return null;
  }
};
