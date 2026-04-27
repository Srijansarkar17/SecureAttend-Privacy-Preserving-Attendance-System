#ifndef PROOF_H
#define PROOF_H

#include <string>
#include <vector>
#include <cstdint>

class ProofGenerator {
public:
    static    std::string generateProof(const std::vector<int>& live_emb, 
                              const std::vector<int>& stored_emb, 
                              int threshold, 
                              const std::string& commitment);

    static std::string computeCommitment(const std::vector<int>& emb);
};

#endif