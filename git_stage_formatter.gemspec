# frozen_string_literal: true

require_relative "lib/git_stage_formatter/version"

Gem::Specification.new do |spec|
  spec.name          = "git_stage_formatter"
  spec.version       = GitStageFormatter::VERSION
  spec.authors       = ["Roger Oba"]
  spec.email         = ["rogerluan.oba@gmail.com"]
  spec.summary       = "Script to transform staged files using a formatting command"
  spec.homepage      = "https://github.com/rogerluan/git_stage_formatter"
  spec.license       = "MIT"
  spec.required_ruby_version = Gem::Requirement.new(">= 2.4.0")
  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = "https://github.com/rogerluan/git_stage_formatter"
  spec.metadata["changelog_uri"] = "https://github.com/rogerluan/git_stage_formatter/blob/master/CHANGELOG.md"

  # Specify which files should be added to the gem when it is released.
  # The `git ls-files -z` loads the files in the RubyGem that have been added into git.
  spec.files = Dir.chdir(File.expand_path(__dir__)) do
    `git ls-files -z`.split("\x0").reject { |f| f.match(%r{\A(?:test|spec|features)/}) }
  end
  spec.bindir        = "bin"
  spec.executables   = ['git_stage_formatter']
  spec.require_paths = ["lib"]

  spec.add_development_dependency 'bundler', '>= 2.0.0', '< 3.0.0'
  spec.add_development_dependency 'rake', '~> 13.0'
end
