# Nix packaging for git-format-staged
{ stdenvNoCC
, python3
}:
let
  manifest = builtins.fromJSON (builtins.readFile ../package.json);
in
stdenvNoCC.mkDerivation {
  name = "git-format-staged";
  version = manifest.version;
  src = ../.;
  buildInputs = [ python3 ];
  installPhase = ''
    mkdir -p "$out/bin"
    cp "$src/git-format-staged" "$out/bin/"
    chmod +x "$out/bin/git-format-staged"
  '';
}
