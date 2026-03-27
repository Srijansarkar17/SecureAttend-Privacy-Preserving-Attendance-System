#include "hash_utils.h"
#include <openssl/sha.h>
#include <sstream>
#include <iomanip>

std::string HashUtils::sha256(const std::string& input) {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    SHA256(reinterpret_cast<const unsigned char*>(input.c_str()), input.size(), hash);

    std::stringstream ss;
    for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    }
    return ss.str();
}

std::string HashUtils::hashEmbedding(const std::vector<int16_t>& embedding) {
    std::stringstream ss;
    for (auto v : embedding) {
        ss << v;
    }
    return sha256(ss.str());
}