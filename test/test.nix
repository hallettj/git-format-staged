{ name
, fetchNpmDeps
, git
, gnused
, nodejs
, python3
, stdenvNoCC
}:

let
  src = ../.;
  npmDeps = fetchNpmDeps {
    inherit src;
    name = "${name}-deps";
    hash = "sha256-fcN/rnqe5cFv4/HgvtfiMDpJo7c9JGH61Fbi7eQc2lk=";
  };
in
stdenvNoCC.mkDerivation {
  inherit name src;
  nativeBuildInputs = [
    git
    nodejs
    python3
    gnused
  ];
  buildPhase = ''
    npm install --cache "${npmDeps}";

    # Patch node script interpreter lines because the nix build environment does
    # not have a /usr/bin/env
    sed -i --follow-symlinks \
      '1s|#!/usr/bin/env node|#!${nodejs}/bin/node|' \
      node_modules/.bin/*

    npm test | tee test_output
  '';
  installPhase = ''
    cp test_output "$out"
  '';
}
