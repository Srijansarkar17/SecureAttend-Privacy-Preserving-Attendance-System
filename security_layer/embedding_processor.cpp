#include "embedding_processor.h"
#include <cmath>

void EmbeddingProcessor::l2Normalize(std::vector<float>& embedding) {
    float sum = 0.0f;
    for (float v : embedding) {
        sum += v * v;
    }
    float norm = std::sqrt(sum);

    if (norm == 0.0f) return;

    for (float& v : embedding) {
        v /= norm;
    }
}

std::vector<int> EmbeddingProcessor::quantize(const std::vector<float>& embedding) {
    std::vector<int> quantized(128, 20000); // Initialize with 128 elements at offset 20000
    size_t count = std::min((size_t)128, embedding.size());

    for (size_t i = 0; i < count; ++i) {
        // Map [-1.0, 1.0] to [10000, 30000] approx
        quantized[i] = static_cast<int>(embedding[i] * 10000.0f) + 20000;
    }

    return quantized;
}