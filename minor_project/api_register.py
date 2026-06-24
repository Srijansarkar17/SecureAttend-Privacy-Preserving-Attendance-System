import cv2
import numpy as np
from insightface.app import FaceAnalysis
import os
import json
import subprocess
import sys

if len(sys.argv) < 3:
    print("Usage: api_register.py <name> <image_path>")
    sys.exit(1)

name = sys.argv[1]
image_path = sys.argv[2]

# ── Init ArcFace ─────────────────────────────────────────────
print("Loading ArcFace model...", file=sys.stderr)
app = FaceAnalysis(name="buffalo_l", providers=['CPUExecutionProvider'])
app.prepare(ctx_id=0)
print("Model loaded.", file=sys.stderr)

# ── Process Image ───────────────────────────────────────────
img = cv2.imread(image_path)
if img is None:
    print(json.dumps({"error": "Could not read image"}))
    sys.exit(1)

faces = app.get(img)
if len(faces) == 0:
    print(json.dumps({"error": "No face detected"}))
    sys.exit(1)

if len(faces) > 1:
    print(f"WARNING: {len(faces)} faces detected, using the largest one", file=sys.stderr)
    faces = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]), reverse=True)

emb = faces[0].embedding
emb = emb / np.linalg.norm(emb)

print(f"Embedding extracted: {emb.shape} dims, norm={np.linalg.norm(emb):.4f}", file=sys.stderr)

# ── Send to C++ Security Layer ───────────────────────────────
embedding_str = ",".join(map(str, emb.tolist()))
cpp_binary = "../security_layer/security_layer"

print(f"Calling C++ security layer for Poseidon commitment...", file=sys.stderr)
result = subprocess.run(
    [cpp_binary, "0", embedding_str],
    capture_output=True,
    text=True
)

if result.returncode != 0:
    print(f"C++ error: {result.stderr}", file=sys.stderr)
    print(json.dumps({"error": f"Security layer failed: {result.stderr}"}))
    sys.exit(1)

response = json.loads(result.stdout.strip())
public_hash = response["public_hash"]

print(f"Poseidon commitment generated: {public_hash[:20]}...", file=sys.stderr)

# ── Also save locally as backup ──────────────────────────────
DB_FILE = "face_db.json"
face_db = {}
if os.path.exists(DB_FILE):
    with open(DB_FILE, "r") as f:
        face_db = json.load(f)

face_db[name] = public_hash

if not os.path.exists("embeddings"):
    os.makedirs("embeddings")
np.save(f"embeddings/{name}.npy", emb)

with open(DB_FILE, "w") as f:
    json.dump(face_db, f, indent=2)

# ── Output JSON with embedding for Supabase storage ─────────
# This is the key change: we include the embedding array in the output
# so server.py can store it in Supabase instead of relying on .npy files
output = {
    "status": "success",
    "public_hash": public_hash,
    "embedding": emb.tolist(),
}

print(json.dumps(output))
