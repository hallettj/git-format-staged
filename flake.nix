{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";
  };

  outputs = { self, nixpkgs, systems }:
    let
      eachSystem = callback: nixpkgs.lib.genAttrs (import systems) (system: callback (pkgs system));
      pkgs = system: nixpkgs.legacyPackages.${system};
    in
    {
      packages = eachSystem (pkgs: {
        default = pkgs.callPackage ./packages/git-format-staged.nix { };

        # When npm dependencies change we need to update the dependencies hash
        # in test/test.nix
        update-npm-deps-hash = pkgs.writeShellApplication {
          name = "update-npm-deps-hash";
          runtimeInputs = with pkgs; [ prefetch-npm-deps nix gnused ];
          text = ''
            hash=$(prefetch-npm-deps package-lock.json 2>/dev/null)
            echo "updated npm dependency hash: $hash" >&2
            sed -i "s|sha256-[A-Za-z0-9+/=]\+|$hash|" test/test.nix
          '';
        };
      });

      devShells = eachSystem (pkgs: {
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
      checks = eachSystem (pkgs:
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
