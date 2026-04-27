#ifndef EMBEDDING_PROCESSOR_H
#define EMBEDDING_PROCESSOR_H

#include <vector>
#include <cstdint>

class EmbeddingProcessor {
public:
    static void l2Normalize(std::vector<float>& embedding);
    static std::vector<int> quantize(const std::vector<float>& embedding);
};

#endif