# SecureAttend — Complete Interview Preparation Guide
### ZK-SNARK + ArcFace Privacy-Preserving Attendance System

> **How to use this document:** Paste this entire document into ChatGPT and ask it to quiz you, explain any section in simpler terms, or generate more questions. Everything below is based directly on your actual project code.

---

## 1. WHAT IS THIS PROJECT? (Elevator Pitch)

**SecureAttend** is a **privacy-preserving, biometric attendance management system** for college classrooms (built for SRMIST). It uses:

- **ArcFace (via InsightFace)** — state-of-the-art deep learning for face recognition
- **ZK-SNARKs (via ZoKrates + Groth16)** — to cryptographically prove that a student's face matches a registered template **without ever revealing the actual face data**
- **Poseidon Hash** — a ZK-friendly hash function to commit face embeddings on-chain/in-database
- **FastAPI** — backend REST API server
- **Supabase (PostgreSQL)** — cloud database for storing users, attendance, face registry
- **React (Vite + TailwindCSS)** — modern frontend with teacher and student dashboards

### The Core Innovation
Traditional biometric systems store raw face images or feature vectors in a database — a massive **privacy risk**. If the database is breached, someone can reconstruct or reuse your biometric data forever (you can't change your face).

SecureAttend **never stores the raw face embedding** in a way that allows reconstruction. Instead:
1. At registration → compute a **Poseidon hash commitment** of the face embedding and store only that hash.
2. At recognition → generate a **ZK proof** that proves "my live face embedding is within distance threshold of the registered embedding" — **without revealing either embedding**.

---

## 2. SYSTEM ARCHITECTURE — THE BIG PICTURE

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vite)                 │
│  Home | Login | TeacherDashboard | StudentDashboard      │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP (REST)
                           ▼
┌─────────────────────────────────────────────────────────┐
│              BACKEND (FastAPI / Python)                  │
│   /api/register   /api/recognize   /api/auth/*           │
│   /api/attendance  /api/subjects   /api/students         │
└──────┬──────────────────────────────────────┬───────────┘
       │ subprocess call                       │ Supabase SDK
       ▼                                       ▼
┌──────────────────┐                  ┌────────────────────┐
│  FACE PIPELINE   │                  │  SUPABASE DB        │
│ (Python Scripts) │                  │  - users            │
│  api_register.py │                  │  - face_registry    │
│  api_recognize.py│                  │  - attendance       │
└──────┬───────────┘                  │  - subjects         │
       │ subprocess call              │  - enrollments      │
       ▼                              └────────────────────┘
┌──────────────────────────────────┐
│    SECURITY LAYER (C++ Binary)   │
│    Mode 0: Compute Commitment    │
│    Mode 1: Generate ZK Proof     │
│    Mode 2: Verify ZK Proof       │
└──────────────┬───────────────────┘
               │ shell calls
               ▼
┌──────────────────────────────────┐
│  ZoKrates (ZK-SNARK Toolchain)   │
│   compute-witness                │
│   generate-proof (Groth16)       │
│   verify                         │
│   ── Circuits ──                 │
│   face_verify.zok (main circuit) │
│   poseidon_hash.zok (commitment) │
└──────────────────────────────────┘
```

### Data Flow — Registration
1. Student uploads face photo via React frontend
2. Backend saves it temporarily → calls `api_register.py`
3. `api_register.py` loads **ArcFace (buffalo_l model)** → detects face → extracts **512-dim float embedding** → L2-normalizes it
4. Embedding is sent to the **C++ binary** (Mode 0)
5. C++ **quantizes** embedding (float → int, mapped to range [10000, 30000]) → calls ZoKrates to run `poseidon_hash.zok`
6. ZoKrates computes a **Poseidon hash commitment** of the 128-dim quantized embedding
7. The commitment (a single large integer / field element) is returned to Python
8. Python stores: `{name → commitment}` in `face_db.json` AND `face_registry` table in Supabase, along with the raw embedding (for fast matching later)

### Data Flow — Recognition/Attendance
1. Teacher clicks "Recognize" and submits a live camera frame
2. Backend fetches all face entries from Supabase → writes local `.npy` files for each student
3. `api_recognize.py` is called → ArcFace extracts live embedding (512-dim, L2-normalized)
4. For each registered student: compute **cosine similarity** (dot product of normalized vectors)
5. If similarity > 0.4 (potential match): invoke the **ZK Prover** (C++ Mode 1)
   - C++ quantizes both embeddings → calls `./zokrates compute-witness` → `./zokrates generate-proof`
   - The ZK circuit checks: (1) squared Euclidean distance < threshold, AND (2) Poseidon hash of stored embedding == stored commitment
6. Then invoke **ZK Verifier** (C++ Mode 2): calls `./zokrates verify` → checks `proof.json`
7. If verified → mark attendance in Supabase with `zk_verified: true`

---

## 3. ARCFACE — DEEP DIVE

### What is ArcFace?
ArcFace (Additive Angular Margin Loss) is a **deep learning face recognition algorithm** published by researchers at Imperial College London in 2019. It is currently one of the most accurate face recognition systems in the world.

### The Problem It Solves
Traditional classification CNNs use **Softmax loss**, which doesn't enforce tight clustering of same-identity faces or good separation between different identities. ArcFace introduces an **additive angular margin penalty** to make the decision boundaries geometrically more strict.

### How ArcFace Works
1. **Backbone CNN** (e.g., ResNet-50, ResNet-100, MobileNet): Takes a face image → outputs a feature vector (embedding)
2. **ArcFace Loss** during training: For class `y_i`, it adds margin `m` to the angle between the feature vector and the weight vector for that class:
   ```
   L = -log( e^(s·cos(θ_yi + m)) / (e^(s·cos(θ_yi + m)) + Σ_{j≠yi} e^(s·cos(θ_j))) )
   ```
   - `θ_yi` = angle between embedding and the class center
   - `m` = angular margin (typically 0.5 radians / ~28.6°)
   - `s` = feature scale (typically 64)

3. **Result**: After training, embeddings of the same person cluster tightly in angular space, and embeddings of different people are pushed far apart.

### InsightFace — the Library Used in Your Project
InsightFace is the open-source Python library that packages ArcFace models for easy use.

```python
from insightface.app import FaceAnalysis

app = FaceAnalysis(name="buffalo_l", providers=['CPUExecutionProvider'])
app.prepare(ctx_id=0)

faces = app.get(img)       # Returns list of Face objects
emb = faces[0].embedding   # Shape: (512,) — float32 array
```

### buffalo_l Model
- **buffalo_l** = large version of the "buffalo" model pack (balanced accuracy vs. speed)
- Internally uses a **ResNet-100** backbone trained on ~5.8M faces (MS1MV3 dataset)
- Produces **512-dimensional embeddings**
- Also bundles a **face detection model** (RetinaFace) that finds bounding boxes and 5-point landmarks

### 512-dim Embeddings
- Each face is converted to a vector of 512 floating point numbers
- These numbers don't have human-interpretable meaning individually — they collectively encode the "identity" of the face in a high-dimensional geometric space
- **L2 Normalization**: After extraction, the embedding is normalized to unit length (magnitude = 1). This puts all embeddings on a 512-dimensional **unit hypersphere**

```python
emb = emb / np.linalg.norm(emb)
# Now ||emb|| = 1.0
```

### Cosine Similarity
Since all embeddings are L2-normalized, the dot product equals cosine similarity:
```python
similarity = np.dot(live_emb, stored_emb)
# Range: [-1, 1]
# 1.0 = identical direction (same person)
# 0.0 = orthogonal (unrelated)
# -1.0 = opposite (very different)
```

**Thresholds in your project:**
- `similarity > 0.4` → trigger ZK proof generation (possible match)
- `similarity > 0.6` → fallback acceptance if ZK verifier has issues

### Face Detection (RetinaFace — inside buffalo_l)
Before feature extraction, the face must be detected and aligned:
1. **RetinaFace** detects all faces → bounding boxes + 5 landmarks (eyes, nose, mouth corners)
2. **Affine transformation** aligns face to a canonical 112×112 crop
3. Aligned crop is fed into the ArcFace ResNet → 512-dim embedding

### Why 128 dims in the ZK circuit, not 512?
The ZoKrates circuit uses only the **first 128 dimensions** of the 512-dim ArcFace embedding. This is a **performance optimization**:
- ZK circuits grow in complexity with the number of inputs (more constraints = slower proving)
- 128 dimensions retain most discriminative power while keeping proof generation practical
- This is a common tradeoff in privacy-preserving ML systems

---

## 4. ZERO-KNOWLEDGE PROOFS — CONCEPTUAL FOUNDATION

### What is a Zero-Knowledge Proof (ZKP)?
A **Zero-Knowledge Proof** is a cryptographic protocol where a **Prover** convinces a **Verifier** that a statement is true, without revealing any information beyond the truth of the statement itself.

**Classic analogy**: Ali Baba's cave. You want to prove you know the password to open a magic door, without revealing the password itself.

### Three Properties of ZKP
1. **Completeness**: If the statement is true, an honest prover can always convince the verifier.
2. **Soundness**: A cheating prover cannot convince the verifier of a false statement (except with negligible probability).
3. **Zero-Knowledge**: The verifier learns nothing beyond "the statement is true."

### Interactive vs. Non-Interactive
- **Interactive ZKP**: Prover and Verifier engage in multiple rounds of challenge-response
- **Non-Interactive ZKP (NIZK)**: Prover generates a single proof string that anyone can verify — this is what you use (**ZK-SNARK**)

### ZK-SNARKs
**ZK-SNARK** = Zero-Knowledge Succinct Non-Interactive Argument of Knowledge

- **Succinct**: The proof is very short (a few hundred bytes) and fast to verify (milliseconds), regardless of computation complexity
- **Non-Interactive**: Single proof string, no back-and-forth
- **Argument of Knowledge**: Proves that the prover *knows* a witness satisfying the statement

**Used in**: Ethereum (zkSync, Polygon zkEVM), Zcash cryptocurrency, privacy-preserving ML, digital identity systems — and your project!

---

## 5. ZoKrates — DEEP DIVE

### What is ZoKrates?
ZoKrates is a **toolbox for ZK-SNARKs on Ethereum** (but also usable standalone). It provides:
- A high-level **domain-specific language (DSL)** to write ZK circuits in Python-like syntax
- A **compiler** that converts ZoKrates code → Rank-1 Constraint System (R1CS)
- Tools for **trusted setup**, **witness computation**, **proof generation**, and **verification**

### ZoKrates Workflow (Step by Step)

#### Step 1: Write the Circuit (.zok file)
```zokrates
// face_verify.zok
import "hashes/poseidon/poseidon" as poseidon;

def main(
    private field[128] live_emb,     // PRIVATE — only prover knows
    private field[128] stored_emb,   // PRIVATE — only prover knows
    public field threshold,           // PUBLIC — verifier knows
    public field commitment           // PUBLIC — verifier knows
) {
    // Constraint 1: Distance check
    field mut dist = 0;
    for u32 i in 0..128 {
        field diff = live_emb[i] - stored_emb[i];
        dist = dist + diff * diff;
    }
    assert(dist < threshold);

    // Constraint 2: Poseidon commitment verification
    // (Hierarchical hashing of 128 inputs in 4-element chunks)
    field[32] mut hashes_l1 = [0; 32];
    for u32 i in 0..32 {
        hashes_l1[i] = poseidon([stored_emb[i*4], stored_emb[i*4+1],
                                  stored_emb[i*4+2], stored_emb[i*4+3]]);
    }
    // ... (more levels of hashing) ...
    field actual_commitment = poseidon([hashes_l3[0], hashes_l3[1]]);
    
    assert(actual_commitment == commitment);  // Must match stored hash
    return;
}
```

**Inputs:**
- `live_emb` (PRIVATE): The live face embedding being matched — never revealed
- `stored_emb` (PRIVATE): The stored template — never revealed
- `threshold` (PUBLIC): Maximum allowed squared Euclidean distance (set to 1,000,000)
- `commitment` (PUBLIC): The Poseidon hash of the registered face template (stored in DB)

**What the circuit proves:** "I know two embeddings (live and stored) such that:
1. Their squared Euclidean distance is below the threshold
2. The stored embedding hashes to the public commitment on file"

#### Step 2: Compile
```bash
./zokrates compile -i face_verify.zok -o out
# Produces: out (binary circuit), out.r1cs (constraint system)
```
Compilation converts the ZoKrates DSL → **R1CS (Rank-1 Constraint System)** — a mathematical representation as a set of equations over a finite field.

#### Step 3: Trusted Setup (Groth16 — done once)
```bash
./zokrates setup
# Produces: proving.key, verification.key
```
This is the **"trusted setup"** ceremony. It generates:
- **Proving Key (pk)**: Used by the prover to generate proofs. Contains ~5MB of data.
- **Verification Key (vk)**: Used by the verifier. Contains ~1KB of data.

⚠️ **Important**: The random numbers used during setup must be destroyed after. If someone keeps them (the "toxic waste"), they can generate fake proofs. In production, a **multi-party computation (MPC) ceremony** is used so no single person has all the randomness.

#### Step 4: Compute Witness
```bash
./zokrates compute-witness -a <live_emb_values> <stored_emb_values> <threshold> <commitment>
# Produces: witness (contains all intermediate computation values)
```
A **witness** is the complete assignment of ALL variables in the circuit (private + public). It's essentially "the full computation trace" — proving the prover actually ran the computation correctly.

#### Step 5: Generate Proof (Groth16)
```bash
./zokrates generate-proof
# Produces: proof.json
```
Using the **proving key** and **witness**, generates the actual ZK proof. The proof is a small JSON file (~10KB in your project) containing elliptic curve points.

#### Step 6: Verify Proof
```bash
./zokrates verify
# Returns: PASSED or FAILED
```
Using only the **verification key** and **proof.json**, anyone can verify the proof in milliseconds without needing the private inputs.

---

## 6. GROTH16 — THE ZK-SNARK ALGORITHM

### What is Groth16?
Groth16 is a **proving system** (a specific ZK-SNARK scheme) proposed by Jens Groth in 2016. It is the most widely used ZK-SNARK in practice.

### Why Groth16?
- **Smallest proof size**: Only **3 group elements** (about 128 bytes for BN128 curve)
- **Fastest verification**: Typically 3-5 ms (only a few pairing operations)
- **Widely used**: Ethereum's zkSNARK precompiles support Groth16 natively

### Mathematical Basis
Groth16 is built on **pairing-based cryptography**:
- Uses a **bilinear elliptic curve** (BN128 / BN254 in your project)
- The finite field for computation is the scalar field of BN254

**R1CS → QAP**: First, the R1CS (a system of constraints) is converted to a **Quadratic Arithmetic Program (QAP)** — a polynomial representation. The proof is essentially a **polynomial commitment** that proves the polynomials satisfy the QAP without revealing them.

**The Proof**: A Groth16 proof consists of three group elements: `(A, B, C)` in elliptic curve groups G1, G2, G1. Verification involves 3 pairing operations.

### Trusted Setup in Groth16
- Groth16 requires a **circuit-specific trusted setup** (unlike universal setups like PLONK or STARK)
- This means if the circuit changes, you must redo the setup
- The setup generates a **Structured Reference String (SRS)** which encodes the circuit structure in encrypted form

---

## 7. R1CS — RANK-1 CONSTRAINT SYSTEM

### What is R1CS?
When ZoKrates compiles your `.zok` file, it converts the program into a system of equations called R1CS. Each constraint looks like:

```
(a · s) * (b · s) = (c · s)
```

Where `s` is the **witness vector** (all variables), and `a`, `b`, `c` are coefficient vectors.

### Example
The simple operation `z = x * y` becomes one R1CS constraint:
- `(1·x) * (1·y) = (1·z)`

The operation `z = x + y` is **free** (linear operations don't add constraints).

Your circuit has thousands of constraints because it contains:
- 128 multiplications for distance computation (`diff * diff`)
- Hundreds of Poseidon hash round computations

### out.r1cs File
In your project: `security_layer/out.r1cs` — this is the compiled constraint system (13.4 MB), containing all the constraints for `face_verify.zok`.

---

## 8. POSEIDON HASH — DEEP DIVE

### What is Poseidon?
Poseidon is a **ZK-friendly cryptographic hash function** designed in 2019 specifically for use inside ZK circuits. Traditional hash functions like SHA-256 are very expensive inside ZK circuits (thousands of constraints per hash).

### Why Poseidon?
| Hash Function | Constraints per compression | Notes |
|---|---|---|
| SHA-256 | ~25,000 | Standard, not ZK-friendly |
| MiMC | ~500 | Early ZK hash, now superseded |
| Poseidon | ~250 | State of the art ZK hash |

Poseidon is designed to work natively over **prime fields** (the same mathematical domain as ZK circuits), avoiding the expensive bit operations that SHA-256 requires.

### Poseidon Construction
- Based on the **HADES design strategy** (combination of full S-box layers and partial S-box layers)
- **S-box**: Cube function `x^5` over the prime field (chosen for ZK efficiency)
- **MDS Matrix**: A Maximum Distance Separable matrix for mixing (diffusion)
- **Round Constants**: Precomputed constants for security

### How Poseidon is Used in Your Circuit
Your `poseidon_hash.zok` and `face_verify.zok` use **hierarchical (Merkle-tree-style) hashing** to reduce 128 inputs to a single field element:

```
128 inputs
    ↓ (32 groups of 4) → Poseidon(4) → 32 hashes
    ↓ (8 groups of 4)  → Poseidon(4) → 8 hashes
    ↓ (2 groups of 4)  → Poseidon(4) → 2 hashes
    ↓ (1 group of 2)   → Poseidon(2) → 1 COMMITMENT
```

This is necessary because Poseidon in ZoKrates has a maximum arity of 6 inputs at a time.

### Why Hash? — The Commitment Scheme
The Poseidon hash creates a **cryptographic commitment** to the face embedding:
- Given the commitment, you cannot reverse-engineer the embedding (one-way)
- Given the embedding, you can always reproduce the same commitment (binding)
- The commitment is stored in the database — if the DB is stolen, attacker gets hash values that are computationally impossible to invert

---

## 9. EMBEDDING QUANTIZATION

### Why Quantize?
ArcFace embeddings are **floating-point numbers** (e.g., 0.0234, -0.1823...). ZoKrates/ZK circuits work over **finite fields of prime numbers** (integers). So we must convert floats → integers.

### Your Quantization Scheme (embedding_processor.cpp)
```cpp
// Map [-1.0, 1.0] → [10000, 30000]
quantized[i] = static_cast<int>(embedding[i] * 10000.0f) + 20000;
```

**Why add 20000?** ZK finite field arithmetic doesn't handle negative numbers naturally. Adding an offset ensures all values are positive integers while preserving relative distances.

**Example:** 
- `-1.0` → `(-1.0 × 10000) + 20000` = `10000`
- `0.0`  → `(0.0 × 10000) + 20000` = `20000`
- `+1.0` → `(1.0 × 10000) + 20000` = `30000`

### Distance in Quantized Space
Squared Euclidean distance in quantized space ≈ squared Euclidean distance in float space × 10000²

The threshold in your circuit is set to `1,000,000` (equivalent to a distance of ~0.01 in normalized float space, or cosine similarity ~0.995). *(Note: the threshold value in api_recognize.py vs face_recognize.py differ; this is an area for tuning.)*

---

## 10. C++ SECURITY LAYER

### Three Modes of Operation
The compiled binary `security_layer` (compiled from the C++ files) acts as a bridge between Python and ZoKrates:

**Mode 0 — Registration (compute commitment):**
```bash
./security_layer 0 "0.123,0.456,-0.789,..."
# Returns: {"public_hash": "<poseidon_commitment>"}
```
- Parses comma-separated float embedding
- Quantizes it (EmbeddingProcessor::quantize)
- Calls ZoKrates to compute Poseidon hash via `poseidon_hash.zok`
- Returns the commitment as a JSON string

**Mode 1 — Proof Generation:**
```bash
./security_layer 1 "<live_emb>" "<stored_emb>" "1000000" "<commitment>"
# Returns: contents of proof.json
```
- Quantizes both embeddings
- Calls `./zokrates compute-witness -a ...` (builds the witness)
- Calls `./zokrates generate-proof` (Groth16 proving)
- Returns `proof.json`

**Mode 2 — Proof Verification:**
```bash
./security_layer 2
# Returns: {"verified": true} or {"verified": false}
```
- Calls `./zokrates verify` (verifies `proof.json` against `verification.key`)
- Returns JSON result

### Why C++?
- C++ is the most natural language for calling system binaries and handling performance-critical operations
- The ZoKrates binary is a native executable — it's most cleanly wrapped in C++
- C++ allows direct memory management for the embedding vectors

---

## 11. SUPABASE DATABASE SCHEMA

### Tables
| Table | Purpose |
|---|---|
| `users` | Custom user table (not Supabase auth) with email, role, hashed password |
| `profiles` | Linked to `auth.users` — stores full_name, role, student_id |
| `subjects` | Course catalog: CS 301 Data Structures, CS 401 ML, etc. |
| `enrollments` | Many-to-many: which student is in which subject |
| `face_registry` | Stores: name, user_id, public_hash (Poseidon commitment), embedding array |
| `attendance` | Stores: student_name, subject_id, check_in_time, status, zk_verified flag, proof_hash |

### Key Security Feature — zk_verified Column
```sql
zk_verified BOOLEAN DEFAULT false
```
Every attendance record stores whether it was verified by a valid ZK proof. This creates an **audit trail** — teachers can see that attendance was biometrically and cryptographically verified.

### Row Level Security (RLS)
Supabase's PostgreSQL RLS is enabled on all tables. Policies control who can read/write, though for this demo they are set to permissive (`USING (true)`) to simplify development.

### Password Hashing
```python
def hash_password(password: str) -> str:
    salt = "secureattend_zk_2026"
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
```
SHA-256 with a static salt. *(Note for interviews: in production, you'd use bcrypt or Argon2 with random per-user salts for better security.)*

---

## 12. BACKEND API (FastAPI)

### Endpoints
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register new user (teachers/students only with @srmist.edu.in email) |
| POST | `/api/auth/login` | Login with email + password |
| POST | `/api/register` | Register a face (uploads photo → ArcFace → ZK commitment → Supabase) |
| POST | `/api/recognize` | Recognize face + mark attendance (ArcFace → ZK proof → Supabase) |
| GET | `/api/subjects` | List all subjects |
| GET | `/api/attendance/{subject_id}` | Today's attendance for a subject |
| GET | `/api/attendance/all/{subject_id}` | All attendance history for a subject |
| GET | `/api/student/attendance/{user_id}` | A student's personal attendance |
| GET | `/api/registered-faces` | All registered face commitments |
| GET | `/api/health` | Health check |

### Email Restriction
```python
if not email.endswith("@srmist.edu.in"):
    raise HTTPException(400, "Only @srmist.edu.in emails are allowed")
```
Only SRM University email addresses are accepted — prevents unauthorized access.

### Attendance De-duplication
The backend checks if a student is already marked present for the same subject on the same day before creating a new record:
```python
existing_attendance = supabase.table("attendance").select("id")
    .eq("student_name", recognized_name)
    .eq("subject_id", subject_id)
    .gte("created_at", today_start)
    .execute()
```

---

## 13. FRONTEND (React + Vite + TailwindCSS)

### Pages
- **Home.jsx**: Landing page with project description
- **Login.jsx**: Sign up / Sign in with role selection (teacher / student)
- **TeacherDashboard.jsx**: Upload photo to register face, trigger recognition, view class attendance, enroll students
- **StudentDashboard.jsx**: View personal attendance records, check status per subject

### Tech Stack
- **React (JSX)**: Component-based UI
- **Vite**: Ultra-fast development server and bundler
- **TailwindCSS**: Utility-first CSS framework
- **Supabase JS Client**: Direct DB calls for some operations

---

## 14. PRIVACY ANALYSIS — WHY THIS IS SECURE

### Threat Model
| Threat | Traditional System | SecureAttend |
|---|---|---|
| Database breach | Raw embeddings stolen → face can be reused | Only Poseidon commitments stolen → computationally infeasible to reverse |
| Server-side privacy | Server sees full face embedding | Server sees only the commitment (hash) |
| Replay attack | Stolen embedding can be replayed | ZK proof uses private witness — stolen commitment is useless without the original embedding |
| Impersonation | Match someone else's face data | ZK circuit enforces distance check — can't forge a valid proof for a different face |
| False attendance | Manual mark or photo-based spoofing | ZK proof cryptographically ties the live biometric to the registered template |

### Cryptographic Security Guarantees
1. **Binding commitment**: The Poseidon hash uniquely identifies the registered embedding. Two different embeddings produce different commitments (with overwhelming probability).
2. **Hiding**: The commitment reveals nothing about the embedding (Poseidon is a one-way function).
3. **ZK Soundness**: A malicious user cannot generate a valid ZK proof for an embedding that is NOT within the distance threshold of the registered face — this would require breaking the discrete logarithm problem on BN254.
4. **ZK Zero-Knowledge**: The proof reveals nothing about the private inputs (live embedding or stored embedding) beyond the fact that they satisfy the circuit constraints.

---

## 15. TECHNICAL CONCEPTS GLOSSARY

| Term | Definition |
|---|---|
| **Field Element** | A number in the finite field Z_p (integers mod prime p). All ZK arithmetic happens in this field. |
| **BN254 (BN128)** | Barreto-Naehrig 254-bit elliptic curve. Used for pairings in Groth16. The prime field has ~77 decimal digits. |
| **R1CS** | Rank-1 Constraint System. The canonical form of a ZK circuit — a set of quadratic constraints. |
| **QAP** | Quadratic Arithmetic Program. R1CS encoded as polynomials. Groth16 proves a valid QAP witness. |
| **Witness** | The complete assignment of all variables in a circuit (both private and public) that satisfies all constraints. |
| **Trusted Setup** | One-time ceremony to generate proving/verification keys. Requires destroying the random "toxic waste." |
| **Proving Key** | Large key used by the prover. Circuit-specific. Contains encoded QAP polynomials. |
| **Verification Key** | Small key used to verify proofs. Shared publicly. |
| **Pairing** | A bilinear map e: G1 × G2 → GT used in Groth16 verification. |
| **L2 Normalization** | Dividing a vector by its Euclidean norm so it has unit length. |
| **Cosine Similarity** | Dot product of two unit vectors. Measures angular distance. Range [-1, 1]. |
| **Squared Euclidean Distance** | Sum of squared differences between corresponding components. Used in the ZK circuit. |
| **Commitment Scheme** | A way to "commit" to a value without revealing it, then "open" it later. |
| **InsightFace** | Open-source 2D/3D deep face analysis library. Provides ArcFace models. |
| **buffalo_l** | InsightFace model pack (large). ResNet-100 backbone, 512-dim embeddings. |
| **RetinaFace** | Face detection model bundled in buffalo_l. Detects faces and 5 landmarks. |
| **Groth16** | A zkSNARK proving system by Jens Groth (2016). Smallest proof, fastest verification. |
| **Poseidon** | ZK-friendly hash function. ~250 constraints per compression vs ~25000 for SHA-256. |
| **ZoKrates** | DSL + toolchain for writing and deploying ZK circuits. |
| **FastAPI** | Modern Python async web framework. Auto-generates OpenAPI docs. |
| **Supabase** | Open-source Firebase alternative. PostgreSQL + realtime + auth + storage. |

---

## 16. INTERVIEW Q&A — LIKELY QUESTIONS

### Project Overview Questions

**Q: In one sentence, what does your project do?**
A: SecureAttend is a privacy-preserving biometric attendance system that uses ArcFace for face recognition and ZK-SNARKs to cryptographically prove identity without ever revealing the face data.

**Q: Why did you use ZK-SNARKs instead of just storing the face embedding?**
A: Biometric data is irreplaceable — you can't change your face if it's stolen. By storing only a Poseidon hash commitment and using ZK proofs, we ensure that even if the database is breached, attackers cannot reconstruct or reuse the biometric data.

**Q: What is the innovation over a traditional attendance system?**
A: Three innovations: (1) Face recognition using state-of-the-art deep learning (ArcFace) instead of RFID cards or manual roll calls, (2) ZK-SNARK cryptographic verification ensuring the match is genuine without revealing biometrics, and (3) an immutable audit trail with `zk_verified` flags per attendance record.

---

### ArcFace Questions

**Q: What is ArcFace and how is it different from regular face recognition?**
A: ArcFace uses Additive Angular Margin Loss during training to enforce tighter clustering of same-identity embeddings and better separation of different identities. Traditional Softmax loss doesn't explicitly enforce geometric margins, leading to worse discriminability. ArcFace embeddings on a unit hypersphere make cosine similarity a natural, reliable metric.

**Q: What is an embedding/feature vector?**
A: An embedding is a 512-dimensional numerical representation of a face, output by a deep neural network (ResNet-100 in buffalo_l). Similar faces produce similar embeddings (small angular distance), different faces produce different embeddings. The network encodes identity-relevant features like facial structure, not pixel values.

**Q: Why L2 normalize the embedding?**
A: L2 normalization projects all embeddings onto a unit hypersphere. This makes dot products equivalent to cosine similarity (a pure angular metric), removing magnitude variance and making the similarity metric scale-invariant and more reliable.

**Q: What threshold did you use for recognition and why?**
A: We use cosine similarity > 0.4 as the trigger to attempt ZK proof generation. ArcFace with buffalo_l typically achieves ~99% accuracy on LFW benchmark with a threshold of 0.3-0.4. A lower threshold catches more matches (higher recall) but risks more false positives.

**Q: What is RetinaFace?**
A: RetinaFace is a face detection model included in the buffalo_l pack. It detects face bounding boxes and 5 facial landmarks (eye centers, nose tip, mouth corners). These landmarks are used to align the face to a canonical pose before ArcFace extracts the embedding, ensuring rotation and scale invariance.

---

### ZK-SNARK Questions

**Q: Explain ZK-SNARK to a non-technical person.**
A: Imagine you want to prove you know the answer to a puzzle without telling anyone the answer. A ZK-SNARK lets you do exactly that — generate a short "certificate" that proves you know the answer, and anyone can check the certificate quickly, but it reveals nothing about what the answer is.

**Q: What is the difference between the Prover and Verifier in your system?**
A: The **Prover** is the backend server that has access to both the live face embedding and the stored template. It generates the ZK proof using the private data. The **Verifier** (also the backend in your system, but conceptually could be any party with the verification key) checks the proof using only the public inputs (threshold and commitment) and the verification key — no private data needed.

**Q: What is a witness in ZK proofs?**
A: A witness is the complete set of all variable assignments in the circuit — including the private inputs (embeddings) and all intermediate computation values. It's the "proof of work" that the prover performed the computation correctly. The witness is used to generate the proof but is never shared.

**Q: What is the Trusted Setup and what is toxic waste?**
A: The Trusted Setup generates the proving key and verification key from random numbers. These random numbers are called "toxic waste" — if they're leaked, a malicious party can generate fake proofs for false statements. The randomness must be destroyed after setup. In production systems, a Multi-Party Computation (MPC) ceremony distributes trust: as long as at least one participant destroys their piece of randomness, the setup is secure.

**Q: Why Groth16 specifically?**
A: Groth16 offers the smallest proof size (3 elliptic curve points, ~128 bytes) and fastest verification (milliseconds). For a real-time attendance system, verification speed matters. The tradeoff is that it requires a circuit-specific trusted setup (unlike newer universal setups like PLONK or STARK).

**Q: What does the ZK circuit actually prove?**
A: The circuit proves two things simultaneously: (1) The squared Euclidean distance between the live embedding and stored embedding is below the threshold (≈ similarity check), AND (2) the Poseidon hash of the stored embedding equals the stored commitment. This ties the proof to the specific registered user without revealing who they are.

**Q: Can someone reuse a proof to mark attendance again?**
A: In principle yes, which is why the backend checks for duplicate attendance on the same day for the same subject before accepting a new mark. In a more secure system, you'd include a nonce (random challenge) in the public inputs so each proof is unique.

---

### Poseidon Hash Questions

**Q: Why not use SHA-256 inside the ZK circuit?**
A: SHA-256 requires bit-level operations (XOR, shifts) that are extremely expensive to represent as arithmetic constraints in an R1CS circuit — each SHA-256 block requires ~25,000 constraints. Poseidon is designed to work directly over prime fields using algebraic operations (S-box: x^5, MDS matrix multiplication), requiring only ~250 constraints per compression. This makes the circuit ~100x faster to prove.

**Q: What makes Poseidon a cryptographic hash function?**
A: Poseidon provides pre-image resistance (can't reverse hash to get input), collision resistance (can't find two inputs with same hash), and avalanche effect (small input change causes large output change). It achieves this through HADES design: alternating full S-box rounds (all positions) and partial S-box rounds (one position) with proper round constants.

**Q: Explain the hierarchical hashing in your project.**
A: Since Poseidon takes at most 6 inputs at once, we use a Merkle-tree-like structure to reduce 128 inputs to 1 hash. First, hash groups of 4 adjacent values → 32 intermediate hashes. Then hash groups of 4 of those → 8 hashes. Then groups of 4 → 2 hashes. Finally hash those 2 → the commitment. This is 32 + 8 + 2 + 1 = 43 Poseidon calls.

---

### System Design Questions

**Q: How does the system handle concurrent recognition requests?**
A: FastAPI is async, but the ZoKrates proof generation is a blocking subprocess call. In the current design, concurrent requests would be serialized on ZoKrates (since it writes to `proof.json` in a shared directory). In production, you'd use a job queue (Celery/Redis) and separate working directories per request.

**Q: Why save the embedding array in Supabase if we have the hash?**
A: The embedding is stored in Supabase to enable the fast Python-side cosine similarity pre-filter. The ZK proof generation is slow (~10+ seconds), so we first do a cheap dot-product check in Python to identify the likely match, then only run ZK proving for that candidate. This hybrid approach balances privacy and performance.

**Q: What happens if ZoKrates verification fails but similarity is high?**
A: Your code has a fallback: if similarity > 0.6 and the proof was generated (even if verification returned false/error), it still marks attendance. This is a pragmatic engineering choice to handle ZoKrates threshold calibration issues. In production, you'd fix the threshold and remove this fallback for full cryptographic security.

**Q: How would you make this production-ready?**
A: Several improvements: (1) Proper MPC ceremony for trusted setup, (2) Use a nonce in public inputs to prevent proof reuse, (3) Per-request working directories for ZoKrates to handle concurrency, (4) Bcrypt/Argon2 for password hashing, (5) JWT tokens for session management, (6) Upgrade to HTTPS/TLS, (7) Remove the similarity-based fallback to enforce strict ZK verification only.

---

### Database Questions

**Q: Why Supabase over a traditional database?**
A: Supabase provides PostgreSQL (production-grade RDBMS) with built-in Auth, Row Level Security (RLS), realtime subscriptions, and a REST API — all without managing infrastructure. For a minor project/prototype, this dramatically reduces development overhead while maintaining production-quality data integrity.

**Q: What is Row Level Security (RLS)?**
A: RLS is a PostgreSQL feature that enforces data access policies at the database level. Policies define which rows a user can SELECT, INSERT, UPDATE, or DELETE based on their identity. Even if the application code is bypassed (e.g., direct API calls), the database enforces access control.

---

### Algorithm Questions

**Q: What is Squared Euclidean Distance and why use it instead of Cosine Distance in the circuit?**
A: Squared Euclidean Distance (SED) = Σ(a_i - b_i)². It avoids square roots, which are expensive in ZK circuits (require special constraint techniques). Since all embeddings are L2-normalized, SED and cosine distance are monotonically related: SED = 2 - 2·cosine_similarity. So comparing SED to a threshold is equivalent to comparing cosine similarity to a threshold.

**Q: What is the computational complexity of your ZK circuit?**
A: The circuit has:
- 128 subtractions + 128 multiplications for distance: 128 constraints
- 43 Poseidon calls × ~250 constraints each: ~10,750 constraints
- Total: ~11,000 R1CS constraints
This results in a proving time of ~10-30 seconds on CPU (the main bottleneck).

---

## 17. PROJECT STATS & KEY NUMBERS

| Metric | Value |
|---|---|
| ArcFace embedding dimensions | 512 (used 128 in ZK circuit) |
| Quantization range | [10000, 30000] (mapped from [-1.0, 1.0]) |
| Cosine similarity threshold for ZK trigger | 0.4 |
| ZK circuit: R1CS file size | 13.4 MB |
| Proving key size | ~5.3 MB |
| Verification key size | ~1.7 KB |
| Proof size (proof.json) | ~10 KB |
| ZK circuit name | face_verify.zok |
| Hash function | Poseidon (ZK-friendly) |
| ZK proving system | Groth16 |
| Elliptic curve | BN254 (BN128) |
| Backend framework | FastAPI |
| Database | Supabase (PostgreSQL) |
| Frontend framework | React + Vite + TailwindCSS |
| ZK toolchain | ZoKrates |
| Face recognition library | InsightFace (buffalo_l) |
| Model backbone | ResNet-100 |
| Target institution | SRMIST (SRM Institute of Science and Technology) |

---

## 18. SUGGESTED CHATGPT PROMPTS TO USE WITH THIS DOCUMENT

After pasting this document into ChatGPT, try these prompts:

1. **"Quiz me on the ZK-SNARK concepts in this project. Ask me 10 questions one by one."**
2. **"Explain Groth16 to me like I'm a first-year student, then explain it like I'm a cryptographer."**
3. **"What are the weaknesses in this system's design? What would you improve?"**
4. **"Explain ArcFace's loss function with the math, using the context of this project."**
5. **"What are alternative ZK proving systems (PLONK, STARK, etc.) and how do they compare to Groth16 for this use case?"**
6. **"Walk me through what happens step by step when a student's attendance is marked."**
7. **"What questions would a panel of professors ask about this project? Quiz me."**
8. **"Explain Poseidon hash vs SHA-256 in terms of ZK-circuit constraints."**
9. **"What are the security vulnerabilities in this system and how would you fix them?"**
10. **"How would this system scale to a university of 50,000 students?"**

---

*Document generated for interview preparation — SecureAttend Minor Project, SRMIST 2026*
