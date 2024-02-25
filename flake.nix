{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
  };

  outputs = { self, nixpkgs, systems }:
    let
      eachSystem = nixpkgs.lib.genAttrs (import systems);
      pkgs = eachSystem (system: nixpkgs.legacyPackages.${system});
    in
    {
      packages = eachSystem (system: {
        default = pkgs.${system}.callPackage ./packages/git-format-staged.nix { };
      });
      devShells = eachSystem (system: {
        default = pkgs.${system}.mkShell {
          nativeBuildInputs = with pkgs.${system}; [
            nodejs_18
            python3
          ];
        };
      });
    };
}
