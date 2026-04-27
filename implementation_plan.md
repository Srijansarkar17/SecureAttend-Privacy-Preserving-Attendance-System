# Implementation Plan: Integrating Groth16 zk-SNARKs

This plan outlines the steps to integrate the Groth16 algorithm into SecureAttend for privacy-preserving face verification. It specifically addresses the current logic flaw (exact hash matching) by implementing a Zero-Knowledge Distance Proof.

## User Review Required

> [!IMPORTANT]
> **Performance vs. Security**: Groth16 proof generation is computationally intensive. To maintain the "real-time" requirement, we will use **16-bit quantization** and optimized **Poseidon hashing**.
> **Trusted Setup**: Groth16 requires a one-time "Trusted Setup" (CRS). We will perform this locally during registration for now, but a production system would require a multi-party computation (MPC) ceremony.

## Proposed Changes

### 1. ZK Circuit Development (ZoKrates)
We will replace the mock hashing with a real ZK circuit written in the ZoKrates DSL.

#### [NEW] `security_layer/face_verify.zok`
- Implement a circuit that takes a private live embedding and a private stored template.
- Calculate the squared Euclidean distance.
- Assert that the distance is within a public threshold.
- Compute the Poseidon hash of the template to link it to the public record.

### 2. Security Layer (C++)
#### [MODIFY] [main.cpp](file:///Users/srijansarkar/Documents/minorprojectzksnark/security_layer/main.cpp)
- Update the C++ binary to act as a bridge for the ZoKrates prover.
- Handle the quantization of ArcFace embeddings consistently between Python and the ZK circuit.

#### [MODIFY] [proof.cpp](file:///Users/srijansarkar/Documents/minorprojectzksnark/security_layer/proof.cpp)
- Replace the "mock" JSON generation with a system call to the ZoKrates prover to generate a real `proof.json`.

### 3. Application Logic (Python)
#### [MODIFY] [face_register.py](file:///Users/srijansarkar/Documents/minorprojectzksnark/minor_project/face_register.py)
- During registration, generate a Poseidon-based commitment of the face embedding and store it in `face_db.json`.

#### [MODIFY] [face_recognize.py](file:///Users/srijansarkar/Documents/minorprojectzksnark/minor_project/face_recognize.py)
- Change logic from `if live_hash == stored_hash` to `if verify_zk_proof(live_embedding, stored_commitment)`.
- Pass the actual embedding to the ZK prover while keeping it private.

## Open Questions

1. **Embedding Size**: Should we use the full 512-dimension embedding or reduce it (e.g., first 128 elements) to maximize performance on the ARM64 Mac?
2. **Threshold**: What facial distance threshold would you like to start with? (Typical ArcFace values are 0.4 - 0.6 for Normalized Cosine Distance).

## Verification Plan

### Automated Tests
- Run a `test_zk_proof.py` script to ensure that:
  - Correct embeddings produce a valid proof.
  - Incorrect/different embeddings fail the distance check in ZK.
  - The Poseidon hash correctly identifies the registered user without revealing the embedding.

### Manual Verification
- Perform a live registration and recognition on the local machine to verify latency and accuracy.
- Observe the "SecureAttend" UI to ensure it labels users correctly in real-time.
