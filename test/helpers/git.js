/* @flow strict */

import { type ChildProcess, spawn } from 'child_process'
import * as fs from 'fs-extra'
import { join, resolve } from 'path'
import * as tmp from 'tmp'

export type Result = {
  exitCode: number,
  stdout: string,
  stderr: string
}

// export opaque type Repo = string
export opaque type Repo = {
  path: Path,
  cleanup: () => void
}
export type Path = string

const BIN = resolve(join(__dirname, '..', '..', 'git-format-staged'))

export async function testRepo (): Promise<Repo> {
  const repo = await tmpDir()
  await git(repo, 'init')
  await git(repo, 'config', 'user.name', 'Test Person')
  await git(repo, 'config', 'user.email', 'test@test.com')
  return repo
}

export function cleanup (repo: Repo) {
  repo.cleanup()
}

export async function git (repo: Repo, ...args: string[]): Promise<Result> {
  return run('git', args, { cwd: repo.path })
}

export async function formatStaged (
  repo: Repo,
  args: string // space-separated arguments, interpreted by shell
): Promise<Result> {
  return run([BIN, args].join(' '), [], { cwd: repo.path, shell: true })
}

export async function formatted (
  formatter: string,
  content: string
): Promise<string> {
  const p = spawn(formatter, [])
  p.stdin.write(content)
  p.stdin.end()
  const r = await getResult(p)
  const { stdout } = await rejectOnNonzeroExit(r)
  return stdout
}

function repoPath (repo: Repo, file: Path): Path {
  return join(repo.path, file)
}

/*
 * Put a repo in a state such that a file with the given name and content has
 * been committed.
 */
export async function fileInTree (
  repo: Repo,
  filename: Path,
  content: string
): Promise<void> {
  await setContent(repo, filename, content)
  await git(repo, 'add', filename)
  await git(repo, 'commit', '-m', `commit ${filename}`)
}

export async function getContent (repo: Repo, filename: Path): Promise<string> {
  return fs.readFile(repoPath(repo, filename), { encoding: 'utf8' })
}

export async function getStagedContent (
  repo: Repo,
  filename: Path
): Promise<string> {
  const { stdout } = await git(repo, 'show', `:${filename}`)
  return stdout
}

/*
 * Stage the given file
 */
export async function stage (repo: Repo, filename: Path): Promise<void> {
  const path = repoPath(repo, filename)
  await git(repo, 'add', path)
}

/*
 * Modify a working tree file so that it contains the given content.
 */
export async function setContent (
  repo: Repo,
  filename: Path,
  content: string
): Promise<void> {
  const c = content.endsWith("\n") ? content : content + "\n"
  await fs.writeFile(repoPath(repo, filename), c)
}

async function run (
  cmd: string,
  args: string[] = [],
  options: child_process$spawnOpts = {}
): Promise<Result> {
  const r = await runCommand(cmd, args, options)
  return rejectOnNonzeroExit(r)
}

function runCommand (
  cmd: string,
  args: string[] = [],
  options: child_process$spawnOpts = {}
): Promise<Result> {
  const p = spawn(cmd, args, options)
  return getResult(p)
}

function getResult (p: ChildProcess): Promise<Result> {
  return new Promise((resolve, reject) => {
    var stdout = ''
    var stderr = ''
    p.stdout.on('data', buf => {
      stdout += buf.toString()
    })
    p.stderr.on('data', buf => {
      stderr += buf.toString()
    })
    p.on('close', exitCode => {
      resolve({
        exitCode,
        stdout,
        stderr
      })
    })
    p.on('error', err => {
      reject(err)
    })
  })
}

async function rejectOnNonzeroExit (r: Result): Promise<Result> {
  if (r.exitCode !== 0) {
    throw new Error(`command failed:\n\n${r.stderr}`)
  }
  return r
}

function tmpDir (): Promise<{ path: Path, cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    tmp.dir({ unsafeCleanup: true }, (err, path, cleanup) => {
      if (err) {
        reject(err)
      } else {
        resolve({ path, cleanup })
      }
    })
  })
}
