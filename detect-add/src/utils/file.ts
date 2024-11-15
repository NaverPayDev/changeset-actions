import fs from 'fs-extra'

import {findNearestPackageJson, getChangedAllFiles} from '$actions/utils'

export async function getChangedPackages({
    packagesDir,
    changedFiles,
    excludes,
}: {
    changedFiles: Awaited<ReturnType<typeof getChangedAllFiles>>
    packagesDir: string[]
    excludes: string[]
}) {
    const isIncludedRoot = packagesDir.includes('.') === true
    const targetDirectories = packagesDir.filter((packagename) => packagename !== '.')

    const changedPackages = changedFiles.reduce((acc, {filename, status}) => {
        if (status === 'removed') {
            return acc
        }

        const 패키지대상인가 =
            isIncludedRoot || targetDirectories.some((packageDir) => filename.includes(`${packageDir}/`))
        // TODO: 제외 확장자도 받을 수 있도록
        const 마크다운파일인가 = filename.endsWith('.md')
        const 제외대상인가 = excludes.some((exclude) => {
            return filename === exclude || filename.startsWith(`${exclude}`)
        })

        if (패키지대상인가 && !마크다운파일인가 && !제외대상인가) {
            const packageJsonPath = isIncludedRoot ? 'package.json' : findNearestPackageJson(filename)

            if (packageJsonPath != null) {
                const packageJsonData = fs.readFileSync(packageJsonPath, 'utf-8')
                const packageJson = JSON.parse(packageJsonData)

                acc.add(packageJson.name)
            }
        }

        return acc
    }, new Set<string>())

    console.log('필터링된 packages', Array.from(changedPackages)) // eslint-disable-line

    return Array.from(changedPackages)
}
