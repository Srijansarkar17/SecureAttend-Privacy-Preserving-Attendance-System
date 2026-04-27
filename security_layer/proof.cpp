#include "proof.h"
#include <sstream>

#include <fstream>
#include <cstdlib>
#include <iostream>

std::string ProofGenerator::generateProof(const std::vector<int>& live_emb,
                                          const std::vector<int>& stored_emb,
                                          int threshold,
                                          const std::string& commitment) {
    
    // 1. Prepare arguments for witness computation
    std::stringstream args;
    for (int v : live_emb) args << v << " ";
    for (int v : stored_emb) args << v << " ";
    args << threshold << " " << commitment;

    // 2. Compute witness
    std::string cmd_witness = "./zokrates compute-witness -a " + args.str() + " > witness_out.txt 2>&1";
    int ret = std::system(cmd_witness.c_str());
    if (ret != 0) return "{\"error\":\"witness_generation_failed\"}";

    // 3. Generate proof
    std::string cmd_proof = "./zokrates generate-proof > proof_gen.txt 2>&1";
    ret = std::system(cmd_proof.c_str());
    if (ret != 0) return "{\"error\":\"proof_generation_failed\"}";

    // 4. Read proof.json
    std::ifstream f("proof.json");
    std::stringstream buffer;
    buffer << f.rdbuf();
    
    return buffer.str();
}

std::string ProofGenerator::computeCommitment(const std::vector<int>& emb) {
    std::stringstream args;
    for (int v : emb) args << v << " ";

    std::system(("./zokrates compute-witness -i out_hash -a " + args.str() + " > /dev/null 2>&1").c_str());
    std::system("./zokrates generate-proof -i out_hash -p proving_hash.key > /dev/null 2>&1");

    // Use python to safely extract the last input (the return value in this version of ZoKrates)
    std::system("python3 -c \"import json; print(json.load(open('proof.json'))['inputs'][-1])\" > commitment.txt 2>/dev/null");

    std::ifstream f("commitment.txt");
    std::string commitment = "0";
    if (f.is_open()) {
        std::getline(f, commitment);
    }
    
    // Remove potential 0x prefix if ZoKrates returns hex
    if (commitment.find("0x") == 0) {
        // Zokrates likes decimal strings for arguments, but inspect/proof.json might have hex.
        // If it's hex, we should keep it string-based for ZoKrates -a.
        // Actually, ZoKrates -a accepts hex if prefixed with 0x.
    }

    return commitment;
}