require_relative "git_stage_formatter/version"

module GitStageFormatter
  def self.run(args)
    args = args.join(' ')
    script_path = File.expand_path('../git-format-staged', File.dirname(__FILE__))
    exec("#{script_path} #{args}")
  end
end
