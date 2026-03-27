#include "nonce.h"
#include <random>
#include <sstream>

std::string NonceGenerator::generate() {
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dist(0, 15);

    std::stringstream ss;
    for (int i = 0; i < 32; i++) {
        ss << std::hex << dist(gen);
    }

    return ss.str();
}