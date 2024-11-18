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

    console.log('필터링된 packages', Array.from(changedPackages)) // eslint-disable-line

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

            core.info(`🔨 [${packageJson.name}] private:true 를 추가합니다`)

            packageJson.private = true

            fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
        }
    }
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
                console.log(`PR과 관련없는 ${markdownPath} 제거`) // eslint-disable-line

                await fs.remove(markdownPath)
            }
        }),
    )
}
