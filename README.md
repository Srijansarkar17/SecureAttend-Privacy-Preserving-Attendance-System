# SecureAttend

A biometric attendance system that uses **ZK-SNARKs (Groth16)** to verify face identity without exposing or storing raw face embeddings. Built for SRM Institute of Science and Technology.

---

## How It Works

Registration stores a **Poseidon hash commitment** of a student's face embedding — not the embedding itself. At check-in, a zero-knowledge proof is generated on-the-fly to prove that the live face matches the registered template within a distance threshold, without revealing either embedding to the server.

```
Register:  Face Photo → ArcFace (512-dim embedding) → C++ quantizer → Poseidon hash → Supabase
Recognize: Live Face  → ArcFace → C++ ZK prover (ZoKrates) → Groth16 proof → verify → mark attendance
```

The ZK circuit (`security_layer/face_verify.zok`) asserts two things:
1. The squared Euclidean distance between live and stored embeddings is below a threshold
2. The stored embedding hashes to the public commitment on record

Neither embedding appears in the proof output.

---

## Stack

| Layer | Tech |
|---|---|
| ZK Circuits | [ZoKrates](https://zokrates.github.io/) — Groth16 on BN128 |
| Hash | Poseidon (ZK-native, tree-structured over 128 dims) |
| Face AI | InsightFace / ArcFace `buffalo_l` (512-dim embeddings) |
| Security bridge | C++ binary (modes: commit / prove / verify) |
| Backend | FastAPI + Uvicorn |
| Database | Supabase (PostgreSQL + RLS) |
| Frontend | React 19 + Vite + Tailwind CSS + Framer Motion |

---

## Project Layout

```
.
├── minor_project/              # Python face AI scripts (ArcFace)
│   ├── api_register.py         # Called by backend: extract embedding → send to C++
│   ├── api_recognize.py        # Called by backend: compare → trigger ZK prover
│   ├── face_register.py        # Standalone local registration
│   ├── face_recognize.py       # Standalone local recognition
│   └── requirements.txt
│
├── security_layer/             # C++ ZK bridge + ZoKrates circuits
│   ├── face_verify.zok         # Main ZK circuit (distance + commitment check)
│   ├── poseidon_hash.zok       # Poseidon commitment circuit
│   ├── main.cpp                # CLI: mode 0 = commit, 1 = prove, 2 = verify
│   ├── proof.cpp / .h          # ZoKrates subprocess wrapper
│   ├── embedding_processor.*   # Float → quantized int conversion
│   ├── proving.key             # Groth16 proving key (trusted setup output)
│   ├── verification.key        # Groth16 verification key
│   └── zokrates                # ZoKrates binary (bundled)
│
├── secure_attend_backend/
│   └── server.py               # FastAPI: auth, register, recognize, attendance endpoints
│
├── secure_attend_frontend/
│   └── src/
│       ├── pages/
│       │   ├── Home.jsx
│       │   ├── Login.jsx
│       │   ├── TeacherDashboard.jsx
│       │   └── StudentDashboard.jsx
│       └── components / context / lib
│
├── supabase_setup.sql          # Full schema + RLS policies (run once)
└── supabase_users_fix.sql
```

---

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- clang++ / g++ with C++17
- A [Supabase](https://supabase.com) project

### 1. Database

Run `supabase_setup.sql` in your Supabase SQL editor. This creates all tables, indexes, RLS policies, and seeds four sample subjects.

### 2. Environment variables

**`secure_attend_backend/.env`**
```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<service-role-key>
```

**`secure_attend_frontend/.env`**
```env
VITE_API_URL=http://localhost:8000
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

### 3. Python dependencies

```bash
pip install fastapi uvicorn supabase python-dotenv numpy

cd minor_project
pip install -r requirements.txt   # opencv-python, insightface, numpy, onnxruntime
```

### 4. Frontend

```bash
cd secure_attend_frontend
npm install
```

### 5. C++ security layer

```bash
cd security_layer
clang++ -std=c++17 -O2 \
  main.cpp proof.cpp embedding_processor.cpp hash_utils.cpp nonce.cpp \
  -o security_layer
```

The `zokrates` binary, `proving.key`, and `verification.key` are pre-built and committed. No trusted setup ceremony needed to run the project.

---

## Running

```bash
# Backend (http://localhost:8000)
cd secure_attend_backend && python server.py

# Frontend (http://localhost:5173)
cd secure_attend_frontend && npm run dev
```

API docs available at `http://localhost:8000/docs`.

---

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/signup` | Create account (`@srmist.edu.in` only) |
| `POST` | `/api/auth/login` | Login |
| `POST` | `/api/register` | Register face — generates Poseidon commitment |
| `POST` | `/api/recognize` | Recognize face — runs ZK proof, marks attendance |
| `GET` | `/api/subjects` | List subjects |
| `GET` | `/api/attendance/{subject_id}` | Today's attendance for a subject |
| `GET` | `/api/attendance/all/{subject_id}` | Full attendance history |
| `GET` | `/api/student/attendance/{user_id}` | Student's own records |
| `GET` | `/api/registered-faces` | Registered commitments (no embeddings) |
| `GET` | `/api/health` | Health check |

---

## ZK Circuit

**`security_layer/face_verify.zok`**

```zokrates
import "hashes/poseidon/poseidon" as poseidon;

def main(
    private field[128] live_emb,
    private field[128] stored_emb,
    public field threshold,
    public field commitment
) {
    // Squared Euclidean distance
    field mut dist = 0;
    for u32 i in 0..128 {
        field diff = live_emb[i] - stored_emb[i];
        dist = dist + diff * diff;
    }
    assert(dist < threshold);

    // Poseidon tree hash: 128 → 32 → 8 → 2 → 1
    field[32] mut h1 = [0; 32];
    for u32 i in 0..32 {
        h1[i] = poseidon([stored_emb[i*4], stored_emb[i*4+1],
                          stored_emb[i*4+2], stored_emb[i*4+3]]);
    }
    // ... (layers 2 and 3 collapse to single root)
    assert(actual_commitment == commitment);
}
```

- Uses 128 of 512 ArcFace dimensions to keep the constraint count manageable
- Poseidon is used over SHA-256 because it is native to arithmetic circuits (~100× fewer constraints)
- Squared distance avoids an in-circuit square root
- Proof scheme: Groth16 on BN128 — constant-size proofs (~200 bytes), sub-second verification

### Recompiling circuits (if you modify `.zok` files)

```bash
cd security_layer

./zokrates compile -i face_verify.zok -o out
./zokrates setup -i out -s g16 -p proving.key -v verification.key

./zokrates compile -i poseidon_hash.zok -o out_hash
./zokrates setup -i out_hash -s g16 -p proving_hash.key -v verification_hash.key
```

---

## Database Schema

```sql
users          (id, full_name, email, role, student_id, password)
subjects       (id, code, name, teacher_id, schedule_time)
enrollments    (student_id, subject_id)
face_registry  (id, user_id, name, public_hash, embedding, registered_at)
attendance     (id, student_id, student_name, subject_id, subject_code,
                check_in_time, status, zk_verified, proof_hash)
```

`face_registry.public_hash` is the Poseidon commitment. `attendance.zk_verified` is set `true` only when a valid Groth16 proof passes verification.

---

## Notes

- Email signup is restricted to `@srmist.edu.in` addresses
- Attendance is de-duplicated per student per subject per day
- Students arriving after minute 10 of the hour are marked `Late` instead of `Present`
- The `minor_project/embeddings/` directory is gitignored — it is rebuilt from Supabase on each server start

---

## License

MIT
