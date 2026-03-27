#include "proof.h"
#include "hash_utils.h"
#include <sstream>

std::string ProofGenerator::generateProof(const std::string& hash,
                                          const std::string& nonce) {
    // Placeholder zk-style proof simulation
    std::string combined = hash + nonce;
    std::string proof_hash = HashUtils::sha256(combined);

    std::stringstream proof;
    proof << "{";
    proof << "\"proof\":\"" << proof_hash << "\",";
    proof << "\"public_hash\":\"" << hash << "\",";
    proof << "\"nonce\":\"" << nonce << "\"";
    proof << "}";

    return proof.str();
}