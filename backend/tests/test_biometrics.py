from app.database import VectorType
from app.services.biometrics import encrypt_embedding, decrypt_embedding, PREFIX


def test_embeddings_are_encrypted_and_roundtrip():
    embedding = [0.125, -0.25, 0.5]
    first = encrypt_embedding(embedding)
    second = encrypt_embedding(embedding)
    assert first.startswith(PREFIX)
    assert first != second
    assert "0.125" not in first
    assert decrypt_embedding(first) == embedding
    assert VectorType().process_bind_param(embedding, None).startswith(PREFIX)


def test_legacy_embeddings_can_be_migrated():
    assert decrypt_embedding('[0.1,0.2]') == [0.1, 0.2]
