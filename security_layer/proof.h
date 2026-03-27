#ifndef PROOF_H
#define PROOF_H

#include <string>

class ProofGenerator {
public:
    static std::string generateProof(const std::string& hash,
                                     const std::string& nonce);
};

#endif