# git-format-staged

Consider a project where you want all code formatted consistently. So you use
a formatting command. (For example I use [prettier-standard][] in my
Javascript projects.) You want to make sure that everyone working on the
project runs the formatter, so you use a tool like [husky][] to install a git
pre-commit hook. The naive way to write that hook would be to:

- get a list of staged files
- run the formatter on those files
- run `git add` to stage the results of formatting

The problem with that solution is it forces you to commit entire files. At
worst this will lead to contributors to unwittingly committing changes. At best
it disrupts workflow for contributors who use `git add -p`.

git-format-staged tackles this problem by running the formatter on the staged
version of the file. Staging changes to a file actually produces a new file
that exists in the git object database. git-format-staged uses some git
plumbing commands to feed that file content to your formatter. The command also
handles updating the index with the formatted file. By default it does not
touch the working copy of the file.

Formatting index files will lead to changes between the index and the working
tree that are uncommittable if git-format-staged is used in a pre-commit hook.
Those changes will not go away unless the contributor removes them with `git
checkout` or runs the formatter on the working tree. Use the
`--update-working-tree` option to keep the working tree in sync with the index.
That option computes a patch of changes that the formatter makes to the index
and applies the patch to the working tree. Rejected patches are not fatal
errors: git-format-patch will succeed, but will leave working tree files
unchanged.

[prettier-standard]: https://www.npmjs.com/package/prettier-standard
[husky]: https://www.npmjs.com/package/husky
