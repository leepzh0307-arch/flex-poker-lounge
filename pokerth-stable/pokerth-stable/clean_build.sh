#!/bin/bash
rm -rf ./build/*.a
rm -rf ./build/Make*
rm -rf ./build/src
rm -rf ./build/pokerth_*
rm -rf ./build/.lupdate
rm -rf ./build/.ninja*
rm -rf ./build/build.ninja
rm -rf ./build/.qt
rm -rf ./build/CMake*
rm -rf ./build/cmake_*
rm -rf ./build/bin/*
rm -rf ./build/.cmake
rm -rf ./build/deploy
mkdir -p ./build/share/pokerth
cp -r tls/ ./build/
cp -r data ./build/share/pokerth/