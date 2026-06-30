import * as core from '@actions/core'
import fg from 'fast-glob'
import * as fs from 'fs-extra'

import {findNearestPackageJson, getChangedAllFiles} from '$actions/utils'

export async function getChangedPackages({
    changedFiles,
    packagesDir,
    excludes,
}: {
    changedFiles: Awaited<ReturnType<typeof getChangedAllFiles>>
    packagesDir: string[]
    excludes: string[]
}) {
    const isIncludedRoot = packagesDir.includes('.') === true
    const targetDirectories = packagesDir.filter((packagename) => packagename !== '.')

    const changedPackages = changedFiles.reduce((acc, {filename}) => {
        const 패키지대상인가 =
            isIncludedRoot || targetDirectories.some((packageDir) => filename.includes(`${packageDir}/`))

        const 마크다운파일인가 = filename.endsWith('.md')
        const 제외대상인가 = excludes.some((exclude) => {
            return filename === exclude || filename.startsWith(`${exclude}`)
        })

        if (패키지대상인가 && !마크다운파일인가 && !제외대상인가) {
            const packageJsonPath = isIncludedRoot ? 'package.json' : findNearestPackageJson(filename)

            if (packageJsonPath != null) {
                acc.add(packageJsonPath)
            }
        }

        return acc
    }, new Set<string>())

    console.log('Packages filtered: ', Array.from(changedPackages)) // eslint-disable-line

    return Array.from(changedPackages)
}

export async function getAllPackageJSON() {
    const paths = await fg('**/package.json', {
        ignore: ['**/node_modules/**'],
    })

    return paths
}

export async function protectUnchangedPackages(changedPackages: string[]) {
    const allPackageJSON = await getAllPackageJSON()

    for (const packageJsonPath of allPackageJSON) {
        if (!changedPackages.includes(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

            core.info(`🔨 [${packageJson.name}] Add private:true option.`)

            packageJson.private = true

            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
        }
    }
}

interface ChangesetConfig {
    fixed?: string[][]
}

// Members of a changesets `fixed` group are published together, so an untouched
// sibling of a changed package must publish too — not be marked private.
export async function withFixedGroupSiblings(changedPackages: string[]): Promise<string[]> {
    let fixedGroups: string[][]

    try {
        const config = JSON.parse(fs.readFileSync('.changeset/config.json', 'utf8')) as ChangesetConfig

        fixedGroups = config.fixed ?? []
    } catch {
        return changedPackages
    }

    if (fixedGroups.length === 0) {
        return changedPackages
    }

    const allPackageJSON = await getAllPackageJSON()
    const pathByName = new Map<string, string>()

    for (const packageJsonPath of allPackageJSON) {
        const {name} = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

        if (typeof name === 'string') {
            pathByName.set(name, packageJsonPath)
        }
    }

    const changedPaths = new Set(changedPackages)
    const expanded = new Set(changedPackages)

    for (const group of fixedGroups) {
        const groupTouchesChange = group.some((name) => {
            const packageJsonPath = pathByName.get(name)

            return packageJsonPath != null && changedPaths.has(packageJsonPath)
        })

        if (groupTouchesChange) {
            for (const name of group) {
                const packageJsonPath = pathByName.get(name)

                if (packageJsonPath != null) {
                    expanded.add(packageJsonPath)
                }
            }
        }
    }

    return Array.from(expanded)
}

export async function removeChangesetMdFiles({
    changedFiles,
}: {
    changedFiles: Awaited<ReturnType<typeof getChangedAllFiles>>
}) {
    const markdownPaths = await fg('.changeset/*.md')

    return Promise.all(
        markdownPaths.map(async (markdownPath) => {
            if (changedFiles.find(({filename}) => filename === markdownPath) == null) {
                console.log(`Remove ${markdownPath} unrelated to PR`) // eslint-disable-line

                await fs.remove(markdownPath)
            }
        }),
    )
}
