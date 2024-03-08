{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
  };

  outputs = { self, nixpkgs, systems }:
    let
      eachSystem = callback: builtins.listToAttrs (builtins.map
        (system: {
          name = system;
          value = callback (pkgs system) system;
        })
        (import systems));
      pkgs = system: nixpkgs.legacyPackages.${system};
    in
    {
      packages = eachSystem (pkgs: system: {
        default = pkgs.callPackage ./packages/git-format-staged.nix { };
      });

      devShells = eachSystem (pkgs: system: {
        default = pkgs.mkShell {
          nativeBuildInputs = with pkgs; [
            nodejs
            python3
          ];
        };
      });

      # Run tests against maintained Python versions.
      #
      # Run tests with,
      #
      #     $ nix flake check --print-build-logs
      #
      checks = eachSystem (pkgs: system:
        let
          python_versions = with pkgs; [
            python313
            python312 # Python 3.12
            python311
            python310
            python39 # Python 3.9
            python38
          ];
        in
        builtins.listToAttrs (builtins.map
          (python3: rec {
            name = builtins.replaceStrings [ "." ] [ "_" ] "test-python_${python3.version}";
            value = pkgs.callPackage ./test/test.nix { inherit name python3; };
          })
          python_versions)
      );
    };
}
