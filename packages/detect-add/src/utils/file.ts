import * as github from '@actions/github'

import {uniqBy} from './uniqBy'

export async function getAllChangedFiles({
    owner,
    repo,
    octokit,
    pullNumber,
}: {
    owner: string
    repo: string
    pullNumber: number
    octokit: ReturnType<typeof github.getOctokit>
}) {
    const changedFiles = []

    for await (const response of octokit.paginate.iterator(octokit.rest.pulls.listFiles, {
        owner,
        repo,
        pull_number: pullNumber,
        per_page: 100,
    })) {
        changedFiles.push(...response.data)
    }

    return changedFiles
}

export async function getChangedPackages({
    packagesDir,
    allChangedFiles,
}: {
    allChangedFiles: Awaited<ReturnType<typeof getAllChangedFiles>>
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
