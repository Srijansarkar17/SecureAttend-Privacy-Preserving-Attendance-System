#include <iostream>
#include <vector>
#include <sstream>
#include "embedding_processor.h"
#include "hash_utils.h"
#include "nonce.h"
#include "proof.h"

int main(int argc, char* argv[]) {

    if (argc != 2) {
        std::cerr << "Usage: ./security_layer \"comma_separated_embedding\"" << std::endl;
        return 1;
    }

    std::vector<float> embedding;
    std::stringstream ss(argv[1]);
    std::string item;

    while (std::getline(ss, item, ',')) {
        embedding.push_back(std::stof(item));
    }

    // 1️⃣ Normalize
    EmbeddingProcessor::l2Normalize(embedding);

    // 2️⃣ Quantize
    auto quantized = EmbeddingProcessor::quantize(embedding);

    // 3️⃣ Hash
    std::string hash = HashUtils::hashEmbedding(quantized);

    // 4️⃣ Nonce
    std::string nonce = NonceGenerator::generate();

    // 5️⃣ Generate Proof
    std::string proof = ProofGenerator::generateProof(hash, nonce);

    std::cout << proof << std::endl;

    return 0;
}