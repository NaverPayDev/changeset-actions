import {dirname} from 'path'

import * as core from '@actions/core'
import * as github from '@actions/github'
import assembleReleasePlan from '@changesets/assemble-release-plan'
import {parse as parseConfig} from '@changesets/config'
import parseChangeset from '@changesets/parse'
import {
    PreState,
    NewChangeset,
    type WrittenConfig,
    type ReleasePlan,
    type ComprehensiveRelease,
    type VersionType,
} from '@changesets/types'
import {Packages, Tool} from '@manypkg/get-packages'
import * as yaml from 'js-yaml'
import {markdownTable} from 'markdown-table'
import micromatch from 'micromatch'

export const getReleasePlan = async ({
    owner,
    repo,
    changedFiles,
    octokit,
    githubToken,
}: {
    owner: string
    repo: string
    changedFiles: string[]
    octokit: ReturnType<typeof github.getOctokit>
    githubToken: string
}) => {
    if (!github.context.payload.pull_request?.head.ref) {
        throw new Error('could not find ref')
    }

    const ref = github.context.payload.pull_request.head.ref

    let hasErrored = false
    const encodedCredentials = Buffer.from(`x-access-token:${githubToken}`).toString('base64')

    function fetchFile(path: string) {
        return fetch(`https://oss.fin.navercorp.com/raw/${owner}/${repo}/${ref}/${path}`, {
            headers: {
                Authorization: `Basic ${encodedCredentials}`,
            },
        })
    }

    function fetchJsonFile(path: string) {
        return fetchFile(path)
            .then((x) => x.json())
            .catch((err) => {
                hasErrored = true
                core.error(err)
                return {}
            })
    }

    function fetchTextFile(path: string) {
        return fetchFile(path)
            .then((x) => x.text())
            .catch((err) => {
                hasErrored = true
                core.error(err)
                return ''
            })
    }

    async function getPackage(pkgPath: string) {
        const jsonContent = await fetchJsonFile(pkgPath + '/package.json')
        return {
            packageJson: jsonContent,
            dir: pkgPath,
        }
    }

    const rootPackageJsonContentsPromise = fetchJsonFile('package.json')
    const configPromise: Promise<WrittenConfig> = fetchJsonFile('.changeset/config.json')

    const tree = await octokit.rest.git.getTree({
        owner,
        repo,
        recursive: '1',
        tree_sha: ref,
    })

    let preStatePromise: Promise<PreState> | undefined
    const changesetPromises: Promise<NewChangeset>[] = []
    const potentialWorkspaceDirectories: string[] = []
    let isPnpm = false

    for (const item of tree.data.tree) {
        if (!item.path) {
            continue
        }
        if (item.path.endsWith('/package.json')) {
            const dirPath = dirname(item.path)
            potentialWorkspaceDirectories.push(dirPath)
        } else if (item.path === 'pnpm-workspace.yaml') {
            isPnpm = true
        } else if (item.path === '.changeset/pre.json') {
            preStatePromise = fetchJsonFile('.changeset/pre.json')
        } else if (
            item.path !== '.changeset/README.md' &&
            item.path.startsWith('.changeset') &&
            item.path.endsWith('.md') &&
            changedFiles.includes(item.path)
        ) {
            // eslint-disable-next-line no-useless-escape
            const res = /\.changeset\/([^\.]+)\.md/.exec(item.path)
            if (!res) {
                throw new Error('could not get name from changeset filename')
            }
            const id = res[1]
            changesetPromises.push(
                fetchTextFile(item.path).then((text) => {
                    return {...parseChangeset(text), id}
                }),
            )
        }
    }
    const workspaceText = await fetchTextFile('pnpm-workspace.yaml')

    const workspaceYaml = yaml.load(workspaceText) as {
        packages: string[]
    }

    let tool:
        | {
              tool: Tool
              globs: string[]
          }
        | undefined

    if (isPnpm) {
        tool = {
            tool: 'pnpm',
            globs: workspaceYaml.packages,
        }
    } else {
        const rootPackageJsonContent = await rootPackageJsonContentsPromise

        if (rootPackageJsonContent.workspaces) {
            if (!Array.isArray(rootPackageJsonContent.workspaces)) {
                tool = {
                    tool: 'yarn',
                    globs: rootPackageJsonContent.workspaces.packages,
                }
            } else {
                tool = {
                    tool: 'yarn',
                    globs: rootPackageJsonContent.workspaces,
                }
            }
        } else if (rootPackageJsonContent.bolt && rootPackageJsonContent.bolt.workspaces) {
            tool = {
                tool: 'bolt',
                globs: rootPackageJsonContent.bolt.workspaces,
            }
        }
    }

    const rootPackageJsonContent = await rootPackageJsonContentsPromise

    const packages: Packages = {
        root: {
            dir: '/',
            packageJson: rootPackageJsonContent,
        },
        tool: tool ? tool.tool : 'root',
        packages: [],
    }

    if (tool) {
        if (!Array.isArray(tool.globs) || !tool.globs.every((x) => typeof x === 'string')) {
            throw new Error('globs are not valid: ' + JSON.stringify(tool.globs))
        }
        const matches = micromatch(potentialWorkspaceDirectories, tool.globs)

        packages.packages = await Promise.all(matches.map((dir) => getPackage(dir)))
    } else {
        packages.packages.push(packages.root)
    }

    if (hasErrored) {
        throw new Error('an error occurred when fetching files')
    }

    const releasePlan = assembleReleasePlan(
        await Promise.all(changesetPromises),
        packages,
        await configPromise.then((rawConfig) => parseConfig(rawConfig, packages)),
        await preStatePromise,
    )

    return {
        changedPackages: (packages.tool === 'root'
            ? packages.packages
            : packages.packages.filter((pkg) =>
                  changedFiles.some((changedFile) => changedFile.startsWith(`${pkg.dir}/`)),
              )
        ).map((x) => x.packageJson.name),
        releasePlan,
    }
}

export const getReleasePlanMessage = (releasePlan: ReleasePlan | null, isKoreanLanguage: boolean) => {
    if (!releasePlan) {
        return ''
    }

    const publishableReleases = releasePlan.releases.filter(
        (x): x is ComprehensiveRelease & {type: Exclude<VersionType, 'none'>} => x.type !== 'none',
    )

    const table = formatReleaseTable(publishableReleases, isKoreanLanguage)

    const detailTitleMessage = isKoreanLanguage
        ? `이 PR은 다음 ${publishableReleases.length}개 패키지를 배포하는 변경사항을 포함합니다.`
        : `This PR includes changesets to release ${
              publishableReleases.length === 1 ? '1 package' : `${publishableReleases.length} packages`
          }`
    const emptyMessage = isKoreanLanguage
        ? '이 PR은 어떤 변경사항도 포함하지 않습니다.'
        : 'This PR includes no changesets'

    return `<details><summary>${releasePlan.changesets.length ? detailTitleMessage : emptyMessage}</summary>

${
    publishableReleases.length
        ? table
        : isKoreanLanguage
        ? `변경사항이 PR에 추가되면 이 PR에 포함된 패키지와 관련된 semver 유형을 확인할 수 있습니다.`
        : "When changesets are added to this PR, you'll see the packages that this PR includes changesets for and the associated semver types"
}

  </details>`
}

const PRIORITY = {
    Major: 0,
    Minor: 1,
    Patch: 2,
} as const

const TYPE_LABEL = {
    Major: '💥 Major',
    Minor: '✨ Minor',
    Patch: '🐛 Patch',
} as const

const TYPE_MAP = {
    major: 'Major',
    minor: 'Minor',
    patch: 'Patch',
} as const

function formatReleaseTable(
    publishableReleases: {name: string; type: 'major' | 'minor' | 'patch'}[],
    isKoreanLanguage: boolean,
) {
    const header = isKoreanLanguage ? ['이름', '유형'] : ['Name', 'Type']

    const rows = publishableReleases
        .map(({name, type}) => {
            const typeKey = TYPE_MAP[type]
            return {name, type: typeKey}
        })
        .sort((a, b) => PRIORITY[a.type] - PRIORITY[b.type])
        .map(({name, type}) => [name, TYPE_LABEL[type]])

    return markdownTable([header, ...rows])
}
