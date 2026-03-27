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

std::vector<int16_t> EmbeddingProcessor::quantize(const std::vector<float>& embedding) {
    std::vector<int16_t> quantized;
    quantized.reserve(embedding.size());

    for (float v : embedding) {
        int16_t q = static_cast<int16_t>(v * 32767);
        quantized.push_back(q);
    }

    return quantized;
}