require_relative "git_stage_formatter/version"

module GitStageFormatter
  def self.run(args)
    # Wrap each argument in quotes to handle spaces in paths
    args = args.map { |arg| "\"#{arg}\"" }.join(' ')
    script_path = File.expand_path('../git-format-staged', File.dirname(__FILE__))
    exec("#{script_path} #{args}")
  end
end
