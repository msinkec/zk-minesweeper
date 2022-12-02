#!/bin/bash

# Exit if any subcommand fails
set -e

mkdir -p out

mkdir -p public/zk

cd circuits

zokrates compile --debug -i minesweeper.zok

zokrates setup

zokrates export-verifier-scrypt -o ../contracts/verifier.scrypt

# mv output files to public folder
cp out abi.json verification.key proving.key ../public/zk/


cd ..

npx scryptlib ./contracts/minesweeper.scrypt

cp ./out/minesweeper_desc.json ./public/minesweeper_debug_desc.json
