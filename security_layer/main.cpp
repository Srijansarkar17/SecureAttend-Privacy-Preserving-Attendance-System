#include <iostream>
#include <vector>
#include <sstream>
#include "embedding_processor.h"
#include "nonce.h"
#include "proof.h"
#include <libgen.h>
#include <unistd.h>
#include <mach-o/dyld.h>

void setWorkingDirToExec() {
    char path[1024];
    uint32_t size = sizeof(path);
    if (_NSGetExecutablePath(path, &size) == 0) {
        char real_p[1024];
        if (realpath(path, real_p) != NULL) {
            char *dir = dirname(real_p);
            chdir(dir);
        }
    }
}

int main(int argc, char* argv[]) {
    // Correct working directory for relative ZoKrates calls
    setWorkingDirToExec();

    // Mode 0: Register (Hashing)
    // Usage: ./security_layer 0 "comma_separated_embedding"
    if (std::string(argv[1]) == "0") {
        if (argc != 3) {
            std::cerr << "Usage for Register: ./security_layer 0 \"emb\"" << std::endl;
            return 1;
        }
        std::vector<float> embedding;
        std::stringstream ss(argv[2]);
        std::string item;
        while (std::getline(ss, item, ',')) embedding.push_back(std::stof(item));

        auto quantized = EmbeddingProcessor::quantize(embedding);
        std::string commitment = ProofGenerator::computeCommitment(quantized);
        
        std::cout << "{\"public_hash\":\"" << commitment << "\"}" << std::endl;
    } 
    // Mode 1: Verify (Proving)
    // Usage: ./security_layer 1 "live_emb" "stored_emb" threshold "commitment"
    else if (std::string(argv[1]) == "1") {
        if (argc != 6) {
            std::cerr << "Usage for Verify: ./security_layer 1 \"live_emb\" \"stored_emb\" threshold \"commitment\"" << std::endl;
            return 1;
        }
        
        auto parse_emb = [](std::string s) {
            std::vector<float> emb;
            std::stringstream ss(s);
            std::string item;
            while (std::getline(ss, item, ',')) emb.push_back(std::stof(item));
            return EmbeddingProcessor::quantize(emb);
        };

        auto live_q = parse_emb(argv[2]);
        auto stored_q = parse_emb(argv[3]);
        int threshold = std::stoi(argv[4]);
        std::string commitment = argv[5];

        std::string proof = ProofGenerator::generateProof(live_q, stored_q, threshold, commitment);
        std::cout << proof << std::endl;
    }
    // Mode 2: Verify Proof
    // Usage: ./security_layer 2
    else if (std::string(argv[1]) == "2") {
        int ret = std::system("./zokrates verify > verify_out.txt 2>&1");
        if (ret == 0) {
            std::cout << "{\"verified\":true}" << std::endl;
        } else {
            std::cout << "{\"verified\":false}" << std::endl;
        }
    }

    return 0;
}