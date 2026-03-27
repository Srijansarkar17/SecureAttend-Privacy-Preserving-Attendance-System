#ifndef HASH_UTILS_H
#define HASH_UTILS_H

#include <string>
#include <vector>
#include <cstdint>

class HashUtils {
public:
    static std::string sha256(const std::string& input);
    static std::string hashEmbedding(const std::vector<int16_t>& embedding);
};

#endif