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
    hash = "sha256-AuyXZ4S7ocf3V8r/1MJi2ckg8XbBHwWE18JlaNxlOp8=";
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
