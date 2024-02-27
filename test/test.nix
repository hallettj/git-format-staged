{ fetchNpmDeps
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
    name = "git-format-staged-test-deps";
    hash = "sha256-QzQZOwtGfKvIU33Bfc5fQ/FZTTezoRnxysUXyPbKXtg=";
  };
in
stdenvNoCC.mkDerivation {
  inherit src;
  name = "test-python_v${python3.version}";
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
