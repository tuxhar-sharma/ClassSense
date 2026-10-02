import base64
import json
import os
from functools import lru_cache
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import settings

PREFIX = "aes256gcm:v1:"
CONTEXT = b"classsense:face-embedding:v1"


@lru_cache(maxsize=1)
def cipher():
    path = Path(settings.BIOMETRIC_KEY_FILE)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        pass
    else:
        with os.fdopen(descriptor, "wb") as file:
            file.write(AESGCM.generate_key(bit_length=256))
    key = path.read_bytes()
    if len(key) != 32:
        raise RuntimeError("Biometric key must contain exactly 32 bytes; restore the original key.")
    return AESGCM(key)


def encrypt_embedding(value):
    nonce = os.urandom(12)
    data = json.dumps(value, separators=(",", ":")).encode("utf-8")
    encrypted = cipher().encrypt(nonce, data, CONTEXT)
    return PREFIX + base64.b64encode(nonce + encrypted).decode("ascii")


def decrypt_embedding(value):
    if not value.startswith(PREFIX):
        return json.loads(value)  # Read legacy data during migration.
    raw = base64.b64decode(value[len(PREFIX):], validate=True)
    return json.loads(cipher().decrypt(raw[:12], raw[12:], CONTEXT))
