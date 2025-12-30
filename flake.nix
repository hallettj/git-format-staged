{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixpkgs-old-pythons.url = "github:NixOS/nixpkgs/73de017ef2d18a04ac4bfd0c02650007ccb31c2a";
    systems.url = "github:nix-systems/default";
  };

  outputs =
    {
      self,
      nixpkgs,
      nixpkgs-old-pythons,
      systems,
    }:
    let
      overlays = [
        (
          final: prev:
          let
            old-pkgs = nixpkgs-old-pythons.legacyPackages.${final.stdenv.hostPlatform.system};
          in
          {
            python39 = old-pkgs.python39;
            python38 = old-pkgs.python38;
          }
        )
      ];
      perSystem = callback: nixpkgs.lib.genAttrs (import systems) (system: callback (mkPkgs system));
      mkPkgs = system: import nixpkgs { inherit system overlays; };
    in
    {
      packages = perSystem (pkgs: {
        default = pkgs.callPackage ./packages/git-format-staged.nix { };

        # When npm dependencies change we need to update the dependencies hash
        # in test/test.nix
        update-npm-deps-hash = pkgs.writeShellApplication {
          name = "update-npm-deps-hash";
          runtimeInputs = with pkgs; [
            prefetch-npm-deps
            nix
            gnused
          ];
          text = ''
            hash=$(prefetch-npm-deps package-lock.json 2>/dev/null)
            echo "updated npm dependency hash: $hash" >&2
            sed -i "s|sha256-[A-Za-z0-9+/=]\+|$hash|" test/test.nix
          '';
        };
      });

      devShells = perSystem (pkgs: {
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
      checks = perSystem (
        pkgs:
        let
          python_versions = with pkgs; [
            python315
            python314
            python313
            python312 # Python 3.12
            python311
            python310
            python39 # Python 3.9
            python38
          ];
        in
        builtins.listToAttrs (
          builtins.map (python3: rec {
            name = builtins.replaceStrings [ "." ] [ "_" ] "test-python_${python3.version}";
            value = pkgs.callPackage ./test/test.nix { inherit name python3; };
          }) python_versions
        )
      );
    };
}
