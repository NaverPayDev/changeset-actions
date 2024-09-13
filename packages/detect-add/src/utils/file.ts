import {getChangedAllFiles, uniqBy} from '$actions/utils'

export async function getChangedPackages({
    packagesDir,
    allChangedFiles,
}: {
    allChangedFiles: Awaited<ReturnType<typeof getChangedAllFiles>>
    packagesDir: string[]
}) {
    const changedPackages = allChangedFiles
        .filter(({filename}) => {
            const isTargetDirectories = packagesDir.some((packageDir) => filename.includes(`${packageDir}/`))
            const isMarkdownFile = filename.endsWith('.md')
            return isTargetDirectories && !isMarkdownFile
        })
        .map(({filename, status}) => {
            const [packageRoot, packageName] = filename.split('/')

            const packageJsonPath =
                status !== 'removed' ? [packageRoot, packageName, 'package.json'].join('/') : undefined

            return {packageName, packageJsonPath}
        })

    return uniqBy(changedPackages, ({packageName}) => packageName)
}
