import path from 'path'

import * as core from '@actions/core'
import * as github from '@actions/github'
import fs from 'fs-extra'

import {getOctokitRestCommonParams} from '$actions/utils'

export async function getChangedAllFiles({pullNumber}: {pullNumber: number}) {
    const githubToken = core.getInput('github_token')
    const octokit = github.getOctokit(githubToken)
    const {owner, repo} = getOctokitRestCommonParams()

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

export function findNearestPackageJson(filePath: string) {
    let currentDir = path.dirname(filePath)

    while (currentDir !== path.parse(currentDir).root) {
        const packageJsonPath = path.join(currentDir, 'package.json')

        if (fs.existsSync(packageJsonPath)) {
            return packageJsonPath
        }

        currentDir = path.dirname(currentDir)
    }

    return undefined
}
