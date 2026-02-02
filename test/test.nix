{
  name,
  fetchNpmDeps,
  git,
  gnused,
  nodejs,
  python3,
  stdenvNoCC,
}:

let
  src = ../.;
  npmDeps = fetchNpmDeps {
    inherit src;
    name = "${name}-deps";
    hash = "sha256-Rpr5UeBKnYl1q0xBg89wlR1Nd9fV9QaMWxbL/AR973w=";
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
