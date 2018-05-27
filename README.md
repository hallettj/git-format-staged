# git-format-staged

Consider a project where you want all code formatted consistently. So you use
a formatting command. (For example I use [prettier-standard][] in my
Javascript projects.) You want to make sure that everyone working on the
project runs the formatter, so you use a tool like [husky][] to install a git
precommit hook. The naive way to write that hook would be to:

- get a list of staged files
- run the formatter on those files
- run `git add` to stage the results of formatting

The problem with that solution is it forces you to commit entire files. At
worst this will lead to contributors to unwittingly committing changes. At
best it disrupts workflow for contributors who use `git add -p`.

git-format-staged tackles this problem by running the formatter on the staged
version of the file. Staging changes to a file actually produces a new file
that exists in the git object database. git-format-staged uses some git
plumbing commands to content from that file to your formatter. The command
replaces file content in the git index. The process bypasses the working tree,
so any unstaged changes are ignored by the formatter, and remain unstaged.

After formatting a staged file git-format-staged computes a patch which it
attempts to apply to the working tree file to keep the working tree in sync
with staged changes. If patching fails you will see a warning message. The
version of the file that is committed will be formatted properly - the warning
just means that working tree copy of the file has been left unformatted. The
patch step can be disabled with the `--no-update-working-tree` option.

[prettier-standard]: https://www.npmjs.com/package/prettier-standard
[husky]: https://www.npmjs.com/package/husky


## How to install

Requires Python version 3 or 2.7.

Run:

    $ npm install --global git-format-staged

Or you can copy the [`git-format-staged`](./git-format-staged) script from this
repository and place it in your executable path. The script is MIT-licensed -
so you can check the script into version control in your own open source
project if you wish.
