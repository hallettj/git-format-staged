{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nixpkgs-old-pythons.url = "github:NixOS/nixpkgs/73de017ef2d18a04ac4bfd0c02650007ccb31c2a";
    systems.url = "github:nix-systems/default";

    git-hooks = {
      url = "github:ysndr/nix-git-hooks/d48aa6c86f9ded84e342e60ebebf8f973a891aa9";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      nixpkgs-old-pythons,
      systems,
      git-hooks,
    }:
    let
      overlays = [
        (
          final: prev:
          let
            old-pkgs = nixpkgs-old-pythons.legacyPackages.${system final};
          in
          {
            python39 = old-pkgs.python39;
            python38 = old-pkgs.python38;
          }
        )
        git-hooks.overlay
      ];
      perSystem = callback: nixpkgs.lib.genAttrs (import systems) (system: callback (mkPkgs system));
      mkPkgs = system: import nixpkgs { inherit system overlays; };
      system = pkgs: pkgs.stdenv.hostPlatform.system;
    in
    {
      packages = perSystem (pkgs: rec {
        git-format-staged = pkgs.callPackage ./packages/git-format-staged.nix { };
        default = git-format-staged;

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

        lint-commit-message = pkgs.writeShellApplication {
          name = "lint-commit-message";
          runtimeInputs = [ pkgs.commitlint ];
          text = ''
            commitlint --edit
          '';
        };

        format-staged-changes = pkgs.writeShellApplication {
          name = "format-staged-changes";
          runtimeInputs = [
            self.packages.${system pkgs}.default
            pkgs.black
            pkgs.nixfmt
            pkgs.nodejs
          ];
          text = ''
            git-format-staged --formatter 'nixfmt --filename {}' '*.nix'
            git-format-staged --formatter 'black --quiet --stdin-filename {} -' '*.py' 'git-format-staged'
            git-format-staged --formatter 'prettier --stdin-filepath {}' '*.json' '*.yml'
            git-format-staged --formatter 'npx prettier-standard' '*.js' '*.ts'
          '';
        };
      });

      devShells = perSystem (
        pkgs:
        let
          hook-installer = pkgs.git-hook-installer {
            commit-msg = [ self.packages.${system pkgs}.lint-commit-message ];
            pre-commit = [ self.packages.${system pkgs}.format-staged-changes ];
          };
        in
        {
          default = pkgs.mkShell {
            packages = [
              self.packages.${system pkgs}.update-npm-deps-hash
              hook-installer
              pkgs.git-hook-uninstaller
              pkgs.black
              pkgs.nixfmt
              pkgs.nodejs
              pkgs.prettier
            ];

            inputsFrom = [
              self.packages.${system pkgs}.default
            ];

            shellHook = ''
              install-git-hooks
            '';
          };
        }
      );

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
