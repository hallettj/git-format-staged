import test, { ExecutionContext } from 'ava'
import stripIndent from 'strip-indent'
import {
  Repo,
  cleanup,
  fileInTree,
  formatStaged,
  formatStagedCaptureError,
  formatted,
  getContent,
  getStagedContent,
  git,
  setContent,
  stage,
  subdir,
  testRepo
} from './helpers/git'

test.beforeEach(async t => {
  const repo = await testRepo()
  setRepo(repo, t)
  await fileInTree(
    repo,
    'index.js',
    `
    function foo () {
      return 'foo'
    }
    `
  )
})

test.afterEach(t => {
  cleanup(repo(t))
})

test('configures committer email', async t => {
  const { stdout } = await git(repo(t), 'config', 'user.email')
  t.is(stdout.trim(), 'test@test.com')
})

test('displays version information', async t => {
  const r = repo(t)
  const { stdout, stderr } = await formatStaged(r, '--version')
  // Python 2 prints version to stderr, Python 3 prints to stdout. See:
  // https://bugs.python.org/issue18920
  t.regex(stdout + stderr, / version \S+/)
})

test('displays help information', async t => {
  const r = repo(t)
  const { stdout: a } = await formatStaged(r, '--help')
  t.regex(a, /^usage: /)
  const { stdout: b } = await formatStaged(r, '-h')
  t.regex(b, /^usage: /)
})

test('formats a file', async t => {
  const r = repo(t)
  await setContent(
    r,
    'index.js',
    `
    function foo() { return 'foo' }
    function bar(  ) {return 'bar'}
    `
  )
  await stage(r, 'index.js')
  await formatStaged(r, '--formatter prettier-standard *.js')
  contentIs(
    t,
    await getStagedContent(r, 'index.js'),
    `
    function foo () {
      return 'foo'
    }
    function bar () {
      return 'bar'
    }
    `
  )
})

test('fails with non-zero exit status if formatter fails', async t => {
  const r = repo(t)
  await setContent(r, 'index.js', 'function foo{} ( return "foo" )')
  await stage(r, 'index.js')
  const { exitCode, stderr } = await formatStagedCaptureError(
    r,
    '-f prettier-standard "*.js"'
  )
  t.true(exitCode > 0)
  t.regex(stderr, /SyntaxError: Unexpected token/)
})

test('fails if no formatter command is given', async t => {
  const r = repo(t)
  const { exitCode, stderr } = await formatStagedCaptureError(r, '*.js')
  t.true(exitCode > 0)
  // The versions of argparse in Python 2 and Python 3 format this error message
  // differently.
  t.regex(
    stderr,
    /argument --formatter\/-f is required|the following arguments are required: --formatter\/-f/
  )
})

test('fails if formatter command is not quoted', async t => {
  const r = repo(t)
  const { exitCode, stderr } = await formatStagedCaptureError(
    r,
    '-f prettier --stdin-filepath "{}" *.js'
  )
  t.true(exitCode > 0)
  t.regex(stderr, /unrecognized arguments: --stdin-filepath/)
  t.regex(stderr, /Do you need to quote your formatter command\?/)
})

test('reports descriptive error if formatter command is not found', async t => {
  const r = repo(t)
  await setContent(
    r,
    'index.js',
    `
    function foo() { return 'foo' }
    function bar(  ) {return 'bar'}
    `
  )
  await stage(r, 'index.js')
  const { exitCode, stderr } = await formatStagedCaptureError(
    r,
    '-f imaginaryformatter *.js'
  )
  t.true(exitCode > 0)
  t.regex(stderr, /imaginaryformatter: .*not found/)
})

test('fails if no files are given', async t => {
  const r = repo(t)
  const { exitCode, stderr } = await formatStagedCaptureError(
    r,
    '-f prettier-standard'
  )
  t.true(exitCode > 0)
  // The versions of argparse in Python 2 and Python 3 format this error message
  // differently.
  t.regex(
    stderr,
    /too few arguments|the following arguments are required: files/
  )
})

test('can be run in a subdirectory', async t => {
  const r = repo(t)
  await fileInTree(r, 'test/testIndex.js', 'function test () {}')
  await setContent(r, 'test/testIndex.js', 'function test() { return true; }')
  await stage(r, 'test/testIndex.js')
  await formatStaged(subdir(r, 'test'), '-f prettier-standard *.js')
  contentIs(
    t,
    await getContent(r, 'test/testIndex.js'),
    `
    function test () {
      return true
    }
    `
  )
})

test('expands globs', async t => {
  const r = repo(t)

  await fileInTree(r, 'test/index.js', '')
  await setContent(r, 'test/index.js', 'function test() {  }')

  await fileInTree(r, 'test/helpers/index.js', '')
  await setContent(r, 'test/helpers/index.js', 'function test() {  }')

  await stage(r, 'test/index.js')
  await stage(r, 'test/helpers/index.js')

  await formatStaged(r, '-f prettier-standard "test/*.js"')

  contentIs(t, await getContent(r, 'test/index.js'), 'function test () {}')
  contentIs(
    t,
    await getContent(r, 'test/helpers/index.js'),
    'function test () {}'
  )
})

test('excludes files that match a negated glob', async t => {
  const r = repo(t)

  await fileInTree(r, 'src/index.js', '')
  await setContent(r, 'src/index.js', 'function main() {  }')

  await fileInTree(r, 'test/index.js', '')
  await setContent(r, 'test/index.js', 'function test() {  }')

  await stage(r, 'src/index.js')
  await stage(r, 'test/index.js')

  await formatStaged(r, '-f prettier-standard "*.js" "!test/*.js"')

  contentIs(t, await getContent(r, 'src/index.js'), 'function main () {}')
  contentIs(t, await getContent(r, 'test/index.js'), 'function test() {  }')
})

test('evaluates file patterns from left-to-right', async t => {
  const r = repo(t)

  await setContent(r, 'index.js', 'function main() {  }')

  await fileInTree(r, 'src/index.js', '')
  await setContent(r, 'src/index.js', 'function main() {  }')

  await fileInTree(r, 'test/index.js', '')
  await setContent(r, 'test/index.js', 'function test() {  }')

  await fileInTree(r, 'test/helpers/index.js', '')
  await setContent(r, 'test/helpers/index.js', 'function testHelper() {  }')

  await stage(r, 'index.js')
  await stage(r, 'src/index.js')
  await stage(r, 'test/index.js')
  await stage(r, 'test/helpers/index.js')

  await formatStaged(
    r,
    '-f prettier-standard "!src/*.js" "*.js" "!test/*.js" "test/helpers/*.js"'
  )

  contentIs(t, await getContent(r, 'index.js'), 'function main () {}')
  contentIs(t, await getContent(r, 'src/index.js'), 'function main () {}')
  contentIs(t, await getContent(r, 'test/index.js'), 'function test() {  }')
  contentIs(
    t,
    await getContent(r, 'test/helpers/index.js'),
    'function testHelper () {}'
  )
})

test('displays a message if a file was changed', async t => {
  const r = repo(t)
  await setContent(
    r,
    'index.js',
    `
    function foo() { return 'foo' }
    function bar(  ) {return 'bar'}
    `
  )
  await stage(r, 'index.js')
  const { stdout } = await formatStaged(r, '-f prettier-standard *.js')
  t.regex(stdout, /Reformatted index\.js with prettier-standard/)
})

test('does not display a message if formatting did not produce any changes', async t => {
  const r = repo(t)
  await setContent(
    r,
    'index.js',
    await formatted(
      'prettier-standard',
      `
      function foo () {
        return 'foo'
      }
      function bar () {
        return 'bar'
      }
      `
    )
  )
  await stage(r, 'index.js')
  const { stderr } = await formatStaged(r, '-f prettier-standard *.js')
  t.is(stderr, '')
})

test('merges formatting changes back to working by default', async t => {
  const r = repo(t)
  await setContent(
    r,
    'index.js',
    `
    function foo() { return 'foo' }
    function bar(  ) {return 'bar'}
    `
  )
  await stage(r, 'index.js')
  await formatStaged(r, '-f prettier-standard *.js')
  contentIs(
    t,
    await getContent(r, 'index.js'),
    `
    function foo () {
      return 'foo'
    }
    function bar () {
      return 'bar'
    }
    `
  )
})

test('optionally does not merge changes back to working tree', async t => {
  const r = repo(t)
  await setContent(
    r,
    'index.js',
    `
    function foo() { return 'foo' }
    function bar(  ) {return 'bar'}
    `
  )
  await stage(r, 'index.js')
  await formatStaged(r, '-f prettier-standard --no-update-working-tree *.js')
  contentIs(
    t,
    await getContent(r, 'index.js'),
    `
    function foo() { return 'foo' }
    function bar(  ) {return 'bar'}
    `
  )
})

test('preserves unstaged changes when merging formatting to working tree', async t => {
  const r = repo(t)

  // staged content
  await setContent(
    r,
    'index.js',
    trim(
      `
      function foo () {
        return "foo";
      }

      function bar () {
        return 'bar'
      }
      `
    )
  )
  await stage(r, 'index.js')

  // working tree content
  await setContent(
    r,
    'index.js',
    trim(
      `
      function foo () {
        return "foo";
      }

      function bar () {
        console.log("called bar");
        return 'bar'
      }
      `
    )
  )

  await formatStaged(r, '-f prettier-standard *.js')
  contentIs(
    t,
    await getStagedContent(r, 'index.js'),
    `
    function foo () {
      return 'foo'
    }

    function bar () {
      return 'bar'
    }
    `
  )
  contentIs(
    t,
    await getContent(r, 'index.js'),
    `
    function foo () {
      return 'foo'
    }

    function bar () {
      console.log("called bar");
      return 'bar'
    }
    `
  )
})

test('succeeds with a warning if changes cannot be cleanly merged back to working tree', async t => {
  const r = repo(t)

  // staged content
  await setContent(
    r,
    'index.js',
    `
    function foo () {
      doStuff("foo");
    }
    `
  )
  await stage(r, 'index.js')

  // working tree content
  await setContent(
    r,
    'index.js',
    `
    function foo () {
      doStuff("foo");
      doStuff("bar");
    }
    `
  )

  const { stderr } = await formatStaged(r, '-f prettier-standard *.js')
  t.regex(
    stderr,
    /warning: could not apply formatting changes to working tree file index\.js/
  )
  contentIs(
    t,
    await getStagedContent(r, 'index.js'),
    `
    function foo () {
      doStuff('foo')
    }
    `
  )
  contentIs(
    t,
    await getContent(r, 'index.js'),
    `
    function foo () {
      doStuff("foo");
      doStuff("bar");
    }
    `
  )
})

test('ignores files that are not listed on command line', async t => {
  const r = repo(t)
  await fileInTree(r, 'README.md', '# Test Project')
  const readmeContent = `
    # Test project

    Includes code like this
    `
  await setContent(r, 'README.md', readmeContent)
  await stage(r, 'README.md')

  // The formatter would exit with an error if it attempted to format README.md
  await formatStaged(r, '-f prettier-standard *.js')

  contentIs(t, await getStagedContent(r, 'README.md'), readmeContent)
})

test('does not write changes if `--no-write` option is set', async t => {
  const r = repo(t)
  await setContent(r, 'index.js', `function foo() { return "foo"; }`)
  await stage(r, 'index.js')
  await formatStaged(r, '--no-write -f prettier-standard "*.js"')
  contentIs(
    t,
    await getStagedContent(r, 'index.js'),
    `function foo() { return "foo"; }`
  )
})

test('fails with non-zero exit status if formatter fails and `--no-write` is set', async t => {
  const r = repo(t)
  await setContent(r, 'index.js', 'function foo{} ( return "foo" )')
  await stage(r, 'index.js')
  const { exitCode, stderr } = await formatStagedCaptureError(
    r,
    '--no-write -f prettier-standard "*.js"'
  )
  t.true(exitCode > 0)
  t.regex(stderr, /SyntaxError: Unexpected token/)
})

test('does not write changes if formatter does not produce output', async t => {
  const r = repo(t)
  await setContent(r, 'index.js', `function foo() { return "foo"; }`)
  await stage(r, 'index.js')
  await formatStaged(r, '-f true "*.js"')
  contentIs(
    t,
    await getStagedContent(r, 'index.js'),
    `function foo() { return "foo"; }`
  )
})

test('messages from formatter command can be redirected to stderr', async t => {
  const r = repo(t)
  await setContent(r, 'index.js', 'function foo{} ( return "foo" )')
  await stage(r, 'index.js')
  const { exitCode, stderr } = await formatStagedCaptureError(
    r,
    '--no-write -f "eslint --stdin --no-eslintrc >&2" "*.js"'
  )
  t.true(exitCode > 0)
  t.regex(stderr, /Parsing error: Unexpected token/)
})

test('replaces placeholder in the formatter command with name of file to be formatted', async t => {
  const r = repo(t)
  await setContent(r, 'index.js', '')
  await stage(r, 'index.js')
  await formatStaged(r, '--formatter "echo {}" "*.js"')
  contentIs(t, await getStagedContent(r, 'index.js'), 'index.js')
})

test('replaces multiple filename placeholders', async t => {
  const r = repo(t)
  await setContent(r, 'index.js', '')
  await stage(r, 'index.js')
  await formatStaged(r, '--formatter "echo {} {}" "*.js"')
  contentIs(t, await getStagedContent(r, 'index.js'), 'index.js index.js')
})

test('replaces filename placeholders with relative path to files in subdirectories', async t => {
  const r = repo(t)
  await fileInTree(r, 'test/testIndex.js', 'function test () {}')
  await setContent(r, 'test/testIndex.js', '')
  await stage(r, 'test/testIndex.js')
  await formatStaged(r, '--formatter "echo {}" "*.js"')
  contentIs(
    t,
    await getStagedContent(r, 'test/testIndex.js'),
    'test/testIndex.js'
  )
})

test('formats a large file', async t => {
  const r = repo(t)
  const lines = []
  for (let i = 0; i < 100_000; i += 1) {
    lines.push("console.log('I will not write huge files')")
  }
  const content = lines.join("\n")
  await fileInTree(
    r,
    'large_file.js',
    content
  )
  await setContent(r, 'large_file.js', content + "\n")
  await stage(r, 'large_file.js')
  await formatStaged(r, '--formatter echo *.js')
  contentIs(
    t,
    await getStagedContent(r, 'large_file.js'),
    content + "\n"
  )
})

function contentIs (t: ExecutionContext, actual: string, expected: string) {
  t.is(trim(actual), trim(expected))
}

// First remove indentation, then strip leading and trailing whitespace.
function trim (content: string): string {
  return stripIndent(content).trim()
}

// Helpers for working with context

function setRepo (repo: Repo, t: any) {
  t.context.repo = repo
}

function repo (t: any): Repo {
  return t.context.repo
}
