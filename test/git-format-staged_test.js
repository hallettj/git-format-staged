/* @flow strict */

import test, { type ExecutionContext } from 'ava'
import stripIndent from 'strip-indent'
import {
  type Repo,
  cleanup,
  fileInTree,
  formatStaged,
  formatted,
  getContent,
  getStagedContent,
  git,
  setContent,
  stage,
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
  const { stdout: a } = await formatStaged(r, '--version')
  t.regex(a, / 1\.\d+\.\d+/)
  const { stdout: b } = await formatStaged(r, '-v')
  t.regex(b, / 1\.\d+\.\d+/)
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
  await formatStaged(r, '--glob "*.js" prettier-standard')
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
  const { stderr } = await formatStaged(r, '--glob "*.js" prettier-standard')
  t.regex(stderr, /Reformatted index\.js with prettier-standard/)
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
  const { stderr } = await formatStaged(r, '--glob "*.js" prettier-standard')
  t.is(stderr, '')
})

test('does not merge changes back to working tree by default', async t => {
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
  await formatStaged(r, '--glob "*.js" prettier-standard')
  contentIs(
    t,
    await getContent(r, 'index.js'),
    `
    function foo() { return 'foo' }
    function bar(  ) {return 'bar'}
    `
  )
})

test('merges formatting changes back to working tree if requested', async t => {
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
  await formatStaged(r, '--glob "*.js" --update-working-tree prettier-standard')
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

  await formatStaged(r, '--glob "*.js" --update-working-tree prettier-standard')
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

  const { stderr } = await formatStaged(
    r,
    '--glob "*.js" --update-working-tree prettier-standard'
  )
  t.regex(
    stderr,
    /Warning: could not apply formatting changes to working tree file index\.js/
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

function contentIs (t: ExecutionContext<>, actual: string, expected: string) {
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
