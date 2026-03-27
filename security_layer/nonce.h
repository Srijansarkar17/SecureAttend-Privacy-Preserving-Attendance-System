#ifndef NONCE_H
#define NONCE_H

#include <string>

class NonceGenerator {
public:
    static std::string generate();
};

#endif