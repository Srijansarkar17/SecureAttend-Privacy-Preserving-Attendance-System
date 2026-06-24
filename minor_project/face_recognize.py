import cv2
import numpy as np
from insightface.app import FaceAnalysis
import os
import json
import subprocess

# ── Init ArcFace ─────────────────────────────────────────────
print("Loading ArcFace model...")
app = FaceAnalysis(name="buffalo_l")
app.prepare(ctx_id=0)
print("Model loaded.")

# ── Load Database ────────────────────────────────────────────
DB_FILE = "face_db.json"

if not os.path.exists(DB_FILE):
    print("No database found. Run register first.")
    exit()

with open(DB_FILE, "r") as f:
    face_db = json.load(f)

if len(face_db) == 0:
    print("No registered users.")
    exit()

print(f"Registered users: {list(face_db.keys())}")

cpp_binary = "../security_layer/security_layer"

# ── Camera Setup ─────────────────────────────────────────────
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

print("\nRecognition running... Press ESC to quit.\n")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    faces = app.get(frame)

    for face in faces:
        emb = face.embedding
        emb = emb / np.linalg.norm(emb)
        
        name = "Unknown"
        color = (0, 0, 255)

        # ── Fast Coarse Matching (Python) ────────────────
        for user, stored_commitment in face_db.items():
            template_path = f"embeddings/{user}.npy"
            if not os.path.exists(template_path):
                continue
            
            stored_emb = np.load(template_path)
            # Simple dot product for normalized vectors (cosine similarity)
            similarity = np.dot(emb, stored_emb)
            
            if similarity > 0.4: # Only attempt ZK for potential matches
                print(f"Potential match: {user} (Sim: {similarity:.2f}). Generating ZK Proof...")
                
                # ── ZK Proving Phase (Mode 1) ────────────────
                live_emb_str = ",".join(map(str, emb.tolist()))
                stored_emb_str = ",".join(map(str, stored_emb.tolist()))
                
                # Threshold for squared euclidean distance (quantized)
                # For ArcFace, dist < 1.0 is usually safe.
                # In quantized space, we scale accordingly.
                threshold = "100000000" # Tuned threshold
                
                result = subprocess.run(
                    [cpp_binary, "1", live_emb_str, stored_emb_str, threshold, stored_commitment],
                    capture_output=True,
                    text=True
                )
                
                if result.returncode == 0:
                    # ── ZK Verification Phase (Mode 2) ──────────
                    verify_result = subprocess.run(
                        [cpp_binary, "2"],
                        capture_output=True,
                        text=True
                    )
                    
                    if verify_result.returncode == 0:
                        v_response = json.loads(verify_result.stdout.strip())
                        if v_response.get("verified"):
                            name = user
                            color = (0, 255, 0)
                            print(f"✅ ZK-Verified: {user}")
                            break
                else:
                    print(f"ZK Proving failed for {user}: {result.stderr}")

        box = face.bbox.astype(int)
        cv2.rectangle(frame, (box[0], box[1]),
                      (box[2], box[3]), color, 2)
        cv2.putText(frame, name, (box[0], box[1] - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, color, 2)

    cv2.imshow("SecureAttend", frame)

    if cv2.waitKey(1) == 27:
        break

cap.release()
cv2.destroyAllWindows()